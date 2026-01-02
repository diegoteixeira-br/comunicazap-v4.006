import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações
const BATCH_SIZE = 5; // Máximo de contatos por variação de mensagem

// Escapar texto para ser seguro em JSON dentro do n8n
const escapeTextForJson = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"');
};

// Verificar status da conexão do WhatsApp
async function checkConnectionStatus(instanceName: string, apiKey: string): Promise<boolean> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    if (!evolutionApiUrl) return true;
    
    const response = await fetch(
      `${evolutionApiUrl}/instance/connectionState/${instanceName}`,
      { 
        headers: { 'apikey': apiKey },
        signal: AbortSignal.timeout(8000)
      }
    );
    
    if (!response.ok) return true;
    
    const data = await response.json();
    const isConnected = data?.instance?.state === 'open';
    console.log(`📡 Status: ${isConnected ? '✅ Conectado' : '❌ Desconectado'}`);
    return isConnected;
  } catch (error) {
    console.error('Erro ao verificar conexão:', error);
    return true;
  }
}

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
      "Nome do Cliente": z.string().trim().min(1).max(100),
      "Telefone do Cliente": z.string().regex(/^\+?[1-9]\d{1,14}$|^.+@g\.us$/)
    });

const requestSchema = z.object({
  clients: z.array(clientSchema).optional().nullable(),
  targetTags: z.array(z.string()).optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
  messageVariations: z.array(z.string().trim().max(1000)).optional().nullable(),
  image: z.string().optional().nullable(),
  campaignName: z.string().trim().max(100).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
});

const validatedData = requestSchema.parse(await req.json());
    const { 
      clients: providedClients, 
      targetTags, 
      message, 
      messageVariations, 
      image, 
      campaignName,
      scheduledAt,
    } = validatedData;
    
    let clients = providedClients || [];
    
    // Buscar contatos por tags se necessário
    if (targetTags && targetTags.length > 0) {
      console.log('🏷️ Buscando contatos por tags:', targetTags);
      
      const { data: contactsFromDb, error: contactsError } = await supabaseClient
        .from('contacts')
        .select('phone_number, name')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .contains('tags', targetTags);
      
      if (contactsError) throw contactsError;
      
      clients = contactsFromDb.map(contact => ({
        "Nome do Cliente": contact.name || contact.phone_number,
        "Telefone do Cliente": contact.phone_number
      }));
      
      console.log(`📊 Encontrados ${clients.length} contatos com tags`);
    }
    
    if (!clients || clients.length === 0) {
      throw new Error('No clients provided or found with the specified tags');
    }
    
    if (clients.length > 2000) {
      throw new Error('Maximum 2000 clients per campaign');
    }

    const variations = messageVariations && messageVariations.length > 0 
      ? messageVariations.filter(v => v && v.trim()) 
      : (message ? [message] : []);

    if (variations.length === 0 && !image) {
      throw new Error('Either message or image is required');
    }

    // VALIDAÇÃO: 1 variação = máximo 5 contatos
    const requiredVariations = Math.ceil(clients.length / BATCH_SIZE);
    if (variations.length > 0 && variations.length < requiredVariations) {
      throw new Error(`Insufficient variations: ${variations.length} provided, ${requiredVariations} required for ${clients.length} contacts (max 5 contacts per variation)`);
    }

    // Buscar instância WhatsApp
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

    // Verificar conexão
    const isConnected = await checkConnectionStatus(instance.instance_name, instance.api_key);
    if (!isConnected) {
      throw new Error('WhatsApp disconnected. Please reconnect.');
    }

    // ============= RATE LIMITING: Limite diário de campanhas =============
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count: dailyCampaignCount, error: countError } = await supabaseClient
      .from('message_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneDayAgo);

    if (countError) {
      console.error('Erro ao verificar limite diário:', countError);
    } else if ((dailyCampaignCount || 0) >= 20) {
      throw new Error('Limite diário de 20 campanhas atingido. Tente novamente amanhã.');
    }
    console.log(`📊 Campanhas nas últimas 24h: ${dailyCampaignCount || 0}/20`);

// Determinar status inicial da campanha
    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
    const initialStatus = isScheduled ? 'scheduled' : 'in_progress';

    if (isScheduled) {
      console.log(`📅 Campanha agendada para: ${scheduledAt}`);
    }

    // Criar campanha
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('message_campaigns')
      .insert({
        user_id: user.id,
        instance_id: instance.id,
        campaign_name: campaignName || `Campaign ${new Date().toISOString()}`,
        total_contacts: clients.length,
        message_variations: variations,
        target_tags: targetTags || [],
        status: initialStatus,
        scheduled_at: isScheduled ? scheduledAt : null
      })
      .select()
      .single();

    if (campaignError) throw campaignError;
    console.log(`📋 Campanha criada: ${campaign.id} (status: ${initialStatus})`);

    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!n8nWebhookUrl) {
      throw new Error('N8N webhook URL not configured');
    }
    
    if (!instance.api_key) {
      throw new Error('Instance API key missing');
    }

    // Upload de mídia se houver
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    
    if (image) {
      try {
        console.log('📤 Fazendo upload de mídia...');
        
        const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid image format');
        }
        
        mediaType = matches[1];
        const base64Data = matches[2];
        
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const extension = mediaType.split('/')[1];
        const fileName = `${user.id}/${campaign.id}.${extension}`;
        
        const { error: uploadError } = await supabaseClient
          .storage
          .from('campaign-media')
          .upload(fileName, bytes, {
            contentType: mediaType,
            upsert: true
          });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabaseClient
          .storage
          .from('campaign-media')
          .getPublicUrl(fileName);
        
        mediaUrl = publicUrl;
        console.log('✅ Mídia uploaded:', mediaUrl);
        
      } catch (uploadError: any) {
        console.error('❌ Falha no upload de mídia:', uploadError);
      }
    }

    // ============= PREPARAR CONTATOS PARA N8N =============
    console.log(`\n🚀 Preparando ${clients.length} contatos para envio via n8n...`);
    
    const contactsToSend: any[] = [];
    
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      
      // Verificar opt-out
      const { data: contact } = await supabaseClient
        .from('contacts')
        .select('status')
        .eq('user_id', user.id)
        .eq('phone_number', client["Telefone do Cliente"])
        .maybeSingle();

      if (contact?.status === 'unsubscribed') {
        console.log(`⛔ ${client["Nome do Cliente"]} optou por sair, pulando...`);
        
        await supabaseClient
          .from('message_logs')
          .insert({
            campaign_id: campaign.id,
            client_name: client["Nome do Cliente"],
            client_phone: client["Telefone do Cliente"],
            message: '[Bloqueado - Opt-out]',
            status: 'blocked'
          });

        continue;
      }
      
      // Adicionar contato se não existir
      if (!contact && !targetTags) {
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

      // Selecionar variação por bloco de 5
      const blockIndex = Math.floor(i / BATCH_SIZE);
      const variationIndex = variations.length > 0 ? blockIndex % variations.length : 0;
      const selectedMessage = variations[variationIndex] || '';
      const personalizedMessage = selectedMessage.replace(/{nome}/g, client["Nome do Cliente"]);
      
      // Criar log pendente
      const { data: log } = await supabaseClient
        .from('message_logs')
        .insert({
          campaign_id: campaign.id,
          client_name: client["Nome do Cliente"],
          client_phone: client["Telefone do Cliente"],
          message: personalizedMessage || (mediaUrl ? `[Mídia]` : ''),
          message_variation_index: variationIndex,
          status: 'pending'
        })
        .select()
        .single();

      const safeText = escapeTextForJson(personalizedMessage);

      contactsToSend.push({
        number: client["Telefone do Cliente"],
        name: client["Nome do Cliente"],
        text: safeText,
        log_id: log?.id
      });
    }

    console.log(`📋 ${contactsToSend.length} contatos prontos para envio (${clients.length - contactsToSend.length} bloqueados)`);

// ============= SE AGENDADO, NÃO ENVIAR PARA N8N =============
    if (isScheduled) {
      console.log(`\n📅 Campanha agendada com sucesso!`);
      console.log(`📊 ${contactsToSend.length} contatos preparados para envio em ${scheduledAt}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          campaignId: campaign.id,
          totalContacts: clients.length,
          contactsQueued: contactsToSend.length,
          blockedContacts: clients.length - contactsToSend.length,
          message: `Campanha agendada para ${new Date(scheduledAt).toLocaleString('pt-BR')}`,
          status: 'scheduled',
          scheduledAt: scheduledAt
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // ============= ENVIAR TUDO PARA N8N (FIRE-AND-FORGET) =============
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const callbackUrl = `${supabaseUrl}/functions/v1/update-message-status`;
    
    const payload = {
      instanceName: instance.instance_name,
      api_key: instance.api_key,
      campaign_id: campaign.id,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      callback_url: callbackUrl,
      contacts: contactsToSend
    };

    // Log seguro sem expor api_key
    console.log(`🔥 Enviando payload para n8n: instanceName=${instance.instance_name}, campaign_id=${campaign.id}, contacts=${contactsToSend.length}, hasMedia=${!!mediaUrl}`);

    // Fire-and-forget: não esperar resposta
    const sendToN8n = async () => {
      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
        });
        
        if (response.ok) {
          console.log(`✅ Payload enviado com sucesso para n8n!`);
        } else {
          console.error(`❌ Erro ao enviar para n8n: HTTP ${response.status}`);
          // Marcar campanha como falha
          await supabaseClient
            .from('message_campaigns')
            .update({ status: 'failed' })
            .eq('id', campaign.id);
        }
      } catch (error: any) {
        console.error(`❌ Erro ao conectar com n8n:`, error.message);
        await supabaseClient
          .from('message_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id);
      }
    };

    // Usar waitUntil para processar em background
    // @ts-ignore - EdgeRuntime.waitUntil exists in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(sendToN8n());
    } else {
      // Fallback: fire-and-forget sem await
      sendToN8n();
    }

    // ============= RESPONDER IMEDIATAMENTE =============
    console.log(`\n🎉 Resposta imediata enviada ao cliente!`);
    console.log(`📊 Campanha ${campaign.id}: ${contactsToSend.length} contatos em processamento pelo n8n`);

    return new Response(
      JSON.stringify({ 
        success: true,
        campaignId: campaign.id,
        totalContacts: clients.length,
        contactsQueued: contactsToSend.length,
        blockedContacts: clients.length - contactsToSend.length,
        message: 'Campaign started! Messages are being sent by n8n in the background.',
        status: 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }
});
