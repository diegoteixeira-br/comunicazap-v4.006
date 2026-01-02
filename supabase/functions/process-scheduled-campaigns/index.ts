import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('⏰ Iniciando processamento de campanhas agendadas...');

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar campanhas agendadas cujo horário já chegou
    const { data: scheduledCampaigns, error: fetchError } = await supabaseClient
      .from('message_campaigns')
      .select(`
        *,
        whatsapp_instances!inner (
          instance_name,
          api_key,
          status
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (fetchError) {
      console.error('❌ Erro ao buscar campanhas:', fetchError);
      throw fetchError;
    }

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      console.log('✅ Nenhuma campanha agendada para processar');
      return new Response(
        JSON.stringify({ success: true, message: 'No scheduled campaigns to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontradas ${scheduledCampaigns.length} campanhas para processar`);

    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!n8nWebhookUrl) {
      throw new Error('N8N webhook URL not configured');
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const campaign of scheduledCampaigns) {
      try {
        console.log(`\n🚀 Processando campanha ${campaign.id}: ${campaign.campaign_name}`);

        const instance = campaign.whatsapp_instances;

        // Verificar se a instância está conectada
        if (instance.status !== 'connected') {
          console.log(`⚠️ Instância não conectada para campanha ${campaign.id}`);
          await supabaseClient
            .from('message_campaigns')
            .update({ status: 'failed' })
            .eq('id', campaign.id);
          errorCount++;
          continue;
        }

        // Atualizar status para in_progress
        const { error: updateError } = await supabaseClient
          .from('message_campaigns')
          .update({ status: 'in_progress' })
          .eq('id', campaign.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar status da campanha ${campaign.id}:`, updateError);
          errorCount++;
          continue;
        }

        // Buscar logs pendentes da campanha
        const { data: pendingLogs, error: logsError } = await supabaseClient
          .from('message_logs')
          .select('*')
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending');

        if (logsError) {
          console.error(`❌ Erro ao buscar logs da campanha ${campaign.id}:`, logsError);
          errorCount++;
          continue;
        }

        if (!pendingLogs || pendingLogs.length === 0) {
          console.log(`⚠️ Nenhum log pendente para campanha ${campaign.id}`);
          await supabaseClient
            .from('message_campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaign.id);
          processedCount++;
          continue;
        }

        console.log(`📊 ${pendingLogs.length} mensagens pendentes`);

        // Preparar contatos para n8n
        const contactsToSend = pendingLogs.map(log => ({
          number: log.client_phone,
          name: log.client_name,
          text: escapeTextForJson(log.message),
          log_id: log.id
        }));

        // Buscar URL de mídia se existir (do storage)
        let mediaUrl: string | null = null;
        let mediaType: string | null = null;

        // Tentar buscar mídia no storage
        const { data: files } = await supabaseClient
          .storage
          .from('campaign-media')
          .list(`${campaign.user_id}`, {
            search: campaign.id
          });

        if (files && files.length > 0) {
          const file = files[0];
          const { data: { publicUrl } } = supabaseClient
            .storage
            .from('campaign-media')
            .getPublicUrl(`${campaign.user_id}/${file.name}`);
          
          mediaUrl = publicUrl;
          mediaType = file.metadata?.mimetype || 'image/jpeg';
          console.log(`📎 Mídia encontrada: ${mediaUrl}`);
        }

        // Callback URL para atualização de status
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

        console.log(`🔥 Enviando ${contactsToSend.length} contatos para n8n...`);

        // Enviar para n8n
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          console.log(`✅ Campanha ${campaign.id} enviada para n8n com sucesso!`);
          processedCount++;
        } else {
          console.error(`❌ Erro ao enviar para n8n: HTTP ${response.status}`);
          await supabaseClient
            .from('message_campaigns')
            .update({ status: 'failed' })
            .eq('id', campaign.id);
          errorCount++;
        }

      } catch (campaignError: any) {
        console.error(`❌ Erro ao processar campanha ${campaign.id}:`, campaignError.message);
        await supabaseClient
          .from('message_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumo: ${processedCount} processadas, ${errorCount} erros`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${processedCount} campaigns`,
        processed: processedCount,
        errors: errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
