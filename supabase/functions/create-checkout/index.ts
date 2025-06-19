
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Check for Stripe secret key first
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY is not configured");
      return new Response(JSON.stringify({ 
        error: "Stripe configuration missing. Please contact support.",
        details: "STRIPE_SECRET_KEY environment variable is not set"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    logStep("Stripe key verified");

    // Check Supabase environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      logStep("ERROR: Supabase environment variables missing", { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseKey 
      });
      return new Response(JSON.stringify({ 
        error: "Server configuration error",
        details: "Missing Supabase configuration"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, { 
      auth: { persistSession: false } 
    });

    // Check authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header provided");
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        details: "No authorization header found"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("Authorization header found");

    // Authenticate user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("ERROR: Authentication failed", { error: userError.message });
      return new Response(JSON.stringify({ 
        error: "Authentication failed",
        details: userError.message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    const user = userData.user;
    if (!user?.email) {
      logStep("ERROR: User not authenticated or email not available");
      return new Response(JSON.stringify({ 
        error: "User email not available",
        details: "User must have a valid email address"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      logStep("ERROR: Invalid request body", { error: error.message });
      return new Response(JSON.stringify({ 
        error: "Invalid request format",
        details: "Request body must be valid JSON"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { plan, billingInterval } = requestBody;
    if (!plan || !billingInterval) {
      logStep("ERROR: Missing plan or billing interval", { plan, billingInterval });
      return new Response(JSON.stringify({ 
        error: "Plan and billing interval are required",
        details: "Both 'plan' and 'billingInterval' must be provided"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    logStep("Request data received", { plan, billingInterval });

    // Initialize Stripe
    let stripe;
    try {
      stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
      logStep("Stripe initialized successfully");
    } catch (error) {
      logStep("ERROR: Failed to initialize Stripe", { error: error.message });
      return new Response(JSON.stringify({ 
        error: "Stripe initialization failed",
        details: error.message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Check if customer exists
    let customerId;
    try {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Existing customer found", { customerId });
      } else {
        logStep("No existing customer found, will create new one");
      }
    } catch (error) {
      logStep("ERROR: Failed to check existing customers", { error: error.message });
      return new Response(JSON.stringify({ 
        error: "Failed to process customer information",
        details: error.message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Price mapping with validation
    const priceMapping = {
      'sprout_monthly': 'price_1RbUP6DmtxsdhOlWBTpvxBaZ',
      'sprout_annual': 'price_1RbUQNDmtxsdhOlWf2vCkehE',
      'bloom_monthly': 'price_1RbUUUDmtxsdhOlWrjI1a1jC',
      'bloom_annual': 'price_1RbUVODmtxsdhOlW7mrK3Q9y',
    };

    const priceKey = `${plan}_${billingInterval}` as keyof typeof priceMapping;
    const priceId = priceMapping[priceKey];
    
    if (!priceId) {
      logStep("ERROR: Invalid plan/billing combination", { priceKey, availableKeys: Object.keys(priceMapping) });
      return new Response(JSON.stringify({ 
        error: `Invalid plan/billing combination: ${priceKey}`,
        details: `Available combinations: ${Object.keys(priceMapping).join(', ')}`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    logStep("Price ID determined", { priceKey, priceId });

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "http://localhost:3000";
    logStep("Origin determined", { origin });
    
    // Create checkout session
    try {
      const sessionConfig = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription" as const,
        success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}&billing=${billingInterval}`,
        cancel_url: `${origin}/pricing?checkout=cancelled`,
        metadata: {
          user_id: user.id,
          plan: plan,
          billing_interval: billingInterval
        }
      };

      logStep("Creating checkout session with config", { 
        priceId, 
        customerId: customerId || 'new', 
        email: user.email 
      });

      const session = await stripe.checkout.sessions.create(sessionConfig);

      logStep("Checkout session created successfully", { 
        sessionId: session.id, 
        url: session.url?.substring(0, 50) + '...' 
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (stripeError: any) {
      logStep("ERROR: Stripe checkout session creation failed", { 
        error: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        param: stripeError.param
      });
      
      return new Response(JSON.stringify({ 
        error: "Failed to create checkout session. Please try again.",
        details: stripeError.message,
        stripeErrorType: stripeError.type
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unexpected error in create-checkout", { 
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred. Please try again.",
      details: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
