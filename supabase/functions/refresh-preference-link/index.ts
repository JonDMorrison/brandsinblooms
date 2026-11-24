import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { resolveEmailPreferenceLinks } from "../_shared/emailPreferenceLinks.ts";

/**
 * "Get a new link" on the email preferences page (QA pass 4 #9).
 *
 * Someone holding an expired preference link proves they received an email
 * from the store: the token is an unguessable secret delivered only to that
 * customer's address. For such a token this returns a current preferences
 * link for the same customer (reusing a valid token when one exists, see
 * resolveEmailPreferenceLinks). No email is sent and nothing is returned for
 * unknown tokens, deleted or merged customers, or a changed email address.
 */

const corsHeaders = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return respond({ refreshed: false, error: "Method not allowed" }, 405);
  }

  try {
    const { token } = await req.json();
    if (typeof token !== "string" || token.trim().length < 20) {
      return respond({ refreshed: false, error: "Token is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokenRow, error: tokenError } = await supabase
      .from("crm_email_preference_tokens")
      .select("tenant_id, customer_id, email")
      .eq("token", token.trim())
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!tokenRow) return respond({ refreshed: false, error: "Token not found" });

    const { data: customer, error: customerError } = await supabase
      .from("crm_customers")
      .select("id, email")
      .eq("id", tokenRow.customer_id)
      .eq("tenant_id", tokenRow.tenant_id)
      .is("deleted_at", null)
      .is("merged_into_customer_id", null)
      .maybeSingle();

    if (customerError) throw customerError;
    const sameAddress =
      customer?.email &&
      customer.email.trim().toLowerCase() ===
        String(tokenRow.email ?? "").trim().toLowerCase();
    if (!customer || !sameAddress) {
      return respond({ refreshed: false, error: "Customer not found" });
    }

    const links = await resolveEmailPreferenceLinks(tokenRow.tenant_id, {
      id: customer.id,
      email: customer.email,
    });
    const freshToken = new URL(links.preferencesUrl).searchParams.get("token");
    if (!freshToken) throw new Error("No preference token was issued");

    return respond({ refreshed: true, token: freshToken });
  } catch (error) {
    console.error("[refresh-preference-link] failed:", error);
    return respond({ refreshed: false, error: "Unable to refresh the link" }, 500);
  }
});
