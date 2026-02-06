import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PER_BATCH = 10;
const SIMILARITY_THRESHOLD = 0.55; // Reduzido de 0.7 para 0.55
const SIMILARITY_THRESHOLD_DUPLICATES = 0.70; // Threshold para duplicatas entre variações
const MAX_RETRIES = 2; // Máximo de tentativas por variação

// Calcular similaridade entre duas strings (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/\s+/g, ' ').trim();
  const s2 = str2.toLowerCase().replace(/\s+/g, ' ').trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Calcular palavras em comum
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  
  let commonWords = 0;
  words1.forEach(word => {
    if (words2.has(word)) commonWords++;
  });
  
  const totalWords = Math.max(words1.size, words2.size);
  return commonWords / totalWords;
}

// Detectar posição dos emojis na mensagem
function detectEmojiPosition(text: string): 'inicio' | 'meio' | 'fim' | 'nenhum' | 'multiplas' {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const matches = [...text.matchAll(emojiRegex)];
  
  if (matches.length === 0) return 'nenhum';
  if (matches.length > 2) return 'multiplas';
  
  const textLength = text.length;
  const firstEmojiPos = matches[0].index || 0;
  const relativePos = firstEmojiPos / textLength;
  
  if (relativePos < 0.2) return 'inicio';
  if (relativePos > 0.7) return 'fim';
  return 'meio';
}

// Validar se uma variação é aceitável
function isValidVariation(
  variation: string, 
  original: string, 
  existingVariations: string[],
  originalEmojiPosition: string
): { valid: boolean; reason?: string } {
  // Rejeitar se muito curta
  if (variation.length < 50) {
    return { valid: false, reason: 'muito_curta' };
  }
  
  // Rejeitar se não tem placeholder {nome}
  if (!variation.includes('{nome}')) {
    return { valid: false, reason: 'sem_placeholder' };
  }
  
  // Rejeitar se contém labels indesejados
  if (/\(varia[çc][aã]o\s*\d*\)/i.test(variation) || 
      /varia[çc][aã]o\s*\d+/i.test(variation) ||
      /\(vers[aã]o\s*\d*\)/i.test(variation)) {
    return { valid: false, reason: 'tem_label' };
  }
  
  // Rejeitar se muito similar à original (threshold reduzido para 55%)
  const similarityToOriginal = calculateSimilarity(variation, original);
  if (similarityToOriginal > SIMILARITY_THRESHOLD) {
    return { valid: false, reason: `muito_similar_original (${(similarityToOriginal * 100).toFixed(0)}%)` };
  }
  
  // Verificar se a posição do emoji foi alterada (se original tinha emoji)
  if (originalEmojiPosition !== 'nenhum') {
    const variationEmojiPos = detectEmojiPosition(variation);
    // Se a variação tem emoji na mesma posição que a original, penalizar (mas não rejeitar sempre)
    if (variationEmojiPos === originalEmojiPosition && variationEmojiPos !== 'multiplas') {
      // 50% de chance de rejeitar se emoji está na mesma posição
      if (Math.random() > 0.5) {
        return { valid: false, reason: 'emoji_mesma_posicao' };
      }
    }
  }
  
  // Rejeitar se é duplicata de uma existente (threshold de 70%)
  for (const existing of existingVariations) {
    const similarity = calculateSimilarity(variation, existing);
    if (similarity > SIMILARITY_THRESHOLD_DUPLICATES) {
      return { valid: false, reason: `duplicata (${(similarity * 100).toFixed(0)}%)` };
    }
  }
  
  return { valid: true };
}

// Gerar variação de emergência com IA usando técnica específica
async function generateEmergencyVariation(
  original: string,
  technique: string,
  apiKey: string,
  originalEmojiPosition: string,
  attemptNumber: number
): Promise<string | null> {
  const techniques: Record<string, string> = {
    'formal': 'Reescreva de forma MAIS FORMAL e profissional, mantendo o sentido.',
    'casual': 'Reescreva de forma MAIS CASUAL e amigável, como conversa entre amigos.',
    'emotiva': 'Reescreva com TOM MAIS EMOTIVO e caloroso, transmitindo carinho.',
    'curta': 'Reescreva de forma MAIS CURTA e direta, sem perder o sentido principal.',
    'expandida': 'Reescreva EXPANDINDO com mais detalhes e explicações.',
    'motivacional': 'Reescreva com TOM MOTIVACIONAL e inspirador.',
    'poetica': 'Reescreva com linguagem MAIS POÉTICA e elegante.',
    'objetiva': 'Reescreva de forma OBJETIVA e clara, focando nos pontos principais.',
    'pergunta': 'Transforme afirmações em PERGUNTAS RETÓRICAS que engajem o leitor.',
    'invertida': 'INVERTA a ordem das informações: coloque a CTA no início se estava no fim, ou vice-versa.',
    'fragmentada': 'QUEBRE frases longas em duas ou três frases curtas e impactantes.',
  };

  const instruction = techniques[technique] || techniques['casual'];
  
  // Instruções específicas para posição de emoji
  let emojiInstruction = '';
  if (originalEmojiPosition === 'fim') {
    emojiInstruction = 'Se usar emojis, coloque-os NO INÍCIO ou NO MEIO da mensagem, NUNCA no fim.';
  } else if (originalEmojiPosition === 'inicio') {
    emojiInstruction = 'Se usar emojis, coloque-os NO MEIO ou NO FIM da mensagem, NUNCA no início.';
  } else if (originalEmojiPosition === 'meio') {
    emojiInstruction = 'Se usar emojis, coloque-os NO INÍCIO ou NO FIM da mensagem, NUNCA no meio.';
  }
  
  // 10% das tentativas devem ser sem emoji
  const shouldBeWithoutEmoji = attemptNumber % 10 === 0;
  if (shouldBeWithoutEmoji) {
    emojiInstruction = 'NÃO use nenhum emoji nesta variação. Use apenas texto puro.';
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: `Você é um copywriter. ${instruction}

REGRAS ABSOLUTAS:
- NUNCA copie a mensagem original
- NUNCA adicione "(variação X)" ou labels similares
- MANTENHA o placeholder {nome}
- Use palavras COMPLETAMENTE DIFERENTES da original
- Reestruture a ordem das frases
- ${emojiInstruction}
- Retorne APENAS a mensagem reescrita, sem explicações` 
          },
          { role: 'user', content: original }
        ],
        temperature: 1.1,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    
    return text || null;
  } catch {
    return null;
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

    const { originalMessage, count = 3 } = await req.json();

    if (!originalMessage || !originalMessage.trim()) {
      throw new Error('Original message is required');
    }

    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const hasEmojis = emojiRegex.test(originalMessage);
    const emojiCount = (originalMessage.match(emojiRegex) || []).length;
    const originalEmojiPosition = detectEmojiPosition(originalMessage);

    const variationCount = Math.max(1, count);
    const toGenerate = variationCount - 1;

    if (toGenerate === 0) {
      return new Response(
        JSON.stringify({ success: true, variations: [originalMessage], failedCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Generating ${toGenerate} variations for user ${user.id}`);
    console.log(`Original emoji position: ${originalEmojiPosition}, has emojis: ${hasEmojis}`);

    const totalBatches = Math.ceil(toGenerate / MAX_PER_BATCH);
    const allVariations: string[] = [];
    const failedSlots: number[] = []; // Track which slots failed

    for (let batch = 0; batch < totalBatches; batch++) {
      const isLastBatch = batch === totalBatches - 1;
      const batchSize = isLastBatch 
        ? toGenerate - (batch * MAX_PER_BATCH)
        : MAX_PER_BATCH;

      console.log(`Generating batch ${batch + 1}/${totalBatches} with ${batchSize} variations`);

      // Instruções de posição de emoji baseadas na original
      let emojiPositionInstructions = '';
      if (originalEmojiPosition === 'fim') {
        emojiPositionInstructions = `
⚠️ POSIÇÃO DE EMOJIS - REGRA CRÍTICA:
A mensagem original tem emoji(s) NO FIM.
- 45% das variações: emojis NO INÍCIO da mensagem
- 45% das variações: emojis NO MEIO da mensagem  
- 10% das variações: SEM EMOJIS (texto puro)
- NUNCA coloque emoji no fim igual a original!`;
      } else if (originalEmojiPosition === 'inicio') {
        emojiPositionInstructions = `
⚠️ POSIÇÃO DE EMOJIS - REGRA CRÍTICA:
A mensagem original tem emoji(s) NO INÍCIO.
- 45% das variações: emojis NO FIM da mensagem
- 45% das variações: emojis NO MEIO da mensagem
- 10% das variações: SEM EMOJIS (texto puro)
- NUNCA coloque emoji no início igual a original!`;
      } else if (originalEmojiPosition === 'meio') {
        emojiPositionInstructions = `
⚠️ POSIÇÃO DE EMOJIS - REGRA CRÍTICA:
A mensagem original tem emoji(s) NO MEIO.
- 45% das variações: emojis NO INÍCIO da mensagem
- 45% das variações: emojis NO FIM da mensagem
- 10% das variações: SEM EMOJIS (texto puro)
- NUNCA coloque emoji no meio igual a original!`;
      } else {
        emojiPositionInstructions = `
🎭 EMOJIS (original não tem):
- 90% das variações: SEM emojis (manter estilo)
- 10% das variações: COM emojis sutis e apropriados (variar posições)`;
      }

      const systemPrompt = `Você é um COPYWRITER ESPECIALISTA em criar VARIAÇÕES ÚNICAS de mensagens para WhatsApp.

🚫 REGRAS ABSOLUTAS - NUNCA FAZER:
- NUNCA copiar a mensagem original palavra por palavra
- NUNCA adicionar "(variação 1)", "(variação 2)", "versão X" ou qualquer label
- NUNCA retornar texto idêntico ou muito parecido com o original
- NUNCA usar as mesmas frases na mesma ordem
- NUNCA manter a mesma estrutura de frases

✅ O QUE VOCÊ DEVE FAZER:
- Criar mensagens com o MESMO SENTIDO mas ESTRUTURA e PALAVRAS COMPLETAMENTE DIFERENTES
- REORGANIZAR a ordem das informações de forma radical
- Usar SINÔNIMOS criativos para CADA palavra importante
- VARIAR o comprimento das frases drasticamente
- MANTER o placeholder {nome} obrigatoriamente

📝 TÉCNICAS OBRIGATÓRIAS DE VARIAÇÃO:

1. SINONÍMIA RADICAL: Trocar TODAS as palavras-chave por equivalentes
   - "agradecer" → "expressar gratidão", "ser grato por", "reconhecer"
   - "confiança" → "parceria", "caminhada juntos", "jornada compartilhada"
   - "desejamos" → "esperamos que", "torcemos para", "queremos muito que"
   
2. REORGANIZAÇÃO ESTRUTURAL:
   - Começar pelo agradecimento OU pela saudação OU pelo desejo
   - Colocar os votos no início OU no final OU no meio
   - Usar parágrafos curtos OU um bloco contínuo
   
3. TRANSFORMAÇÃO DE FRASES:
   - Transformar AFIRMAÇÕES em PERGUNTAS RETÓRICAS
   - Ex: "Você merece o melhor" → "Você não merece o melhor?"
   - Quebrar frases longas em duas ou três curtas
   - Ex: "Desejo felicidades e muito sucesso nesta jornada" → "Felicidades! Que sua jornada seja repleta de sucesso."
   
4. INVERSÃO DE ORDEM:
   - Se a CTA (call-to-action) está no fim, mova para o início
   - Se a saudação está no início, mova para o meio ou fim
   - Reorganize completamente a sequência de informações

5. TOM: Alternar RADICALMENTE entre estilos
   - Formal → Casual → Emotivo → Motivacional → Objetivo → Poético

${emojiPositionInstructions}

${allVariations.length > 0 ? `
⚠️ VARIAÇÕES JÁ CRIADAS (NÃO REPETIR ESTILO NEM ESTRUTURA):
${allVariations.slice(-5).map((v, i) => `${i + 1}. ${v.substring(0, 100)}...`).join('\n')}
` : ''}

📋 FORMATO DE SAÍDA:
- Separe CADA variação com: ---VARIACAO---
- NÃO numere as variações
- Cada variação deve ser uma MENSAGEM COMPLETA e ÚNICA
- As variações devem ter no MÁXIMO 55% de similaridade com a original

Crie ${batchSize} variações RADICALMENTE DIFERENTES da original e entre si. O HASH de cada mensagem deve ser único!`;

      // Primeira tentativa com batch
      let batchVariations: string[] = [];
      let retryAttempt = 0;
      
      while (batchVariations.length < batchSize && retryAttempt < MAX_RETRIES) {
        console.log(`Batch attempt ${retryAttempt + 1}/${MAX_RETRIES}`);
        
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Mensagem original:\n\n${originalMessage}\n\nCrie ${batchSize - batchVariations.length} variações RADICALMENTE ÚNICAS usando técnicas de sinonímia, reorganização estrutural, transformação de frases e inversão de ordem.` }
            ],
            temperature: 1.0 + (retryAttempt * 0.1), // Aumentar temperatura a cada retry
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.error('Rate limit hit, waiting...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            retryAttempt++;
            continue;
          }
          if (response.status === 402) {
            throw new Error('Créditos insuficientes. Adicione créditos à sua conta Lovable.');
          }
          const errorText = await response.text();
          console.error('Lovable AI error:', response.status, errorText);
          retryAttempt++;
          continue;
        }

        const data = await response.json();
        const generatedText = data.choices?.[0]?.message?.content;

        if (!generatedText) {
          console.error('No content generated in attempt', retryAttempt + 1);
          retryAttempt++;
          continue;
        }

        // Processar e validar variações
        const rawVariations = generatedText
          .split('---VARIACAO---')
          .map((v: string) => v.trim())
          .filter((v: string) => v.length > 0);

        for (const variation of rawVariations) {
          if (batchVariations.length >= batchSize) break;
          
          const validation = isValidVariation(
            variation, 
            originalMessage, 
            [...allVariations, ...batchVariations],
            originalEmojiPosition
          );
          
          if (validation.valid) {
            batchVariations.push(variation);
            console.log(`Variation accepted (${batchVariations.length}/${batchSize})`);
          } else {
            console.log(`Variation rejected: ${validation.reason}`);
          }
        }
        
        retryAttempt++;
      }

      // Fallback inteligente com retry: gerar variações faltantes com técnicas específicas
      const techniques = ['pergunta', 'invertida', 'fragmentada', 'formal', 'casual', 'emotiva', 'curta', 'expandida', 'motivacional', 'poetica', 'objetiva'];
      let techniqueIndex = 0;
      let emergencyRetryCount = 0;
      const maxEmergencyRetries = batchSize * 3; // Mais tentativas antes de desistir

      while (batchVariations.length < batchSize && emergencyRetryCount < maxEmergencyRetries) {
        console.log(`Emergency fallback: generating variation (${batchVariations.length}/${batchSize}), attempt ${emergencyRetryCount + 1}`);
        
        const technique = techniques[techniqueIndex % techniques.length];
        techniqueIndex++;
        emergencyRetryCount++;
        
        const emergencyVariation = await generateEmergencyVariation(
          originalMessage,
          technique,
          LOVABLE_API_KEY,
          originalEmojiPosition,
          emergencyRetryCount
        );

        if (emergencyVariation) {
          const validation = isValidVariation(
            emergencyVariation, 
            originalMessage, 
            [...allVariations, ...batchVariations],
            originalEmojiPosition
          );
          
          if (validation.valid) {
            batchVariations.push(emergencyVariation);
            console.log(`Emergency variation accepted (technique: ${technique})`);
          } else {
            console.log(`Emergency variation rejected: ${validation.reason}`);
          }
        }
      }

      // NÃO usar fallback silencioso! Registrar slots que falharam
      const missingCount = batchSize - batchVariations.length;
      if (missingCount > 0) {
        console.warn(`WARNING: ${missingCount} variations could not be generated - leaving empty for manual review`);
        for (let i = 0; i < missingCount; i++) {
          const slotIndex = allVariations.length + batchVariations.length + i + 1; // +1 porque original é slot 0
          failedSlots.push(slotIndex);
          batchVariations.push(''); // Deixar vazio em vez de usar original
        }
      }

      allVariations.push(...batchVariations);
      console.log(`Batch ${batch + 1} complete: ${batchVariations.length} variations (${missingCount} empty)`);
    }

    const validVariationsCount = allVariations.filter(v => v.length > 0).length;
    const emptyCount = allVariations.filter(v => v.length === 0).length;
    
    console.log(`Total generated: ${validVariationsCount} valid variations, ${emptyCount} empty slots (requested: ${toGenerate})`);

    return new Response(
      JSON.stringify({ 
        success: true,
        variations: [originalMessage, ...allVariations],
        failedCount: emptyCount,
        failedSlots: failedSlots,
        message: emptyCount > 0 
          ? `${emptyCount} variação(ões) não puderam ser geradas. Por favor, preencha manualmente.`
          : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-variations:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
