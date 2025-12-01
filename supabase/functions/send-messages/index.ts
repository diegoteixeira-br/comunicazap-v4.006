import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações anti-banimento (mais conservadoras)
const BATCH_SIZE = 10; // Lotes menores
const MIN_DELAY_BETWEEN_MESSAGES = 4000; // 4 segundos
const MAX_DELAY_BETWEEN_MESSAGES = 8000; // 8 segundos
const MIN_BATCH_PAUSE = 90000; // 90 segundos (1.5 min)
const MAX_BATCH_PAUSE = 150000; // 150 segundos (2.5 min)
const MAX_CONSECUTIVE_ERRORS = 3;
const ERROR_RECOVERY_PAUSE = 180000; // 3 minutos
const REQUEST_TIMEOUT = 30000; // 30 segundos

// Funções auxiliares
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getRandomDelay = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Verificar status da conexão do WhatsApp
async function checkConnectionStatus(instanceName: string, apiKey: string): Promise<boolean> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    if (!evolutionApiUrl) return true; // Se não tiver URL configurada, assumir conectado
    
    const response = await fetch(
      `${evolutionApiUrl}/instance/connectionState/${instanceName}`,
      { 
        headers: { 'apikey': apiKey },
        signal: AbortSignal.timeout(10000)
      }
    );
    
    if (!response.ok) return true; // Se falhar a verificação, continuar tentando
    
    const data = await response.json();
    const isConnected = data?.instance?.state === 'open';
    console.log(`📡 Status da conexão: ${isConnected ? '✅ Conectado' : '❌ Desconectado'}`);
    return isConnected;
  } catch (error) {
    console.error('Erro ao verificar conexão:', error);
    return true; // Em caso de erro, assumir conectado para não bloquear
  }
}

// Sistema de retry com backoff exponencial
async function sendWithRetry(
  n8nWebhookUrl: string,
  payload: any,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string; response?: Response }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      
      const startTime = Date.now();
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        console.log(`✅ Sucesso em ${responseTime}ms`);
        return { success: true, response };
      }
      
      // Se não for erro de servidor, não tentar novamente
      if (![500, 502, 503].includes(response.status)) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou (HTTP ${response.status})`);
      
    } catch (error: any) {
      console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou:`, error.message);
      
      if (attempt === maxRetries) {
        return { success: false, error: error.message };
      }
    }
    
    // Backoff exponencial: 5s, 10s, 20s
    if (attempt < maxRetries) {
      const backoffDelay = 5000 * Math.pow(2, attempt - 1);
      console.log(`⏳ Aguardando ${backoffDelay/1000}s antes de retry...`);
      await sleep(backoffDelay);
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

// Pausar campanha
async function pauseCampaign(
  supabaseClient: any,
  campaignId: string,
  reason: string
) {
  await supabaseClient
    .from('message_campaigns')
    .update({ 
      status: 'paused',
      completed_at: new Date().toISOString()
    })
    .eq('id', campaignId);
  
  console.log(`⏸️ Campanha pausada: ${reason}`);
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

    // Upload image to Supabase Storage if provided
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    if (image) {
      try {
        console.log('Uploading media to Supabase Storage...');
        
        // Extract base64 data and mime type
        const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid image format');
        }
        
        mediaType = matches[1];
        const base64Data = matches[2];
        
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Generate unique filename
        const extension = mediaType.split('/')[1];
        const fileName = `${user.id}/${campaign.id}.${extension}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient
          .storage
          .from('campaign-media')
          .upload(fileName, bytes, {
            contentType: mediaType,
            upsert: false
          });
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabaseClient
          .storage
          .from('campaign-media')
          .getPublicUrl(fileName);
        
        mediaUrl = publicUrl;
        console.log('Media uploaded successfully:', mediaUrl);
        
      } catch (uploadError: any) {
        console.error('Failed to upload media:', uploadError);
        throw new Error(`Failed to upload media: ${uploadError.message}`);
      }
    }

    // Retornar resposta imediata e processar em background
    const backgroundTask = async () => {
      const results = [];
      let consecutiveErrors = 0;
      let successCount = 0;
      let failedCount = 0;

      console.log(`\n🚀 Iniciando envio de ${clients.length} mensagens...`);

      // Enviar mensagens sequencialmente com delays e verificações
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        
        // Verificar conexão a cada lote
        if (i > 0 && i % BATCH_SIZE === 0) {
          const isConnected = await checkConnectionStatus(instance.instance_name, instance.api_key);
          if (!isConnected) {
            console.error('❌ WhatsApp desconectado! Pausando campanha...');
            await pauseCampaign(supabaseClient, campaign.id, 'WhatsApp disconnected');
            break;
          }
        }
        
        try {
          // Check contact status in contacts table
          const { data: contact } = await supabaseClient
            .from('contacts')
            .select('status')
            .eq('user_id', user.id)
            .eq('phone_number', client["Telefone do Cliente"])
            .maybeSingle();

          if (contact?.status === 'unsubscribed') {
            console.log(`⛔ ${client["Nome do Cliente"]} optou por sair, pulando...`);
            
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
            console.log(`➕ Adicionando ${client["Nome do Cliente"]} aos contatos`);
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
              message: personalizedMessage || (mediaUrl ? `[Mídia: ${mediaUrl}]` : ''),
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

          // Adicionar URL da mídia se existir
          if (mediaUrl) {
            payload.mediaUrl = mediaUrl;
            payload.mediaType = mediaType;
          }

          console.log(`\n📤 [${i + 1}/${clients.length}] Enviando para ${client["Nome do Cliente"]}...`);
          
          const sendResult = await sendWithRetry(n8nWebhookUrl, payload);

          if (sendResult.success) {
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

            successCount++;
            consecutiveErrors = 0; // Reset contador de erros
            results.push({ success: true, client: client["Nome do Cliente"] });
            console.log(`📊 Progresso: ${successCount} enviados | ${failedCount} falhas`);
          } else {
            throw new Error(sendResult.error || 'Send failed');
          }

        } catch (error: any) {
          console.error(`❌ Falha ao enviar para ${client["Nome do Cliente"]}:`, error.message);
          
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

          failedCount++;
          consecutiveErrors++;
          results.push({ success: false, client: client["Nome do Cliente"], error: error.message });
          
          // Pausa de recuperação em caso de erros consecutivos
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.log(`\n🚨 ${MAX_CONSECUTIVE_ERRORS} erros consecutivos detectados!`);
            console.log(`⏸️ Pausando ${ERROR_RECOVERY_PAUSE/1000}s para recuperação...`);
            await sleep(ERROR_RECOVERY_PAUSE);
            
            // Re-verificar conexão após recuperação
            const isConnected = await checkConnectionStatus(instance.instance_name, instance.api_key);
            if (!isConnected) {
              console.error('❌ WhatsApp ainda desconectado após recuperação!');
              await pauseCampaign(supabaseClient, campaign.id, 'Connection issues');
              break;
            }
            
            consecutiveErrors = 0; // Reset após pausa
            console.log('✅ Retomando envios...');
          }
        }

        // Delay inteligente entre mensagens
        if (i < clients.length - 1) {
          const delay = getRandomDelay(MIN_DELAY_BETWEEN_MESSAGES, MAX_DELAY_BETWEEN_MESSAGES);
          console.log(`⏱️ Aguardando ${delay/1000}s...`);
          await sleep(delay);
          
          // Pausa maior a cada lote de mensagens
          if ((i + 1) % BATCH_SIZE === 0) {
            const batchPause = getRandomDelay(MIN_BATCH_PAUSE, MAX_BATCH_PAUSE);
            console.log(`\n🔄 Pausa de lote (${i + 1}/${clients.length}): ${batchPause/1000}s`);
            await sleep(batchPause);
          }
        }
      }

      // Finalizar campanha
      await supabaseClient
        .from('message_campaigns')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      console.log(`\n✅ Campanha finalizada!`);
      console.log(`📊 Resultado final: ${successCount} enviados | ${failedCount} falhas`);
    };

    // Iniciar processamento em background
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(backgroundTask());

    // Retornar resposta imediata
    return new Response(
      JSON.stringify({ 
        success: true,
        campaign: campaign.id,
        message: `Campanha iniciada! ${clients.length} mensagens serão enviadas. Acompanhe o progresso no histórico.`,
        totalContacts: clients.length
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
