import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { instanceName, sender, message } = await req.json();

    if (!instanceName || !sender || !message) {
      throw new Error('Missing required fields: instanceName, sender, message');
    }

    console.log('Processing opt-out request:', { instanceName, sender });

    // Buscar o user_id pelo instance_name
    const { data: instance, error: instanceError } = await supabaseClient
      .from('whatsapp_instances')
      .select('user_id')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (instanceError || !instance) {
      console.error('Instance not found:', instanceError);
      throw new Error('WhatsApp instance not found');
    }

    // Função para normalizar texto (remover acentos e caracteres especiais)
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    };

    // Verificar se a mensagem contém palavras de opt-out (sem acentos para comparação)
    const optOutKeywords = ['nao', 'sair', 'parar', 'cancelar', 'stop', 'remover'];
    const normalizedMessage = normalizeText(message);
    
    // Usar .includes() para detectar palavras em mensagens mais longas (ex: "❌ NÃO")
    const isOptOut = optOutKeywords.some(keyword => normalizedMessage.includes(keyword));
    
    console.log('Verificando opt-out:', { 
      originalMessage: message,
      normalizedMessage, 
      isOptOut,
      matchedKeyword: optOutKeywords.find(k => normalizedMessage.includes(k)) 
    });

    if (isOptOut) {
      console.log('Opt-out detected, updating contact status...');
      
      // Normalize phone number (remove @s.whatsapp.net suffix)
      const normalizedPhone = sender.replace('@s.whatsapp.net', '');
      
      // Update contact status to unsubscribed in contacts table
      const { error: updateError } = await supabaseClient
        .from('contacts')
        .update({ 
          status: 'unsubscribed',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', instance.user_id)
        .eq('phone_number', normalizedPhone);

      // If contact doesn't exist, insert it as unsubscribed
      if (updateError) {
        console.log('Contact not found, creating as unsubscribed');
        const { error: insertError } = await supabaseClient
          .from('contacts')
          .insert({
            user_id: instance.user_id,
            phone_number: normalizedPhone,
            status: 'unsubscribed'
          });
        
        if (insertError && insertError.code !== '23505') {
          console.error('Error creating unsubscribed contact:', insertError);
          throw insertError;
        }
      }
      
      // Also maintain backward compatibility with blocked_contacts
      const { error: blockError } = await supabaseClient
        .from('blocked_contacts')
        .insert({
          user_id: instance.user_id,
          phone_number: sender,
          reason: `Opt-out via message: "${message}"`
        });

      // Ignore duplicate key errors (contact already blocked)
      if (blockError && blockError.code !== '23505') {
        console.error('Error blocking contact:', blockError);
      }
      
      console.log('Contact unsubscribed successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Contact blocked successfully',
          blocked: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('No opt-out detected in message');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'No opt-out detected',
        blocked: false 
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
