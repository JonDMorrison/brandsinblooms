import { createClient } from "npm:@supabase/supabase-js@2.7.1";
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

    if (action === "reset_campaign") {
      const { campaign_id } = body;
      if (!campaign_id) throw new Error("campaign_id is required");

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("crm_campaigns")
        .update({
          status: "scheduled",
          failure_reason: null,
          send_error: null,
          send_blocked_reason: null,
          claim_token: null,
          sending_started_at: null,
        })
        .eq("id", campaign_id)
        .select("id, status")
        .single();

      if (updErr) throw updErr;
      return new Response(JSON.stringify({ success: true, campaign: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "finalize_campaign") {
      const { campaign_id } = body;
      if (!campaign_id) throw new Error("campaign_id is required");

      // Check if all email_send_jobs are completed
      const { data: pendingJobs } = await supabaseAdmin
        .from("email_send_jobs")
        .select("id")
        .eq("campaign_id", campaign_id)
        .in("status", ["pending", "processing"])
        .limit(1);

      if (pendingJobs && pendingJobs.length > 0) {
        throw new Error("Campaign still has pending/processing jobs — cannot finalize yet");
      }

      // Compute metrics from email_send_jobs
      const { data: allJobs } = await supabaseAdmin
        .from("email_send_jobs")
        .select("emails_sent, emails_failed, status")
        .eq("campaign_id", campaign_id);

      const totalSent = (allJobs || []).reduce((s: number, j: any) => s + (j.emails_sent || 0), 0);
      const totalFailed = (allJobs || []).reduce((s: number, j: any) => s + (j.emails_failed || 0), 0);
      const hasErrors = totalFailed > 0;

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("crm_campaigns")
        .update({
          status: hasErrors ? "sent_with_errors" : "sent",
          total_sent: totalSent,
          sent_at: new Date().toISOString(),
          metrics: { sent: totalSent, failed: totalFailed, opens: 0, clicks: 0, unsubscribes: 0 },
          sending_started_at: null,
          claim_token: null,
        })
        .eq("id", campaign_id)
        .select("id, status, total_sent, sent_at")
        .single();

      if (updErr) throw updErr;
      return new Response(JSON.stringify({ success: true, campaign: updated }), {
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
