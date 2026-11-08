// Bloom Support Slack notifications. Internal, non-PII summaries only.
// Slack is an optional delivery channel; tickets and permission checks stay in Bloom Support.
import { BloomError, env } from "./runtime.ts";

export type SlackRoute = "tickets" | "features" | "alerts";

/** Only known staff events are allowed into Slack; unrelated notifications stay in-app. */
export function slackRoute(kind: string): SlackRoute | null {
  if (/^(alert\.|escalation(?:\.|$)|job\.dead$|incident\.)/.test(kind)) return "alerts";
  if (/^feature\./.test(kind)) return "features";
  if (/^(ticket\.|engineering\.)/.test(kind)) return "tickets";
  return null;
}
export function slackChannelId(value: string | undefined): string | null {
  return value && /^C[A-Z0-9]{7,30}$/.test(value) ? value : null;
}
/** Do not place ticket subjects, bodies, requester identities, or source details in Slack. */
export function slackSafeMessage(kind: string, ticketId: string | null): string {
  const route = slackRoute(kind);
  if (!route) throw new Error("unsupported event");
  const label = route === "alerts" ? "Attention required" : route === "features" ? "Feature update" : "Support ticket update";
  const event = kind.replace(/[^a-zA-Z0-9.\-_]/g, "").slice(0, 70);
  const base = "https://bloomsuite.app/support";
  const link = ticketId && /^[0-9a-f-]{36}$/i.test(ticketId) ? `${base}?ticket=${ticketId}` : base;
  return `*${label}*\nEvent: \`${event}\`\n<${link}|Open in Bloom Support>\nReview details, owner, and customer information in the protected ticket.`;
}
export async function postSlackSupportNotification(input: {
  kind: string; ticketId: string | null; jobId: string;
}): Promise<string> {
  const route = slackRoute(input.kind);
  if (!route) return "skipped: unsupported Slack event";
  const token = env("BLOOM_SUPPORT_SLACK_BOT_TOKEN");
  const channel = slackChannelId(env(`BLOOM_SUPPORT_SLACK_CHANNEL_${route.toUpperCase()}`));
  if (!token || !channel) throw new BloomError(503, "not_configured", "Slack bot token/channel not configured");
  const payload = {
    channel,
    text: slackSafeMessage(input.kind, input.ticketId),
    client_msg_id: input.jobId,
    unfurl_links: false,
    unfurl_media: false,
  };
  let response: Response;
  try {
    response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new BloomError(502, "slack_network", "Slack notification network error");
  }
  if (!response.ok) throw new BloomError(502, "slack_http", `Slack API HTTP ${response.status}`);
  const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; ts?: string } | null;
  if (!result?.ok) throw new BloomError(502, "slack_delivery", `Slack rejected notification: ${result?.error ?? "unknown"}`);
  return `delivered to ${route} (Slack ts: ${result.ts ?? "unknown"})`;
}
