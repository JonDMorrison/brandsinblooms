// Event-driven Ask Bloom channel: signed Slack mentions (and top-level staff posts in
// #ask-bloom) -> existing leased worker.
// Known-thread continuation, read-only evidence and visible progress.
import { db, env } from "../_shared/bloom-support/runtime.ts";
import { verifySlackWebhook } from "../_shared/bloom-support/webhook-auth.ts";
import { wakeSlackWorker } from "../_shared/bloom-support/slack-worker-wake.ts";
import { parseSlackDecision, slackDecisionReceipt } from "../_shared/bloom-support/slack-decisions.ts";
import { postDecisionReceipt } from "../_shared/bloom-support/slack-decision-delivery.ts";
import { slackIntake } from "../_shared/bloom-support/slack-intake.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const json = (body: Record<string, unknown>, status=200) =>
  new Response(JSON.stringify(body), {status,headers:{"content-type":"application/json;charset=utf-8"}});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({error:"POST only"},405);
  const secret = env("BLOOM_SUPPORT_SLACK_SIGNING_SECRET");
  if (!secret) return json({error:"not configured"},503);
  const size = Number(req.headers.get("content-length") ?? 0);
  if (size > 32768) return json({error:"too large"},413);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 32768) return json({error:"too large"},413);
  const signed = await verifySlackWebhook(
    raw, req.headers.get("x-slack-request-timestamp"),
    req.headers.get("x-slack-signature"), secret
  );
  if (!signed) return json({error:"unauthenticated"},401);

  let data: Record<string, unknown>;
  try {
    const body = req.headers.get("content-type")?.split(";")[0].trim() === "application/x-www-form-urlencoded"
      ? new URLSearchParams(raw).get("payload") : raw;
    data = JSON.parse(body ?? "");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("invalid");
  } catch { return json({error:"invalid"},400); }

  if (data.type === "block_actions") {
    if (env("BLOOM_SUPPORT_SLACK_DECISIONS_ENABLED") !== "true") return json({ok:true,ignored:true});
    const click = parseSlackDecision(data,env("BLOOM_SUPPORT_SLACK_TEAM_ID"),
      (env("BLOOM_SUPPORT_SLACK_STAFF_IDS") ?? "").split(",").map(x=>x.trim()));
    if (!click) return json({ok:true,ignored:true});
    const {data:result,error} = await db().rpc("bloom_support_apply_slack_repair", {
      p_decision:click.decisionId,p_user_id:click.userId,p_channel:click.channelId,
      p_message_ts:click.messageTs,p_choice:click.choice,
    });
    if (error) return json({error:"service temporarily unavailable"},503);
    const receipt = postDecisionReceipt(click.channelId,click.userId,slackDecisionReceipt(result));
    // Acknowledge promptly; Slack retries are still safe at the transactional boundary.
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(receipt);
    else await receipt;
    return json({ok:true});
  }
  if (data.type === "url_verification") {
    const challenge = typeof data.challenge === "string" ? data.challenge.slice(0,250) : "";
    return json({challenge});
  }
  if (data.type !== "event_callback") return json({ok:true,ignored:true});
  if (typeof data.team_id !== "string" || !env("BLOOM_SUPPORT_SLACK_TEAM_ID") ||
      data.team_id !== env("BLOOM_SUPPORT_SLACK_TEAM_ID")) return json({ok:true,ignored:true});
  // Route, staff allowlist, #ask-bloom top-level posts and thread continuation rules
  // live in slackIntake (unit-tested). Duplicate mention+message events for one post
  // collapse to one job on the SQL idempotency key (channel + message ts).
  const staff = (env("BLOOM_SUPPORT_SLACK_STAFF_IDS") ?? "").split(",").map(x=>x.trim());
  const intake = slackIntake(data, staff);
  if (intake.kind === "ignore") return json({ok:true,ignored:true});
  if (intake.kind === "invalid") return json({error:"invalid"},400);
  const {data:result,error} = await db().rpc("bloom_support_enqueue_slack_conversation", intake.args);
  if (error) {
    console.error("Slack Ask intake failed",error.code);
    return json({error:"service temporarily unavailable"},503);
  }
  if (result?.queued === true && typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(wakeSlackWorker());
  return json({ok:true,queued:result?.queued === true});
});
