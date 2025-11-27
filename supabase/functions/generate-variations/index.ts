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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { originalMessage } = await req.json();

    if (!originalMessage || !originalMessage.trim()) {
      throw new Error('Original message is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating variations with Lovable AI for user:', user.id);

    // Prompt otimizado para gerar variações
    const systemPrompt = `Você é um especialista em copywriting para WhatsApp. Sua tarefa é criar 2 variações de mensagens que mantenham:
- O mesmo significado e propósito da mensagem original
- O mesmo tom (formal/informal/vendas/amigável)
- Placeholders como {nome} devem ser preservados exatamente
- Tamanho similar à mensagem original
- Emojis apenas se a original tiver (mantenha o estilo)
- Linguagem natural e brasileira

IMPORTANTE: Retorne APENAS as 2 variações, uma por linha, sem numeração ou prefixos.`;

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
          { role: 'user', content: `Mensagem original:\n\n${originalMessage}\n\nCrie 2 variações diferentes desta mensagem.` }
        ],
        temperature: 0.8,
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

    // Processar as variações geradas (dividir por linha e limpar)
    const variations = generatedText
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 2); // Garantir apenas 2 variações

    // Se não conseguiu gerar 2 variações, criar uma baseada na original
    while (variations.length < 2) {
      variations.push(originalMessage);
    }

    console.log('Generated variations:', variations.length);

    return new Response(
      JSON.stringify({ 
        success: true,
        variations: [originalMessage, ...variations] // Original + 2 variações
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-variations:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
