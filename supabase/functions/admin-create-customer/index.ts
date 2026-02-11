import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // Route by action
    if (action === "unpause_domain") {
      const { domain_id } = body;
      if (!domain_id) throw new Error("domain_id is required");

      const { data, error } = await supabaseAdmin
        .from("email_domains")
        .update({
          status: "active",
          manual_pause: false,
          notes: "Manually unpaused by admin — 30d stats reset",
          total_bounces_30d: 0,
          total_complaints_30d: 0,
          total_sent_30d: 0,
          bounce_rate_30d: 0,
          complaint_rate_30d: 0,
        })
        .eq("id", domain_id)
        .select("id, domain, status")
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, domain: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_customer") {
      const { email, first_name, last_name, tenant_id, segment_ids } = body;

      const { data: customer, error: custErr } = await supabaseAdmin
        .from("crm_customers")
        .insert({ email, first_name, last_name, tenant_id })
        .select("id")
        .single();

      if (custErr) throw custErr;

      if (segment_ids?.length) {
        const rows = segment_ids.map((sid: string) => ({
          customer_id: customer.id,
          segment_id: sid,
        }));
        const { error: segErr } = await supabaseAdmin
          .from("customer_segments")
          .insert(rows);
        if (segErr) throw segErr;
      }

      return new Response(JSON.stringify({ customer_id: customer.id, segments_added: segment_ids?.length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legacy fallback: if no action specified, assume create_customer
    if (body.email) {
      const { email, first_name, last_name, tenant_id, segment_ids } = body;
      const { data: customer, error: custErr } = await supabaseAdmin
        .from("crm_customers")
        .insert({ email, first_name, last_name, tenant_id })
        .select("id")
        .single();
      if (custErr) throw custErr;

      if (segment_ids?.length) {
        const rows = segment_ids.map((sid: string) => ({
          customer_id: customer.id,
          segment_id: sid,
        }));
        const { error: segErr } = await supabaseAdmin
          .from("customer_segments")
          .insert(rows);
        if (segErr) throw segErr;
      }

      return new Response(JSON.stringify({ customer_id: customer.id, segments_added: segment_ids?.length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
