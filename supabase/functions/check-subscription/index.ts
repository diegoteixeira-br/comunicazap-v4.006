import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    // Criar um client com o token do usuário para autenticação
    const supabaseUserClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader }
        },
        auth: { persistSession: false }
      }
    );
    
    const { data: userData, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found");
      
      // Verificar se o usuário já existe no banco
      const { data: existingUser } = await supabaseClient
        .from('user_subscriptions')
        .select('trial_active, trial_ends_at, created_at')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!existingUser) {
        // Novo usuário - criar trial de 7 dias
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);
        
        logStep("Creating new trial for user", { trialEndsAt: trialEndsAt.toISOString() });
        
        await supabaseClient
          .from('user_subscriptions')
          .insert({
            user_id: user.id,
            status: 'trial',
            trial_active: true,
            trial_ends_at: trialEndsAt.toISOString(),
          });
        
        const trialDaysLeft = 7;
        
        return new Response(JSON.stringify({ 
          subscribed: false,
          trial_active: true,
          trial_ends_at: trialEndsAt.toISOString(),
          trial_days_left: trialDaysLeft,
          has_access: true,
          status: 'trial'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        // Usuário existente - verificar se trial ainda é válido
        const trialActive = existingUser.trial_active && 
                           existingUser.trial_ends_at && 
                           new Date(existingUser.trial_ends_at) > new Date();
        
        const trialDaysLeft = trialActive 
          ? Math.ceil((new Date(existingUser.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        logStep("Existing user without Stripe customer", { 
          trialActive, 
          trialDaysLeft,
          trialEndsAt: existingUser.trial_ends_at 
        });
        
        // Atualizar status
        await supabaseClient
          .from('user_subscriptions')
          .update({
            status: trialActive ? 'trial' : 'inactive',
          })
          .eq('user_id', user.id);
        
        return new Response(JSON.stringify({ 
          subscribed: false,
          trial_active: trialActive,
          trial_ends_at: existingUser.trial_ends_at,
          trial_days_left: trialDaysLeft,
          has_access: trialActive,
          status: trialActive ? 'trial' : 'inactive'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    logStep("Subscriptions retrieved", { 
      count: subscriptions.data.length,
      subscriptions: subscriptions.data.map((sub: any) => ({
        id: sub.id,
        status: sub.status,
        current_period_end: sub.current_period_end,
        current_period_start: sub.current_period_start,
        items: sub.items.data.map((item: any) => ({
          price_id: item.price.id,
          product: item.price.product
        }))
      }))
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionEnd = null;
    let stripeSubscriptionId = null;
    let stripePriceId = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      logStep("Processing subscription", { 
        id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        current_period_start: subscription.current_period_start
      });
      
      const periodEnd = subscription.current_period_end;
      const periodStart = subscription.current_period_start;
      
      if (!periodEnd || !periodStart) {
        logStep("Missing period timestamps, proceeding without dates", { periodEnd, periodStart });
      }
      
      if (periodEnd) {
        subscriptionEnd = new Date(periodEnd * 1000).toISOString();
      }
      const periodStartISO = periodStart ? new Date(periodStart * 1000).toISOString() : null;
      stripeSubscriptionId = subscription.id;
      stripePriceId = subscription.items.data[0].price.id;
      
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        endDate: subscriptionEnd,
        periodEnd,
        periodStart
      });
      
      // Atualizar status e desativar trial
      const { error: upsertError } = await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: stripePriceId,
          status: 'active',
          trial_active: false,
          current_period_start: periodStartISO,
          current_period_end: subscriptionEnd,
        }, { onConflict: 'user_id' });
        
      if (upsertError) {
        logStep("Error upserting subscription", { error: upsertError });
        throw upsertError;
      }
      
      logStep("Subscription updated in database");
    } else {
      logStep("No active subscription found");
      
      // Verificar se tem trial ativo
      const { data: trialData } = await supabaseClient
        .from('user_subscriptions')
        .select('trial_active, trial_ends_at')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Atualizar status no banco de dados
      await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: trialData?.trial_active ? 'trial' : 'inactive',
        }, { onConflict: 'user_id' });
    }

    // Buscar informações finais do trial
    const { data: finalData } = await supabaseClient
      .from('user_subscriptions')
      .select('trial_active, trial_ends_at, status')
      .eq('user_id', user.id)
      .maybeSingle();

    const trialActive = finalData?.trial_active && finalData?.trial_ends_at && new Date(finalData.trial_ends_at) > new Date();
    const trialDaysLeft = trialActive 
      ? Math.ceil((new Date(finalData.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_end: subscriptionEnd,
      trial_active: trialActive,
      trial_ends_at: finalData?.trial_ends_at,
      trial_days_left: trialDaysLeft,
      has_access: hasActiveSub || trialActive,
      status: finalData?.status || 'inactive'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
