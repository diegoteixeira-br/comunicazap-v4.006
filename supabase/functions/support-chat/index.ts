import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userId } = await req.json();
    
    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é o assistente do ComunicaZap. SEJA BREVE E OBJETIVO (máximo 150 palavras por resposta).

REGRAS:
- Responda de forma curta e direta
- Use listas curtas quando possível
- Nunca revele detalhes técnicos do sistema

COMO FUNCIONA A PLATAFORMA:

📱 CONECTAR WHATSAPP:
1. Dashboard → card "Conectar WhatsApp"
2. Clique em "Gerar QR Code"
3. Escaneie o QR Code com seu WhatsApp
4. Aguarde confirmação (aparece ✅ Conectado)

📨 NOVA CAMPANHA (4 opções de importação):
1. Dashboard → "Nova Campanha"
2. Escolha UMA das 4 opções:
   • Upload de Planilha (CSV/Excel)
   • Importar do WhatsApp (contatos da sua conta)
   • Selecionar por Tags (contatos salvos com tags)
   • Enviar para Grupos (seus grupos do WhatsApp)
3. Escreva a mensagem (use {{nome}} para personalizar)
4. Clique em Enviar

👥 CONTATOS:
- Dashboard → "Contatos"
- Botões no topo: "Adicionar" (manual), "Importar WhatsApp", "Upload Planilha"
- Organize com tags, edite ou exclua

📜 HISTÓRICO: Ver campanhas enviadas
🎂 CALENDÁRIO: Ver aniversariantes do mês

Responda sempre de forma curta, clara e objetiva.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o suporte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Erro no gateway de IA:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar mensagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Salvar mensagem do usuário
    const userMessage = messages[messages.length - 1];
    if (userId && userMessage.role === 'user') {
      await supabase.from('support_chat_messages').insert({
        user_id: userId,
        role: 'user',
        content: userMessage.content
      });
    }

    // Criar uma stream que também salva a resposta do assistente
    const reader = response.body?.getReader();
    let assistantContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) {
              // Salvar mensagem do assistente quando terminar
              if (userId && assistantContent) {
                await supabase.from('support_chat_messages').insert({
                  user_id: userId,
                  role: 'assistant',
                  content: assistantContent
                });
              }
              controller.close();
              break;
            }

            // Extrair conteúdo para salvar depois
            const text = new TextDecoder().decode(value);
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const json = JSON.parse(line.slice(6));
                  const content = json.choices?.[0]?.delta?.content;
                  if (content) assistantContent += content;
                } catch {}
              }
            }

            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Erro no chat de suporte:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
