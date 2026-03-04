import { serializeSupabaseError } from "./campaignHelpers.ts";

export async function systemPauseEmailCampaignSending(
  supabase: any,
  params: {
    campaignId: string;
    blockReason?: string | null;
    errorMessage?: string | null;
  }
): Promise<{
  usedRpc: boolean;
  rpcError: any | null;
  fallbackErrors: Array<{ step: string; error: any }>;
}> {
  const { campaignId, blockReason, errorMessage } = params;
  const fallbackErrors: Array<{ step: string; error: any }> = [];

  const { error: rpcError } = await supabase.rpc("system_pause_email_campaign_sending", {
    p_campaign_id: campaignId,
    p_block_reason: blockReason ?? null,
    p_error_message: errorMessage ?? null,
  });

  if (!rpcError) {
    return { usedRpc: true, rpcError: null, fallbackErrors };
  }

  console.error("❌ Failed to pause campaign via system RPC; falling back to direct updates:", {
    campaignId,
    blockReason,
    err: serializeSupabaseError(rpcError),
  });

  const nowIso = new Date().toISOString();

  const { error: campaignErr } = await supabase
    .from("crm_campaigns")
    .update({
      status: "paused",
      send_blocked_reason: blockReason ?? null,
      send_error: errorMessage ?? null,
      sending_started_at: null,
      send_started_at: null,
      claim_token: null,
      updated_at: nowIso,
    })
    .eq("id", campaignId);

  if (campaignErr) fallbackErrors.push({ step: "pause_campaign", error: serializeSupabaseError(campaignErr) });

  const { error: jobsErr } = await supabase
    .from("email_send_jobs")
    .update({
      status: "paused",
      error_message: null,
      claim_token: null,
      claimed_at: null,
      claimed_by: null,
      updated_at: nowIso,
    })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "in_progress"]);

  if (jobsErr) fallbackErrors.push({ step: "pause_jobs", error: serializeSupabaseError(jobsErr) });

  const { error: messagesErr } = await supabase
    .from("email_messages")
    .update({
      status: "paused",
      error_message: null,
      claim_token: null,
      claimed_at: null,
      claimed_by: null,
      updated_at: nowIso,
    })
    .eq("campaign_id", campaignId)
    .is("resend_id", null)
    .in("status", ["queued", "sending"]);

  if (messagesErr) fallbackErrors.push({ step: "pause_messages", error: serializeSupabaseError(messagesErr) });

  if (fallbackErrors.length > 0) {
    console.error("❌ Direct pause fallback encountered errors:", {
      campaignId,
      errors: fallbackErrors,
    });
  }

  return { usedRpc: false, rpcError, fallbackErrors };
}
