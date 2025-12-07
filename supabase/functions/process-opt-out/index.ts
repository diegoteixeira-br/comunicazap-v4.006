import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza número de telefone BR para comparação
const normalizePhoneForComparison = (phone: string): string => {
  // Remove @s.whatsapp.net e caracteres não numéricos
  let normalized = phone.replace(/@s\.whatsapp\.net/g, '').replace(/\D/g, '');
  
  // Adiciona código do Brasil se não tiver
  if (!normalized.startsWith('55') && normalized.length <= 11) {
    normalized = '55' + normalized;
  }
  
  // Se tem 12 dígitos (antigo formato sem 9), adiciona o 9
  if (normalized.startsWith('55') && normalized.length === 12) {
    const ddd = normalized.slice(2, 4);
    const number = normalized.slice(4);
    if (number.length === 8) {
      normalized = `55${ddd}9${number}`;
    }
  }
  
  return normalized;
};

// Gera variações possíveis de um número para busca
const generatePhoneVariations = (normalizedPhone: string): string[] => {
  const variations: string[] = [normalizedPhone];
  
  // Variação sem código do país (55)
  if (normalizedPhone.startsWith('55')) {
    variations.push(normalizedPhone.slice(2));
  }
  
  // Variação sem o 9 adicional (formato antigo)
  if (normalizedPhone.startsWith('55') && normalizedPhone.length === 13) {
    const ddd = normalizedPhone.slice(2, 4);
    const number = normalizedPhone.slice(5); // pula o 9
    variations.push(`55${ddd}${number}`);
    variations.push(`${ddd}${number}`);
    variations.push(`${ddd}9${number}`);
  }
  
  // Variação com o 9 adicional
  if (normalizedPhone.startsWith('55') && normalizedPhone.length === 12) {
    const ddd = normalizedPhone.slice(2, 4);
    const number = normalizedPhone.slice(4);
    variations.push(`55${ddd}9${number}`);
    variations.push(`${ddd}9${number}`);
    variations.push(`${ddd}${number}`);
  }
  
  // Remove duplicatas
  return [...new Set(variations)];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============= SECURITY: Validate webhook secret =============
    const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('N8N_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { instanceName, sender, message, secret } = body;

    // Validate secret token
    if (secret !== webhookSecret) {
      console.error('Invalid webhook secret provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
      
      // Normalizar o número do WhatsApp para comparação
      const normalizedPhone = normalizePhoneForComparison(sender);
      const phoneVariations = generatePhoneVariations(normalizedPhone);
      
      console.log('Phone normalization:', {
        original: sender,
        normalized: normalizedPhone,
        variations: phoneVariations
      });
      
      // Buscar e atualizar TODOS os contatos que correspondem a qualquer variação
      let contactsUpdated = 0;
      
      for (const variation of phoneVariations) {
        const { data: updatedContacts, error: updateError } = await supabaseClient
          .from('contacts')
          .update({ 
            status: 'unsubscribed',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', instance.user_id)
          .eq('phone_number', variation)
          .select('id');
        
        if (!updateError && updatedContacts && updatedContacts.length > 0) {
          contactsUpdated += updatedContacts.length;
          console.log(`Updated ${updatedContacts.length} contact(s) with phone: ${variation}`);
        }
      }
      
      // Se nenhum contato foi encontrado, criar um novo como unsubscribed
      if (contactsUpdated === 0) {
        console.log('No existing contact found, creating as unsubscribed');
        const { error: insertError } = await supabaseClient
          .from('contacts')
          .insert({
            user_id: instance.user_id,
            phone_number: normalizedPhone,
            status: 'unsubscribed'
          });
        
        if (insertError && insertError.code !== '23505') {
          console.error('Error creating unsubscribed contact:', insertError);
        } else {
          contactsUpdated = 1;
        }
      }
      
      // Salvar na blocked_contacts com número normalizado (sem @s.whatsapp.net)
      const { error: blockError } = await supabaseClient
        .from('blocked_contacts')
        .insert({
          user_id: instance.user_id,
          phone_number: normalizedPhone, // Sempre salvar normalizado
          reason: `Opt-out via message: "${message}"`
        });

      // Ignore duplicate key errors (contact already blocked)
      if (blockError && blockError.code !== '23505') {
        console.error('Error blocking contact:', blockError);
      }
      
      console.log(`Contact unsubscribed successfully. Total contacts updated: ${contactsUpdated}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Contact blocked successfully',
          blocked: true,
          contactsUpdated,
          normalizedPhone
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
