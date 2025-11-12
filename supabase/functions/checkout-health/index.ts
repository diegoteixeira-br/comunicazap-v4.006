import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const health = {
    timestamp: new Date().toISOString(),
    stripe_key_configured: false,
    stripe_key_suffix: "",
    stripe_key_valid: false,
    auth_working: false,
    cors_enabled: true,
    user_email: "",
    errors: [] as string[],
  };

  try {
    // Check Stripe key
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      health.errors.push("STRIPE_SECRET_KEY não configurada");
    } else {
      health.stripe_key_configured = true;
      health.stripe_key_suffix = stripeKey.slice(-6);
      
      // Try to initialize Stripe and make a simple call
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        // Test with a simple API call
        await stripe.balance.retrieve();
        health.stripe_key_valid = true;
      } catch (stripeError: any) {
        health.errors.push(`Stripe Error: ${stripeError.message}`);
        if (stripeError.code === 'api_key_expired') {
          health.errors.push("⚠️ CHAVE STRIPE EXPIRADA - Precisa atualizar!");
        }
      }
    }

    // Check authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      health.errors.push("Sem header Authorization (ok para teste não autenticado)");
    } else {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      
      if (userError || !userData.user) {
        health.errors.push(`Auth Error: ${userError?.message || "Usuário não encontrado"}`);
      } else {
        health.auth_working = true;
        health.user_email = userData.user.email || "";
      }
    }

  } catch (error) {
    health.errors.push(`Erro geral: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Determine overall status
  const status = health.stripe_key_valid && !health.errors.some(e => e.includes("EXPIRADA")) 
    ? "healthy" 
    : "unhealthy";

  return new Response(JSON.stringify({ 
    status,
    ...health 
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status === "healthy" ? 200 : 503,
  });
});
