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
    if (action === "reset_campaign") {
      const { campaign_id } = body;
      if (!campaign_id) throw new Error("campaign_id is required");

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("crm_campaigns")
        .update({
          status: "scheduled",
          scheduled_at: new Date().toISOString(),
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

    if (action === "clear_and_resend_campaign") {
      const { campaign_id } = body;
      if (!campaign_id) throw new Error("campaign_id is required");

      // Delete old email_send_jobs
      const { error: delJobsErr } = await supabaseAdmin
        .from("email_send_jobs")
        .delete()
        .eq("campaign_id", campaign_id);
      if (delJobsErr) console.warn("Failed to delete old jobs:", delJobsErr);

      // Delete old email_messages
      const { error: delMsgsErr } = await supabaseAdmin
        .from("email_messages")
        .delete()
        .eq("campaign_id", campaign_id);
      if (delMsgsErr) console.warn("Failed to delete old messages:", delMsgsErr);

      // Reset campaign to scheduled with immediate pickup
      const { data: updated, error: updErr } = await supabaseAdmin
        .from("crm_campaigns")
        .update({
          status: "scheduled",
          scheduled_at: new Date().toISOString(),
          failure_reason: null,
          send_error: null,
          send_blocked_reason: null,
          claim_token: null,
          sending_started_at: null,
          sent_at: null,
        })
        .eq("id", campaign_id)
        .select("id, status")
        .single();

      if (updErr) throw updErr;

      // Trigger auto-send
      try {
        await supabaseAdmin.functions.invoke("auto-send-campaigns", {
          body: { manualTrigger: true },
        });
      } catch (e) {
        console.warn("auto-send invoke warning:", e);
      }

      return new Response(JSON.stringify({ success: true, campaign: updated, cleared: true }), {
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

    if (action === "add_to_segment") {
      const { customer_id, segment_id } = body;
      if (!customer_id || !segment_id) throw new Error("customer_id and segment_id are required");

      const { error } = await supabaseAdmin
        .from("customer_segments")
        .upsert({ customer_id, segment_id }, { onConflict: "customer_id,segment_id" });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, customer_id, segment_id }), {
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

    if (action === "update_campaign_sender") {
      const { campaign_id, sender_email, domain_id } = body;
      if (!campaign_id || !sender_email || !domain_id) throw new Error("campaign_id, sender_email, domain_id are required");

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("crm_campaigns")
        .update({ sender_email, from_email_domain_id: domain_id })
        .eq("id", campaign_id)
        .select("id, sender_email, from_email_domain_id")
        .single();

      if (updErr) throw updErr;
      return new Response(JSON.stringify({ success: true, campaign: updated }), {
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
