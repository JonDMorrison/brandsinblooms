import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ForceSendRequest {
  campaignId: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is super admin
    const { data: adminCheck, error: adminError } = await supabaseClient
      .from("app_admin_emails")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    if (adminError || !adminCheck) {
      console.log(`[force-send] Unauthorized attempt by: ${user.email}`);
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaignId }: ForceSendRequest = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "campaignId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch campaign and verify status
    const { data: campaign, error: fetchError } = await supabaseClient
      .from("crm_campaigns")
      .select("id, name, status, tenant_id, failure_reason, send_attempts")
      .eq("id", campaignId)
      .single();

    if (fetchError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow force send for scheduled or failed campaigns
    const allowedStatuses = ["scheduled", "failed"];
    if (!allowedStatuses.includes(campaign.status)) {
      return new Response(
        JSON.stringify({
          error: `Cannot force send campaign with status: ${campaign.status}. Only 'scheduled' or 'failed' campaigns can be force sent.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const previousStatus = campaign.status;
    const previousFailureReason = campaign.failure_reason;

    const { data: policyData, error: policyError } = await supabaseClient.rpc('get_campaign_reputation_policy', {
      p_campaign_id: campaignId,
    });

    if (policyError) {
      console.error('[force-send] Failed to fetch reputation policy:', policyError);
      return new Response(
        JSON.stringify({ error: 'Failed to evaluate campaign reputation policy' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const policy = Array.isArray(policyData) ? policyData[0] : policyData;
    const policyAction = String(policy?.action || 'allow');
    const policyScore = Number(policy?.score ?? 100);

    if (policyAction === 'pause') {
      const pauseMessage = `Campaign auto-paused: tenant reputation score ${policyScore} is below 60.`;
      await supabaseClient.rpc('system_pause_email_campaign_sending', {
        p_campaign_id: campaignId,
        p_block_reason: 'reputation_critical_autopause',
        p_error_message: pauseMessage,
      });

      return new Response(
        JSON.stringify({ error: pauseMessage }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (policyAction === 'restrict') {
      const blockMessage = `Campaign blocked: tenant reputation score ${policyScore} is in restricted tier (60-74).`;
      await supabaseClient
        .from('crm_campaigns')
        .update({
          send_blocked_reason: 'reputation_restricted',
          send_error: blockMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ error: blockMessage }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset campaign to scheduled with immediate trigger
    const { error: updateError } = await supabaseClient
      .from("crm_campaigns")
      .update({
        status: "scheduled",
        scheduled_at: new Date().toISOString(), // Set to now for immediate pickup
        failure_reason: null,
        send_error: null,
        claim_token: null,
        // Don't reset send_attempts - keep for tracking total attempts
      })
      .eq("id", campaignId);

    if (updateError) {
      console.error("[force-send] Failed to update campaign:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to reset campaign" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log admin audit event
    await supabaseClient.from("admin_audit_log").insert({
      admin_user_id: user.id,
      action_type: "force_send_campaign",
      target_tenant_id: campaign.tenant_id,
      action_details: {
        campaign_id: campaignId,
        campaign_name: campaign.name,
        previous_status: previousStatus,
        previous_failure_reason: previousFailureReason,
        previous_send_attempts: campaign.send_attempts,
        triggered_at: new Date().toISOString(),
      },
    });

    // Log activity event for the tenant
    await supabaseClient.from("crm_activity_events").insert({
      tenant_id: campaign.tenant_id,
      actor_type: "user",
      actor_id: user.id,
      source: "ui",
      activity_type: "campaign_force_send",
      status: "success",
      title: `Campaign "${campaign.name}" force sent by admin`,
      description: {
        parts: [
          { type: "text", text: `Admin ` },
          { type: "mention", text: user.email },
          { type: "text", text: ` triggered force send. Previous status: ${previousStatus}` },
        ]
      },
      metadata: {
        campaign_id: campaignId,
        previous_status: previousStatus,
        previous_failure_reason: previousFailureReason,
      }
    });

    console.log(`[force-send] Campaign ${campaignId} force-sent by admin ${user.email}. Previous: ${previousStatus}`);

    // Immediately invoke the auto-send function to process the campaign
    try {
      const { data: sendResult, error: sendError } = await supabaseClient.functions.invoke(
        "auto-send-campaigns",
        { body: { manualTrigger: true } }
      );

      if (sendError) {
        console.warn("[force-send] Auto-send invocation warning:", sendError);
      } else {
        console.log("[force-send] Auto-send invoked successfully:", sendResult);
      }
    } catch (invokeError) {
      console.warn("[force-send] Failed to invoke auto-send (campaign still queued):", invokeError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Campaign "${campaign.name}" has been queued for immediate sending`,
        previousStatus,
        previousFailureReason,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[force-send] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
