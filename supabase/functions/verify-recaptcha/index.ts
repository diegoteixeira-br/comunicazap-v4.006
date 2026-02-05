const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, expectedAction } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const secretKey = Deno.env.get('RECAPTCHA_SECRET_KEY');
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Google reCAPTCHA Enterprise API
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const verifyResult = await verifyResponse.json();
    
    console.log('reCAPTCHA verification result:', JSON.stringify(verifyResult));

    if (!verifyResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Verificação reCAPTCHA falhou',
          details: verifyResult['error-codes'] || []
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check score (Enterprise returns score, standard v3 also returns score)
    const score = verifyResult.score ?? 1.0;
    const minScore = 0.5; // Threshold - adjust as needed

    if (score < minScore) {
      console.log(`reCAPTCHA score too low: ${score}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Atividade suspeita detectada. Tente novamente.',
          score 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify action if provided
    if (expectedAction && verifyResult.action && verifyResult.action !== expectedAction) {
      console.log(`Action mismatch: expected ${expectedAction}, got ${verifyResult.action}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Ação inválida' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        score,
        hostname: verifyResult.hostname 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
