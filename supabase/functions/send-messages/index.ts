import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Input validation schema
    const clientSchema = z.object({
      "Nome do Cliente": z.string().trim().min(1, "Client name is required").max(100, "Client name too long"),
      "Telefone do Cliente": z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    });

    const requestSchema = z.object({
      clients: z.array(clientSchema).optional().nullable(),
      targetTags: z.array(z.string()).optional().nullable(),
      message: z.string().trim().max(1000, "Message too long").optional().nullable(),
      messageVariations: z.array(z.string().trim().max(1000, "Message too long")).optional().nullable(),
      image: z.string().optional().nullable(),
      campaignName: z.string().trim().max(100, "Campaign name too long").optional().nullable()
    });

    // Validate input
    const validatedData = requestSchema.parse(await req.json());
    const { clients: providedClients, targetTags, message, messageVariations, image, campaignName } = validatedData;
    
    let clients = providedClients || [];
    
    // If target tags are provided, fetch contacts from database
    if (targetTags && targetTags.length > 0) {
      console.log('Fetching contacts by tags:', targetTags);
      
      const { data: contactsFromDb, error: contactsError } = await supabaseClient
        .from('contacts')
        .select('phone_number, name')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .contains('tags', targetTags);
      
      if (contactsError) {
        console.error('Error fetching contacts:', contactsError);
        throw contactsError;
      }
      
      clients = contactsFromDb.map(contact => ({
        "Nome do Cliente": contact.name || contact.phone_number,
        "Telefone do Cliente": contact.phone_number
      }));
      
      console.log(`Found ${clients.length} contacts with tags`);
    }
    
    // Validate we have clients
    if (!clients || clients.length === 0) {
      throw new Error('No clients provided or found with the specified tags');
    }
    
    if (clients.length > 1000) {
      throw new Error('Maximum 1000 clients per campaign');
    }

    // Usar variações se fornecidas, senão usar mensagem única
    const variations = messageVariations && messageVariations.length > 0 
      ? messageVariations 
      : (message ? [message] : []);

    // Validar que ao menos mensagem ou imagem está presente
    if (variations.length === 0 && !image) {
      throw new Error('Either message or image is required');
    }

    console.log('Send messages request:', { 
      user: user.id, 
      clientsCount: clients.length,
      campaignName 
    });

    const { data: instance, error: instanceError } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (instanceError || !instance) {
      throw new Error('WhatsApp instance not found. Please connect your WhatsApp first.');
    }

    if (instance.status !== 'connected') {
      throw new Error('WhatsApp is not connected. Please scan the QR code first.');
    }

    const { data: campaign, error: campaignError } = await supabaseClient
      .from('message_campaigns')
      .insert({
        user_id: user.id,
        instance_id: instance.id,
        campaign_name: campaignName || `Campaign ${new Date().toISOString()}`,
        total_contacts: clients.length,
        message_variations: variations,
        target_tags: targetTags || [],
        status: 'in_progress'
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Campaign creation error:', campaignError);
      throw campaignError;
    }

    console.log('Campaign created:', campaign.id);

    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    
    if (!n8nWebhookUrl) {
      throw new Error('N8N webhook URL not configured');
    }
    
    if (!instance.api_key) {
      throw new Error('Instance API key missing. Please reconnect your WhatsApp.');
    }

    const results = [];

    // Enviar mensagens sequencialmente com delay
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      
      try {
        // Check contact status in contacts table
        const { data: contact } = await supabaseClient
          .from('contacts')
          .select('status')
          .eq('user_id', user.id)
          .eq('phone_number', client["Telefone do Cliente"])
          .maybeSingle();

        if (contact?.status === 'unsubscribed') {
          console.log(`Contact ${client["Nome do Cliente"]} is unsubscribed, skipping`);
          
          // Log as blocked
          await supabaseClient
            .from('message_logs')
            .insert({
              campaign_id: campaign.id,
              client_name: client["Nome do Cliente"],
              client_phone: client["Telefone do Cliente"],
              message: '[Bloqueado - Opt-out]',
              status: 'blocked'
            });

          continue; // Skip to next contact
        }
        
        // If contact doesn't exist in contacts table and not from targetTags, insert it
        if (!contact && !targetTags) {
          console.log(`Adding new contact ${client["Nome do Cliente"]} to contacts table`);
          await supabaseClient
            .from('contacts')
            .insert({
              user_id: user.id,
              phone_number: client["Telefone do Cliente"],
              name: client["Nome do Cliente"],
              status: 'active'
            })
            .select()
            .single();
        }

        // Selecionar a variação de mensagem (round-robin)
        const variationIndex = variations.length > 0 ? i % variations.length : 0;
        const selectedMessage = variations[variationIndex] || '';
        const personalizedMessage = selectedMessage.replace('{nome}', client["Nome do Cliente"]);
        const { data: log } = await supabaseClient
          .from('message_logs')
          .insert({
            campaign_id: campaign.id,
            client_name: client["Nome do Cliente"],
            client_phone: client["Telefone do Cliente"],
            message: personalizedMessage || (image ? '[Imagem]' : ''),
            message_variation_index: variationIndex,
            status: 'pending'
          })
          .select()
          .single();

        const payload: any = {
          instanceName: instance.instance_name,
          api_key: instance.api_key,
          number: client["Telefone do Cliente"],
        };

        // Adicionar texto se existir
        if (personalizedMessage?.trim()) {
          payload.text = personalizedMessage;
        }

        // Adicionar imagem se existir
        if (image) {
          payload.image = image;
        }

        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          await supabaseClient
            .from('message_logs')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', log.id);

          await supabaseClient.rpc('increment_sent_count', { 
            campaign_id: campaign.id 
          });

          results.push({ success: true, client: client["Nome do Cliente"] });
          console.log(`Message sent successfully to ${client["Nome do Cliente"]} (${i + 1}/${clients.length})`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }

      } catch (error: any) {
        console.error(`Failed to send to ${client["Nome do Cliente"]}:`, error);
        
        await supabaseClient
          .from('message_logs')
          .update({ 
            status: 'failed',
            error_message: error.message
          })
          .eq('campaign_id', campaign.id)
          .eq('client_phone', client["Telefone do Cliente"]);

        await supabaseClient.rpc('increment_failed_count', { 
          campaign_id: campaign.id 
        });

        results.push({ success: false, client: client["Nome do Cliente"], error: error.message });
      }

      // Aguardar 1 segundo antes do próximo envio (exceto no último)
      if (i < clients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    await supabaseClient
      .from('message_campaigns')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log('Campaign completed:', { successCount, failedCount });

    return new Response(
      JSON.stringify({ 
        success: true,
        campaign: campaign.id,
        results: {
          total: clients.length,
          sent: successCount,
          failed: failedCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});