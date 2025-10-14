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

    console.log('Creating instance for user:', user.id);

    // Verificar se já existe uma instância
    const { data: existingInstance } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingInstance && existingInstance.status === 'connected') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Instance already connected',
          instance: existingInstance 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL') ?? '';
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') ?? '';
    
    const instanceName = `user-${user.id.substring(0, 8)}-${Date.now()}`;

    console.log('Creating Evolution API instance:', instanceName);

    const createInstanceResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });

    if (!createInstanceResponse.ok) {
      const errorText = await createInstanceResponse.text();
      console.error('Evolution API error:', errorText);
      throw new Error(`Failed to create instance: ${errorText}`);
    }

    const evolutionData = await createInstanceResponse.json();
    console.log('Evolution API response:', evolutionData);

    // Get instance API key
    const instanceApiKey = evolutionData.hash?.apikey || evolutionData.apikey;
    console.log('Instance API key retrieved:', instanceApiKey ? 'Yes' : 'No');

    const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey
      }
    });

    const connectData = await connectResponse.json();
    console.log('Connect response:', connectData);

    const { data: instanceData, error: insertError } = await supabaseClient
      .from('whatsapp_instances')
      .upsert({
        user_id: user.id,
        instance_name: instanceName,
        instance_id: evolutionData.instance?.instanceId || instanceName,
        status: 'pending',
        qr_code: connectData.qrcode?.base64 || connectData.base64,
        qr_code_updated_at: new Date().toISOString(),
        api_key: instanceApiKey
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      throw insertError;
    }

    console.log('Instance created successfully:', instanceData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        instance: instanceData,
        qrCode: connectData.qrcode?.base64 || connectData.base64
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