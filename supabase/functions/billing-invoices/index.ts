// Read-only: the signed-in user's most recent Stripe invoices for
// Settings > Billing. Never creates or updates Stripe or database records.
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InvoiceSummary = {
  id: string;
  created: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  url: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function describe(invoice: Stripe.Invoice): string {
  const line = invoice.lines?.data?.[0];
  return (line?.description || invoice.description || invoice.number || "Invoice").slice(0, 120);
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
    if (!customerId) return json({ invoices: [], reason: "no_customer" });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const list = await stripe.invoices.list({ customer: customerId, limit: 6 });
    const invoices: InvoiceSummary[] = list.data
      .filter((invoice) => invoice.status !== "draft")
      .map((invoice) => ({
        id: invoice.id,
        created: new Date(invoice.created * 1000).toISOString(),
        amount: (invoice.status === "paid" ? invoice.amount_paid : invoice.amount_due) / 100,
        currency: invoice.currency,
        status: invoice.status ?? "open",
        description: describe(invoice),
        url: invoice.hosted_invoice_url ?? null,
      }));

    return json({ invoices });
  } catch (error) {
    console.error("[billing-invoices]", error instanceof Error ? error.message : error);
    return json({ error: "Billing history could not be loaded." }, 500);
  }
});
