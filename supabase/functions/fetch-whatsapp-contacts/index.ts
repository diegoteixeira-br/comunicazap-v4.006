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

    const response = await fetch(
      `${evolutionApiUrl}/chat/findContacts/${instance.instance_name}`,
      {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      console.error('Evolution API error:', response.status, await response.text());
      return new Response(
        JSON.stringify({ error: 'Failed to fetch contacts from WhatsApp' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawContacts = await response.json();
    console.log('Raw contacts received:', rawContacts.length || 0);
    
    // Log first contact structure for debugging
    if (rawContacts.length > 0) {
      console.log('Sample contact structure:', JSON.stringify(rawContacts[0]));
    }

    // Process and clean contacts
    const contacts: Contact[] = [];
    
    for (const chat of rawContacts) {
      // Skip groups (groups have @g.us suffix)
      if (chat.id && (chat.id.includes('@g.us') || chat.remoteJid?.includes('@g.us'))) {
        continue;
      }

      // Extract phone number - try multiple possible fields
      let phone = '';
      
      // Try remoteJid field first (most reliable)
      if (chat.remoteJid && typeof chat.remoteJid === 'string') {
        phone = chat.remoteJid.replace('@s.whatsapp.net', '');
      }
      // Try id field as fallback
      else if (chat.id && typeof chat.id === 'string' && chat.id.includes('@')) {
        phone = chat.id.replace('@s.whatsapp.net', '');
      }
      // Try number field
      else if (chat.number) {
        phone = chat.number.toString();
      }
      
      // Get contact name
      let name = chat.name || chat.pushName || chat.notifyName || phone;
      
      // Only add if we have a valid phone number (should be numeric and reasonable length)
      if (phone && phone.length >= 10 && /^\d+$/.test(phone)) {
        contacts.push({
          name: name,
          phone: phone
        });
      }
    }

    console.log('Processed contacts:', contacts.length);

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
