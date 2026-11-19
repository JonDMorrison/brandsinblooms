import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Check for required environment variables first
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY missing");
      return new Response(
        JSON.stringify({
          error: "Payment system configuration error. Please try again later.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      logStep("ERROR: Supabase environment variables missing");
      return new Response(
        JSON.stringify({
          error: "Server configuration error. Please try again later.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    logStep("Environment variables verified");

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // Check authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(
        JSON.stringify({
          error: "Authentication required. Please sign in and try again.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    // Authenticate user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token);

    if (userError || !userData.user?.email) {
      logStep("ERROR: Authentication failed", { error: userError?.message });
      return new Response(
        JSON.stringify({
          error: "Authentication failed. Please sign in and try again.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      logStep("ERROR: Invalid request body");
      return new Response(
        JSON.stringify({
          error: "Invalid request format. Please try again.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const { plan, billingInterval, currency: rawCurrency } = requestBody;
    if (!plan || !billingInterval) {
      logStep("ERROR: Missing plan or billing interval", {
        plan,
        billingInterval,
      });
      return new Response(
        JSON.stringify({
          error: "Plan and billing interval are required.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Currency: 'usd' default. Prices are created with USD primary +
    // CAD currency_options, so passing currency: 'cad' lets Stripe
    // pick the matching unit_amount automatically.
    const currency = (rawCurrency ?? "usd").toString().toLowerCase();
    if (currency !== "usd" && currency !== "cad") {
      logStep("ERROR: Invalid currency", { currency });
      return new Response(
        JSON.stringify({ error: "Currency must be 'usd' or 'cad'." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    logStep("Request data received", { plan, billingInterval, currency });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    logStep("Stripe initialized");

    // crm-r2-F31: the Stripe customer is the one stored for this account, or a new one created here
    // and tagged with the account (metadata.user_id). It is never looked up by email: another Stripe
    // customer can carry the same address. A failed read fails closed.
    let customerId: string | undefined;
    try {
      const { data: sub, error: subError } = await supabaseClient
        .from('subscriptions')
        .select('id, stripe_customer_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        throw new Error(`Failed to read the stored Stripe customer: ${subError.message}`);
      }

      if (sub?.stripe_customer_id) {
        customerId = sub.stripe_customer_id;
        logStep("Using stored Stripe customer ID", { customerId });
      } else if (sub?.id) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { user_id: user.id },
        });

        // Store it only where none is stored yet; if a parallel checkout stored one first, use that.
        const { data: stored, error: storeError } = await supabaseClient
          .from('subscriptions')
          .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
          .eq('id', sub.id)
          .is('stripe_customer_id', null)
          .select('stripe_customer_id');

        if (storeError) {
          throw new Error(`Failed to store the Stripe customer: ${storeError.message}`);
        }

        if (stored && stored.length === 1) {
          customerId = customer.id;
          logStep("Created and stored Stripe customer", { customerId });
        } else {
          const { data: current, error: currentError } = await supabaseClient
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('id', sub.id)
            .maybeSingle();
          if (currentError || !current?.stripe_customer_id) {
            throw new Error("Stripe customer could not be stored");
          }
          customerId = current.stripe_customer_id;
          logStep("Using Stripe customer stored by a parallel checkout", { customerId });
        }
      } else {
        // No row to store a customer on: Checkout creates the customer from customer_email and the
        // webhook binds the subscription through its metadata.user_id.
        logStep("No subscriptions row; Checkout will create the customer");
      }
    } catch (error) {
      logStep("ERROR: Failed to resolve Stripe customer", { error: error instanceof Error ? error.message : String(error) });
      return new Response(
        JSON.stringify({
          error: "Payment system error. Please try again.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    // Price resolution via Stripe lookup_keys. Each canonical tier
    // price (seed/sprout/bloom/thrive × monthly/annual) is registered
    // in Stripe with lookup_key='<plan>_<interval>' and USD primary +
    // CAD currency_options for numerical parity. This means the same
    // edge function works in test and live mode without env-var price
    // IDs — Stripe resolves the right price from the active key's
    // account.
    //
    // The legacy 'bloomsuite' (single-plan annual) path is preserved
    // for grandfathered customers using the hardcoded $2999/yr
    // bloomsuite_year price.
    let priceId: string;
    const isLegacyBloomsuite = plan === "bloomsuite" && billingInterval === "year";
    if (isLegacyBloomsuite) {
      priceId = "price_1S6VGuDmtxsdhOlWxO4LCYXU";
      logStep("Price ID determined (legacy bloomsuite_year)", { priceId });
    } else {
      const lookupKey = `${plan}_${billingInterval}`;
      const prices = await stripe.prices.list({
        lookup_keys: [lookupKey],
        limit: 1,
      });
      if (prices.data.length === 0) {
        logStep("ERROR: No Stripe price for lookup_key", { lookupKey });
        return new Response(
          JSON.stringify({
            error: `Invalid plan selection: lookup_key not found (${lookupKey})`,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          },
        );
      }
      priceId = prices.data[0].id;
      logStep("Price ID determined", { lookupKey, priceId });
    }

    // Get origin for redirect URLs
    const origin =
      req.headers.get("origin") ||
      "https://be93ec50-2043-42c4-b91c-5d7c30f0ef2d.lovableproject.com";
    logStep("Origin determined", { origin });

    // Create checkout session
    try {
      const sessionConfig = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        // Stripe resolves the right unit_amount from the price's
        // currency_options when currency is set on the session and
        // matches one of the price's supported currencies.
        currency,
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
          billing_interval: billingInterval,
          currency,
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
            plan: plan,
            billing_interval: billingInterval,
            currency,
          },
        },
      };

      logStep("Creating checkout session", {
        priceId,
        customerId: customerId || "new",
        email: user.email,
      });

      const session = await stripe.checkout.sessions.create(sessionConfig);

      logStep("Checkout session created successfully", {
        sessionId: session.id,
        url: session.url,
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (stripeError: any) {
      logStep("ERROR: Stripe checkout creation failed", {
        error: stripeError.message,
        type: stripeError.type,
      });

      return new Response(
        JSON.stringify({
          error: "Failed to create checkout session. Please try again.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unexpected error", { message: errorMessage });

    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred. Please try again.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
