// Event-driven Ask Bloom channel: signed Slack mentions -> existing leased worker.
// Initial reply mode is approved help articles only. No tenant data or actions.
import { db, env } from "../_shared/bloom-support/runtime.ts";
import { verifySlackWebhook } from "../_shared/bloom-support/webhook-auth.ts";
import { slackQuestionText } from "../_shared/bloom-support/slack-question.ts";

const CHANNEL = "C0CFUG4LFLJ";
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
    data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("invalid");
  } catch { return json({error:"invalid"},400); }

  if (data.type === "url_verification") {
    const challenge = typeof data.challenge === "string" ? data.challenge.slice(0,250) : "";
    return json({challenge});
  }
  if (data.type !== "event_callback") return json({ok:true,ignored:true});
  if (typeof data.team_id !== "string" || !env("BLOOM_SUPPORT_SLACK_TEAM_ID") ||
      data.team_id !== env("BLOOM_SUPPORT_SLACK_TEAM_ID")) return json({ok:true,ignored:true});
  const event = data.event as Record<string, unknown> | undefined;
  if (!event || event.type !== "app_mention" || event.channel !== CHANNEL ||
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
  if (question.length < 3) return json({ok:true,ignored:true});
  const {data:result,error} = await db().rpc("bloom_support_enqueue_slack_question", {
    p_event_id: eventId, p_channel: CHANNEL, p_user_id: event.user,
    p_question: question, p_thread_ts: ts
  });
  if (error) {
    console.error("Slack Ask intake failed",error.code);
    return json({error:"service temporarily unavailable"},503);
  }
  return json({ok:true,queued:result?.queued === true});
});
