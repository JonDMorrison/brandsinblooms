
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "npm:stripe@14.21.0"
import { createClient } from "npm:@supabase/supabase-js@2.38.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // STEP 1: Check local Supabase subscription table FIRST (source of truth)
    const { data: localSubscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      logStep("Error fetching local subscription", { error: subError });
      throw new Error(`Database error: ${subError.message}`);
    }

    // If we have a local subscription, use it as the primary source of truth
    if (localSubscription) {
      logStep("Found local subscription", { 
        plan: localSubscription.plan, 
        endDate: localSubscription.end_date,
        userId: user.id 
      });

      const now = new Date();
      const endDate = new Date(localSubscription.end_date);
      const isActive = endDate > now;
      
      // For paid plans (sprout/bloom), verify with Stripe as secondary check
      if (localSubscription.plan === 'sprout' || localSubscription.plan === 'bloom') {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (stripeKey) {
          try {
            logStep("Verifying paid subscription with Stripe");
            const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
            const customers = await stripe.customers.list({ email: user.email, limit: 1 });
            
            if (customers.data.length > 0) {
              const customerId = customers.data[0].id;
              const subscriptions = await stripe.subscriptions.list({
                customer: customerId,
                status: "active",
                limit: 1,
              });
              
              if (subscriptions.data.length > 0) {
                const stripeSubscription = subscriptions.data[0];
                const stripeEndDate = new Date(stripeSubscription.current_period_end * 1000).toISOString().split('T')[0];
                
                // Update local subscription with Stripe data if different
                if (stripeEndDate !== localSubscription.end_date) {
                  logStep("Updating local subscription with Stripe data", { 
                    oldEndDate: localSubscription.end_date,
                    newEndDate: stripeEndDate 
                  });
                  
                  await supabaseClient
                    .from('subscriptions')
                    .update({
                      end_date: stripeEndDate,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', localSubscription.id);
                }
              } else {
                logStep("No active Stripe subscription found, but keeping local subscription");
              }
            }
          } catch (stripeError) {
            logStep("Stripe verification failed (using local data)", { error: stripeError.message });
          }
        }
      }

      // Return response based on local subscription
      const response = {
        subscribed: isActive,
        plan: localSubscription.plan,
        billing_interval: localSubscription.billing_interval,
        subscription_end: localSubscription.end_date,
        source: 'local_database'
      };

      logStep("Returning local subscription data", response);
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // STEP 2: No local subscription found, check Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("No Stripe key and no local subscription, returning unsubscribed");
      return new Response(JSON.stringify({ 
        subscribed: false, 
        source: 'no_subscription_found' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Checking Stripe for subscription");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found in Stripe, returning unsubscribed");
      return new Response(JSON.stringify({ 
        subscribed: false,
        source: 'no_stripe_customer' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let plan = null;
    let billingInterval = null;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0];
      logStep("Active Stripe subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      // Determine plan and billing interval from price
      const priceId = subscription.items.data[0].price.id;
      
      const priceToPlans: Record<string, { plan: string, interval: string }> = {
        'price_1RbUP6DmtxsdhOlWBTpvxBaZ': { plan: 'sprout', interval: 'monthly' },
        'price_1RbUQNDmtxsdhOlWf2vCkehE': { plan: 'sprout', interval: 'annual' },
        'price_1RbUUUDmtxsdhOlWrjI1a1jC': { plan: 'bloom', interval: 'monthly' },
        'price_1RbUVODmtxsdhOlW7mrK3Q9y': { plan: 'bloom', interval: 'annual' },
      };

      const planInfo = priceToPlans[priceId];
      if (planInfo) {
        plan = planInfo.plan;
        billingInterval = planInfo.interval;
      }
      
      logStep("Determined subscription details from Stripe", { priceId, plan, billingInterval });

      // Create local subscription record from Stripe data
      const { error: insertError } = await supabaseClient
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan: plan as 'sprout' | 'bloom',
          billing_interval: billingInterval as 'monthly' | 'annual',
          start_date: new Date(subscription.start_date * 1000).toISOString().split('T')[0],
          end_date: subscriptionEnd,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        logStep("Warning: Could not create local subscription record", { error: insertError });
      } else {
        logStep("Created local subscription record from Stripe data");
      }
    } else {
      logStep("No active Stripe subscription found");
    }

    const response = {
      subscribed: hasActiveSub,
      plan: plan,
      billing_interval: billingInterval,
      subscription_end: subscriptionEnd,
      source: 'stripe_api'
    };

    logStep("Returning Stripe subscription data", response);
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    
    // Return a safe fallback response instead of throwing
    return new Response(JSON.stringify({ 
      subscribed: false, 
      error: errorMessage,
      source: 'error_fallback'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Return 200 to prevent client-side errors
    });
  }
});
