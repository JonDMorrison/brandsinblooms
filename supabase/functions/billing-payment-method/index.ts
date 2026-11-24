// Read-only: the signed-in user's default Stripe card (brand, last 4, expiry)
// so Settings > Billing can show the real card and warn when it has expired.
// Never creates or updates Stripe or database records.
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CardSummary = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toCard(method: Stripe.PaymentMethod | null | undefined): CardSummary | null {
  if (!method || method.type !== "card" || !method.card) return null;
  return {
    brand: method.card.brand,
    last4: method.card.last4,
    exp_month: method.card.exp_month,
    exp_year: method.card.exp_year,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Billing is not configured." }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Not signed in." }, 401);

    const { data: subscription } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerId = subscription?.stripe_customer_id;
    if (!customerId) return json({ card: null, reason: "no_customer" });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if ("deleted" in customer && customer.deleted) {
      return json({ card: null, reason: "no_customer" });
    }

    const defaultMethod = customer.invoice_settings?.default_payment_method;
    let card = typeof defaultMethod === "object" ? toCard(defaultMethod) : null;
    let isDefault = Boolean(card);

    if (!card) {
      const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
      card = toCard(methods.data[0]);
      isDefault = false;
    }

    return json({ card, is_default: isDefault });
  } catch (error) {
    console.error("[billing-payment-method]", error instanceof Error ? error.message : error);
    return json({ error: "The card on file could not be loaded." }, 500);
  }
});
