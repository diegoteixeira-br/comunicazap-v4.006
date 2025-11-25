import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Group {
  id: string;
  subject: string;
  size: number;
  pictureUrl?: string;
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

    console.log('Fetching WhatsApp groups for user:', user.id);

    const { data: instance, error: instanceError } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (instanceError) {
      console.error('Database error:', instanceError);
      throw new Error(`Database error: ${instanceError.message}`);
    }

    if (!instance) {
      console.log('No WhatsApp instance found for user');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'WhatsApp não conectado. Por favor, conecte seu WhatsApp primeiro.',
          groups: [] 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (instance.status !== 'connected') {
      console.log('WhatsApp instance not connected, status:', instance.status);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'WhatsApp não está conectado. Por favor, escaneie o QR code primeiro.',
          groups: [] 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API not configured');
    }

    console.log('Calling Evolution API to fetch groups...');

    const response = await fetch(
      `${evolutionApiUrl}/group/fetchAllGroups/${instance.instance_name}?getParticipants=true`,
      {
        method: 'GET',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evolution API error:', errorText);
      throw new Error(`Failed to fetch groups: ${response.status}`);
    }

    const data = await response.json();
    console.log('Raw Evolution API response:', JSON.stringify(data).substring(0, 200));

    let groups: Group[] = [];

    // Evolution API pode retornar os grupos de diferentes formas
    if (Array.isArray(data)) {
      groups = data.map((group: any) => ({
        id: group.id,
        subject: group.subject || 'Sem nome',
        size: group.size || group.participants?.length || 0,
        pictureUrl: group.pictureUrl
      }));
    } else if (data.groups && Array.isArray(data.groups)) {
      groups = data.groups.map((group: any) => ({
        id: group.id,
        subject: group.subject || 'Sem nome',
        size: group.size || group.participants?.length || 0,
        pictureUrl: group.pictureUrl
      }));
    }

    // Filtrar apenas grupos válidos com ID terminando em @g.us
    groups = groups.filter(group => group.id && group.id.includes('@g.us'));

    console.log(`Found ${groups.length} valid groups`);

    return new Response(
      JSON.stringify({ 
        success: true,
        groups 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching groups:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        groups: [] 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
