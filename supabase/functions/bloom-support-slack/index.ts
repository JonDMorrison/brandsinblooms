// Event-driven Ask Bloom channel: signed Slack mentions -> existing leased worker.
// Known-thread continuation, read-only evidence and visible progress.
import { db, env } from "../_shared/bloom-support/runtime.ts";
import { verifySlackWebhook } from "../_shared/bloom-support/webhook-auth.ts";
import { wakeSlackWorker } from "../_shared/bloom-support/slack-worker-wake.ts";
import { slackQuestionText } from "../_shared/bloom-support/slack-question.ts";
import { parseSlackDecision, slackDecisionReceipt } from "../_shared/bloom-support/slack-decisions.ts";
import { postDecisionReceipt } from "../_shared/bloom-support/slack-decision-delivery.ts";
import { slackQuestionRoute } from "../_shared/bloom-support/slack-questions.ts";

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
  const event = data.event as Record<string, unknown> | undefined;
  const route = slackQuestionRoute(event?.channel);
  if (!event || !["app_mention","message"].includes(String(event.type)) || !route ||
      event.bot_id || event.subtype) return json({ok:true,ignored:true});
  if (typeof event.user !== "string" || !/^[UW][A-Z0-9]{8,24}$/.test(event.user))
    return json({ok:true,ignored:true});
  // Slack user ID, not email or display name, is the identity boundary.
  const staff = (env("BLOOM_SUPPORT_SLACK_STAFF_IDS") ?? "").split(",").map(x=>x.trim());
  if (!staff.includes(event.user)) return json({ok:true,ignored:true});
  const eventId = typeof data.event_id === "string" ? data.event_id : "";
  const ts = typeof event.ts === "string" ? event.ts : "";
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(eventId) ||
      !/^\d{10}\.\d{6}$/.test(ts)) return json({error:"invalid"},400);
  // Messages are untrusted user input. Never let a Slack message authorize an operation.
  const question = slackQuestionText(event.text);
  if (!question.length) return json({ok:true,ignored:true});
  const parentTs = typeof event.thread_ts === "string" ? event.thread_ts : "";
  const isMention = event.type === "app_mention";
  // Ordinary channel chatter is never ingested. Unmentioned replies require a
  // durable conversation or ticket binding, checked transactionally by SQL.
  if (!isMention && !/^\d{10}\.\d{6}$/.test(parentTs)) return json({ok:true,ignored:true});
  const rootTs = parentTs || ts;
  if (!/^\d{10}\.\d{6}$/.test(rootTs)) return json({error:"invalid"},400);
  const {data:result,error} = await db().rpc("bloom_support_enqueue_slack_conversation", {
    p_event_id:eventId, p_channel:event.channel, p_user_id:event.user,
    p_question:question, p_root_ts:rootTs, p_message_ts:ts, p_is_mention:isMention,
  });
  if (error) {
    console.error("Slack Ask intake failed",error.code);
    return json({error:"service temporarily unavailable"},503);
  }
  if (result?.queued === true && typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(wakeSlackWorker());
  return json({ok:true,queued:result?.queued === true});
});
