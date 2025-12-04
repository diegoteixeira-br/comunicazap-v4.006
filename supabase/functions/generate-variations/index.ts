import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PER_BATCH = 10;

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

// Validar se uma variação é aceitável
function isValidVariation(
  variation: string, 
  original: string, 
  existingVariations: string[]
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
  
  // Rejeitar se muito similar à original (>70%)
  const similarityToOriginal = calculateSimilarity(variation, original);
  if (similarityToOriginal > 0.7) {
    return { valid: false, reason: 'muito_similar_original' };
  }
  
  // Rejeitar se é duplicata de uma existente
  for (const existing of existingVariations) {
    const similarity = calculateSimilarity(variation, existing);
    if (similarity > 0.8) {
      return { valid: false, reason: 'duplicata' };
    }
  }
  
  return { valid: true };
}

// Gerar variação de emergência com IA usando técnica específica
async function generateEmergencyVariation(
  original: string,
  technique: string,
  apiKey: string
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
  };

  const instruction = techniques[technique] || techniques['casual'];

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
- Use palavras DIFERENTES da original
- Retorne APENAS a mensagem reescrita, sem explicações` 
          },
          { role: 'user', content: original }
        ],
        temperature: 1.0,
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

    const variationCount = Math.max(1, count);
    const toGenerate = variationCount - 1;

    if (toGenerate === 0) {
      return new Response(
        JSON.stringify({ success: true, variations: [originalMessage] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Generating ${toGenerate} variations for user ${user.id}`);

    const totalBatches = Math.ceil(toGenerate / MAX_PER_BATCH);
    const allVariations: string[] = [];

    for (let batch = 0; batch < totalBatches; batch++) {
      const isLastBatch = batch === totalBatches - 1;
      const batchSize = isLastBatch 
        ? toGenerate - (batch * MAX_PER_BATCH)
        : MAX_PER_BATCH;

      console.log(`Generating batch ${batch + 1}/${totalBatches} with ${batchSize} variations`);

      const systemPrompt = `Você é um COPYWRITER ESPECIALISTA em criar VARIAÇÕES ÚNICAS de mensagens para WhatsApp.

🚫 REGRAS ABSOLUTAS - NUNCA FAZER:
- NUNCA copiar a mensagem original palavra por palavra
- NUNCA adicionar "(variação 1)", "(variação 2)", "versão X" ou qualquer label
- NUNCA retornar texto idêntico ou muito parecido com o original
- NUNCA usar as mesmas frases na mesma ordem

✅ O QUE VOCÊ DEVE FAZER:
- Criar mensagens com o MESMO SENTIDO mas ESTRUTURA e PALAVRAS DIFERENTES
- REORGANIZAR a ordem das informações
- Usar SINÔNIMOS criativos para cada palavra importante
- VARIAR o comprimento das frases
- MANTER o placeholder {nome} obrigatoriamente

📝 TÉCNICAS OBRIGATÓRIAS DE VARIAÇÃO:
1. SINONÍMIA: Trocar palavras por equivalentes
   - "agradecer" → "expressar gratidão", "ser grato por"
   - "confiança" → "parceria", "caminhada juntos"
   - "desejamos" → "esperamos que", "torcemos para"
   
2. REORGANIZAÇÃO: Mudar a estrutura
   - Começar pelo agradecimento OU pela saudação
   - Colocar os votos no início OU no final
   - Usar parágrafos curtos OU um bloco contínuo
   
3. EXPANSÃO/CONTRAÇÃO:
   - Adicionar detalhes em mensagens curtas
   - Resumir mensagens longas mantendo essência
   
4. TOM: Alternar entre estilos
   - Formal → Casual → Emotivo → Motivacional

${hasEmojis ? `
🎭 EMOJIS (original tem ${emojiCount}):
- ~70% das variações: COM emojis DIFERENTES do original
- ~30% das variações: SEM emojis (compensar com palavras expressivas)
` : `
🎭 EMOJIS (original não tem):
- ~70% das variações: SEM emojis (manter estilo)
- ~30% das variações: COM emojis sutis e apropriados
`}

${allVariations.length > 0 ? `
⚠️ VARIAÇÕES JÁ CRIADAS (NÃO REPETIR ESTILO):
${allVariations.slice(-5).map((v, i) => `${i + 1}. ${v.substring(0, 80)}...`).join('\n')}
` : ''}

📋 FORMATO DE SAÍDA:
- Separe CADA variação com: ---VARIACAO---
- NÃO numere as variações
- Cada variação deve ser uma MENSAGEM COMPLETA

Crie ${batchSize} variações COMPLETAMENTE DIFERENTES da original e entre si.`;

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
            { role: 'user', content: `Mensagem original:\n\n${originalMessage}\n\nCrie ${batchSize} variações ÚNICAS usando técnicas de sinonímia, reorganização e variação de tom.` }
          ],
          temperature: 0.95,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Limite de taxa excedido. Tente novamente em alguns instantes.');
        }
        if (response.status === 402) {
          throw new Error('Créditos insuficientes. Adicione créditos à sua conta Lovable.');
        }
        const errorText = await response.text();
        console.error('Lovable AI error:', response.status, errorText);
        throw new Error('Erro ao gerar variações com IA');
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content;

      if (!generatedText) {
        throw new Error('No content generated');
      }

      // Processar e validar variações
      const rawVariations = generatedText
        .split('---VARIACAO---')
        .map((v: string) => v.trim())
        .filter((v: string) => v.length > 0);

      const batchVariations: string[] = [];
      
      for (const variation of rawVariations) {
        if (batchVariations.length >= batchSize) break;
        
        const validation = isValidVariation(variation, originalMessage, [...allVariations, ...batchVariations]);
        
        if (validation.valid) {
          batchVariations.push(variation);
          console.log(`Variation accepted (${batchVariations.length}/${batchSize})`);
        } else {
          console.log(`Variation rejected: ${validation.reason}`);
        }
      }

      // Fallback inteligente: gerar variações faltantes com técnicas específicas
      const techniques = ['formal', 'casual', 'emotiva', 'curta', 'expandida', 'motivacional', 'poetica', 'objetiva'];
      let techniqueIndex = 0;
      let retryCount = 0;
      const maxRetries = batchSize * 2;

      while (batchVariations.length < batchSize && retryCount < maxRetries) {
        console.log(`Fallback: generating emergency variation (${batchVariations.length}/${batchSize})`);
        
        const technique = techniques[techniqueIndex % techniques.length];
        techniqueIndex++;
        retryCount++;
        
        const emergencyVariation = await generateEmergencyVariation(
          originalMessage,
          technique,
          LOVABLE_API_KEY
        );

        if (emergencyVariation) {
          const validation = isValidVariation(
            emergencyVariation, 
            originalMessage, 
            [...allVariations, ...batchVariations]
          );
          
          if (validation.valid) {
            batchVariations.push(emergencyVariation);
            console.log(`Emergency variation accepted (technique: ${technique})`);
          } else {
            console.log(`Emergency variation rejected: ${validation.reason}`);
          }
        }
      }

      // Se ainda faltam, usar a original (último recurso)
      while (batchVariations.length < batchSize) {
        console.log('Warning: Using original as last resort fallback');
        batchVariations.push(originalMessage);
      }

      allVariations.push(...batchVariations);
      console.log(`Batch ${batch + 1} complete: ${batchVariations.length} variations`);
    }

    console.log(`Total generated: ${allVariations.length} variations (requested: ${toGenerate})`);

    return new Response(
      JSON.stringify({ 
        success: true,
        variations: [originalMessage, ...allVariations]
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
