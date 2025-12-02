import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= CONFIGURAÇÕES OTIMIZADAS PARA CHUNKS =============
// Cada chunk deve completar em ~50s (margem de segurança do timeout de 60s)
const CHUNK_SIZE = 12; // Mensagens por chunk
const MIN_DELAY_BETWEEN_MESSAGES = 3000; // 3s (otimizado)
const MAX_DELAY_BETWEEN_MESSAGES = 6000; // 6s (otimizado)
const GAUSSIAN_MEAN = 4000; // 4s média (otimizado)
const GAUSSIAN_STD_DEV = 1500; // 1.5s desvio
const BATCH_SIZE = 5; // Limite WhatsApp para mesma mensagem
const WARMUP_MESSAGES = 5; // Warm-up apenas nos primeiros 5 do primeiro chunk
const MAX_CONSECUTIVE_ERRORS = 3;
const REQUEST_TIMEOUT = 25000; // 25s (reduzido para caber no chunk)
const BASE_TYPING_SPEED = 200;
const MIN_TYPING_DELAY = 1500; // 1.5s mínimo
const MAX_TYPING_DELAY = 8000; // 8s máximo (reduzido)

// Funções auxiliares
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

const getRandomDelay = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Distribuição Gaussiana para delays mais naturais
const gaussianRandom = (mean: number, stdDev: number): number => {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const result = Math.round(mean + z * stdDev);
  return Math.max(MIN_DELAY_BETWEEN_MESSAGES, Math.min(MAX_DELAY_BETWEEN_MESSAGES, result));
};

// Calcular delay de digitação baseado no tamanho da mensagem
const calculateTypingDelay = (message: string): number => {
  const charCount = message.length;
  const calculatedDelay = (charCount / BASE_TYPING_SPEED) * 60 * 1000;
  return Math.min(Math.max(calculatedDelay, MIN_TYPING_DELAY), MAX_TYPING_DELAY);
};

// Multiplicador de warm-up APENAS para primeiro chunk
const getWarmupMultiplier = (messageIndex: number, isFirstChunk: boolean): number => {
  if (!isFirstChunk) return 1.0; // Sem warm-up em chunks subsequentes
  if (messageIndex < 2) return 2.0; // 2x mais lento
  if (messageIndex < WARMUP_MESSAGES) return 1.5; // 1.5x mais lento
  return 1.0;
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

// Sistema de retry com backoff
async function sendWithRetry(
  n8nWebhookUrl: string,
  payload: any,
  maxRetries: number = 2
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
    
    // Backoff: 3s, 6s
    if (attempt < maxRetries) {
      const backoffDelay = 3000 * attempt;
      console.log(`⏳ Retry em ${backoffDelay/1000}s...`);
      await sleep(backoffDelay);
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
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

    // Input validation schema - ATUALIZADO COM CHUNK PARAMS
    const clientSchema = z.object({
      "Nome do Cliente": z.string().trim().min(1).max(100),
      "Telefone do Cliente": z.string().regex(/^\+?[1-9]\d{1,14}$|^[0-9]+@g\.us$/)
    });

    const requestSchema = z.object({
      clients: z.array(clientSchema).optional().nullable(),
      targetTags: z.array(z.string()).optional().nullable(),
      message: z.string().trim().max(1000).optional().nullable(),
      messageVariations: z.array(z.string().trim().max(1000)).optional().nullable(),
      image: z.string().optional().nullable(),
      campaignName: z.string().trim().max(100).optional().nullable(),
      // NOVOS PARÂMETROS PARA CHUNKS
      chunkIndex: z.number().int().min(0).optional().default(0),
      existingCampaignId: z.string().uuid().optional().nullable()
    });

    const validatedData = requestSchema.parse(await req.json());
    const { 
      clients: providedClients, 
      targetTags, 
      message, 
      messageVariations, 
      image, 
      campaignName,
      chunkIndex,
      existingCampaignId
    } = validatedData;
    
    let clients = providedClients || [];
    const isFirstChunk = chunkIndex === 0;
    
    // Buscar contatos por tags se necessário
    if (targetTags && targetTags.length > 0) {
      console.log('Fetching contacts by tags:', targetTags);
      
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
      
      console.log(`Found ${clients.length} contacts with tags`);
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

    // VALIDAÇÃO OBRIGATÓRIA: 1 variação = máximo 5 contatos (sem repetição)
    const requiredVariations = Math.ceil(clients.length / BATCH_SIZE);
    if (variations.length > 0 && variations.length < requiredVariations) {
      throw new Error(`Insufficient variations: ${variations.length} provided, ${requiredVariations} required for ${clients.length} contacts (max 5 contacts per variation)`);
    }

    // Calcular slice do chunk
    const startIndex = chunkIndex * CHUNK_SIZE;
    const endIndex = Math.min(startIndex + CHUNK_SIZE, clients.length);
    const clientsToProcess = clients.slice(startIndex, endIndex);
    const hasMore = endIndex < clients.length;

    console.log(`\n🚀 CHUNK ${chunkIndex + 1}: Processando ${clientsToProcess.length} de ${clients.length} contatos`);
    console.log(`📊 Índices: ${startIndex} até ${endIndex - 1} | hasMore: ${hasMore}`);

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

    // Verificar conexão no início
    if (isFirstChunk) {
      const isConnected = await checkConnectionStatus(instance.instance_name, instance.api_key);
      if (!isConnected) {
        throw new Error('WhatsApp disconnected. Please reconnect.');
      }
    }

    // Criar ou reutilizar campanha
    let campaign: any;
    
    if (existingCampaignId && !isFirstChunk) {
      // Reutilizar campanha existente
      const { data: existingCampaign, error: fetchError } = await supabaseClient
        .from('message_campaigns')
        .select('*')
        .eq('id', existingCampaignId)
        .eq('user_id', user.id)
        .single();
      
      if (fetchError || !existingCampaign) {
        throw new Error('Campaign not found');
      }
      
      campaign = existingCampaign;
      console.log(`📋 Usando campanha existente: ${campaign.id}`);
    } else {
      // Criar nova campanha (primeiro chunk)
      const { data: newCampaign, error: campaignError } = await supabaseClient
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

      if (campaignError) throw campaignError;
      
      campaign = newCampaign;
      console.log(`📋 Nova campanha criada: ${campaign.id}`);
    }

    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!n8nWebhookUrl) {
      throw new Error('N8N webhook URL not configured');
    }
    
    if (!instance.api_key) {
      throw new Error('Instance API key missing');
    }

    // Upload de mídia apenas no primeiro chunk
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    
    if (image && isFirstChunk) {
      try {
        console.log('Uploading media...');
        
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
        console.log('Media uploaded:', mediaUrl);
        
      } catch (uploadError: any) {
        console.error('Media upload failed:', uploadError);
        // Continuar sem mídia se falhar
      }
    }

    // ============= PROCESSAMENTO SÍNCRONO DO CHUNK =============
    let successCount = 0;
    let failedCount = 0;
    let consecutiveErrors = 0;
    let messagesInCurrentBatch = 0;

    for (let i = 0; i < clientsToProcess.length; i++) {
      const client = clientsToProcess[i];
      const globalIndex = startIndex + i; // Índice global para variações
      
      try {
        // Verificar status do contato
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

        // Selecionar variação por bloco de 5 (limite WhatsApp)
        const blockIndex = Math.floor(globalIndex / BATCH_SIZE);
        const variationIndex = variations.length > 0 ? blockIndex % variations.length : 0;
        const selectedMessage = variations[variationIndex] || '';
        const personalizedMessage = selectedMessage.replace(/{nome}/g, client["Nome do Cliente"]);
        
        // Criar log
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

        const typingDelay = personalizedMessage?.trim() 
          ? calculateTypingDelay(personalizedMessage)
          : MIN_TYPING_DELAY;

        const safeText = escapeTextForJson(personalizedMessage);

        const payload: any = {
          instanceName: instance.instance_name,
          api_key: instance.api_key,
          number: client["Telefone do Cliente"],
          options: {
            delay: typingDelay,
            presence: "composing"
          }
        };

        if (safeText?.trim()) {
          payload.text = safeText;
        }

        if (mediaUrl) {
          payload.mediaUrl = mediaUrl;
          payload.mediaType = mediaType;
        }

        console.log(`📤 [${globalIndex + 1}/${clients.length}] Enviando para ${client["Nome do Cliente"]}...`);
        
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
          consecutiveErrors = 0;
          messagesInCurrentBatch++;
          console.log(`✅ Enviado! Progresso chunk: ${successCount}/${clientsToProcess.length}`);
        } else {
          throw new Error(sendResult.error || 'Send failed');
        }

      } catch (error: any) {
        console.error(`❌ Falha: ${client["Nome do Cliente"]} - ${error.message}`);
        
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
        
        // Se muitos erros consecutivos, parar chunk
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.log(`🚨 ${MAX_CONSECUTIVE_ERRORS} erros consecutivos! Parando chunk...`);
          break;
        }
      }

      // Delay entre mensagens (exceto última)
      if (i < clientsToProcess.length - 1) {
        const warmupMultiplier = getWarmupMultiplier(i, isFirstChunk);
        const baseDelay = gaussianRandom(GAUSSIAN_MEAN, GAUSSIAN_STD_DEV);
        const finalDelay = Math.round(baseDelay * warmupMultiplier);
        
        if (warmupMultiplier > 1.0) {
          console.log(`🐢 Warm-up: ${finalDelay/1000}s (${warmupMultiplier}x)`);
        } else {
          console.log(`⏱️ Delay: ${finalDelay/1000}s`);
        }
        
        await sleep(finalDelay);
      }
    }

    // Se não há mais mensagens, finalizar campanha
    if (!hasMore) {
      await supabaseClient
        .from('message_campaigns')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaign.id);
      
      console.log(`\n🎉 Campanha finalizada!`);
    }

    // Buscar totais atualizados
    const { data: updatedCampaign } = await supabaseClient
      .from('message_campaigns')
      .select('sent_count, failed_count')
      .eq('id', campaign.id)
      .single();

    console.log(`\n📊 Chunk ${chunkIndex + 1} completo: ${successCount} enviados, ${failedCount} falhas`);
    console.log(`📊 Total campanha: ${updatedCampaign?.sent_count || 0} enviados, ${updatedCampaign?.failed_count || 0} falhas`);

    // Retornar resultado do chunk
    return new Response(
      JSON.stringify({ 
        success: true,
        campaignId: campaign.id,
        chunkIndex,
        processed: successCount + failedCount,
        chunkSuccess: successCount,
        chunkFailed: failedCount,
        totalContacts: clients.length,
        currentIndex: endIndex,
        hasMore,
        progress: {
          sent: updatedCampaign?.sent_count || 0,
          failed: updatedCampaign?.failed_count || 0,
          total: clients.length
        },
        nextChunkIndex: hasMore ? chunkIndex + 1 : null
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
