import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Contact {
  name: string;
  phone: string;
}

// Função para normalizar números brasileiros
const normalizePhone = (phone: string): string => {
  // Remove caracteres não numéricos
  let normalized = phone.replace(/\D/g, '');
  
  // Se não começa com 55 e tem 10-11 dígitos (celular/fixo brasileiro), adiciona 55
  if (!normalized.startsWith('55') && normalized.length >= 10 && normalized.length <= 11) {
    normalized = '55' + normalized;
  }
  
  return normalized;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching WhatsApp instance for user:', user.id);

    // Get user's WhatsApp instance
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, api_key')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .single();

    if (instanceError || !instance) {
      console.error('Instance error:', instanceError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found or not connected' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching contacts from Evolution API for instance:', instance.instance_name);

    // Fetch contacts from Evolution API
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      return new Response(
        JSON.stringify({ error: 'Evolution API configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch saved contacts (agenda completa)
    console.log('Fetching saved contacts...');
    const contactsResponse = await fetch(
      `${evolutionApiUrl}/chat/findContacts/${instance.instance_name}`,
      {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ where: {} }),
      }
    );

    // Fetch recent chats (conversas recentes)
    console.log('Fetching recent chats...');
    const chatsResponse = await fetch(
      `${evolutionApiUrl}/chat/findChats/${instance.instance_name}`,
      {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!contactsResponse.ok && !chatsResponse.ok) {
      console.error('Evolution API error - both endpoints failed');
      return new Response(
        JSON.stringify({ error: 'Failed to fetch contacts from WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const savedContacts = contactsResponse.ok ? await contactsResponse.json() : [];
    const recentChats = chatsResponse.ok ? await chatsResponse.json() : [];
    
    console.log('Saved contacts received:', savedContacts.length || 0);
    console.log('Recent chats received:', recentChats.length || 0);

    // Log sample contact structure for debugging
    if (savedContacts.length > 0) {
      console.log('Sample contact structure:', JSON.stringify(savedContacts[0], null, 2));
    }

    // Use Map to avoid duplicates
    const contactsMap = new Map<string, Contact>();
    
    let acceptedContacts = 0;
    let rejectedContacts = 0;
    
    // Process saved contacts first (priority)
    for (const contact of savedContacts) {
      // Use remoteJid (WhatsApp ID) instead of internal id
      const chatId = contact.remoteJid || contact.owner || contact.id || '';
      
      // Skip groups
      if (chatId.includes('@g.us')) continue;

      // Skip if doesn't look like a valid WhatsApp ID
      if (!chatId.includes('@') && !chatId.match(/^\d{10,}/)) {
        rejectedContacts++;
        if (rejectedContacts <= 5) {
          console.log('Rejected invalid chatId:', { chatId, contactId: contact.id });
        }
        continue;
      }

      // Extract phone number - remove WhatsApp suffixes and clean
      let phone = chatId
        .replace('@s.whatsapp.net', '')
        .replace('@c.us', '')
        .replace(/:.*$/, '');  // Remove :0, :1, etc.
      
      // Remove all non-numeric characters
      phone = phone.replace(/\D/g, '');
      
      // Get contact name (pushName tem prioridade)
      let name = contact.pushName || contact.name || contact.verifiedName || phone;
      
      // Log first few contacts for debugging
      if (acceptedContacts + rejectedContacts < 5) {
        console.log('Processing contact:', { 
          originalChatId: chatId,
          extractedPhone: phone,
          name: name 
        });
      }
      
      // Validate phone number (at least 10 digits)
      if (phone && phone.length >= 10 && /^\d{10,}$/.test(phone)) {
        // Normalize phone to include country code
        const normalizedPhone = normalizePhone(phone);
        
        // Log normalization for first few contacts
        if (acceptedContacts < 3) {
          console.log('Normalized:', { 
            before: phone, 
            after: normalizedPhone,
            name: name
          });
        }
        
        contactsMap.set(normalizedPhone, { name, phone: normalizedPhone });
        acceptedContacts++;
      } else {
        rejectedContacts++;
        if (rejectedContacts <= 5) {
          console.log('Rejected contact sample:', { chatId, phone, reason: 'invalid length or format' });
        }
      }
    }

    // Add recent chats that aren't already in contacts
    for (const chat of recentChats) {
      const chatId = chat.id || chat.remoteJid || '';
      
      // Skip groups
      if (chatId.includes('@g.us')) continue;

      // Extract phone number - same cleaning as above
      let phone = chatId
        .replace('@s.whatsapp.net', '')
        .replace('@c.us', '')
        .replace(/:.*$/, '');
      
      phone = phone.replace(/\D/g, '');
      
      // Only add if not already in map
      if (phone && phone.length >= 8 && /^\d{8,}$/.test(phone)) {
        const normalizedPhone = normalizePhone(phone);
        if (!contactsMap.has(normalizedPhone)) {
          let name = chat.name || chat.pushName || chat.subject || chat.notifyName || phone;
          contactsMap.set(normalizedPhone, { name, phone: normalizedPhone });
          acceptedContacts++;
        }
      } else {
        rejectedContacts++;
      }
    }

    const contacts = Array.from(contactsMap.values());
    console.log(`Contacts processing: ${acceptedContacts} accepted, ${rejectedContacts} rejected`);
    console.log('Total unique contacts processed:', contacts.length);

    return new Response(
      JSON.stringify({ contacts }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in fetch-whatsapp-contacts function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
