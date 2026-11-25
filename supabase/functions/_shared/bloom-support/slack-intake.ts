// Pure intake decision for signed Slack Events API callbacks.
// The edge function verifies the signature and team first, then asks this module
// whether the event may become a Bloom conversation job, and with which RPC arguments.
import { slackQuestionText } from "./slack-question.ts";
import { slackQuestionRoute, type SlackQuestionRoute } from "./slack-questions.ts";

export interface SlackEnqueueArgs {
  p_event_id: string;
  p_channel: string;
  p_user_id: string;
  p_question: string;
  p_root_ts: string;
  p_message_ts: string;
  p_is_mention: boolean;
}

export type SlackIntake =
  | { kind: "ignore" }
  | { kind: "invalid" }
  | { kind: "enqueue"; route: SlackQuestionRoute; args: SlackEnqueueArgs };

const TS = /^\d{10}\.\d{6}$/;

/**
 * Routes where a top-level staff post is itself a question, with no @Bloom needed.
 * Only #ask-bloom: every other route keeps "mention to start, reply to continue".
 */
const UNMENTIONED_ROOT_ROUTES: ReadonlySet<SlackQuestionRoute> = new Set(["ask"]);

/** Staff often type "#ask-bloom <question>"; Slack sends that as a link to this same channel. */
function withoutSelfChannelPrefix(text: unknown, channel: string): unknown {
  if (typeof text !== "string") return text;
  return text.replace(new RegExp(`^\\s*<#${channel}(?:\\|[^>]*)?>[\\s:,-]*`), "");
}

export function slackIntake(
  data: Record<string, unknown>,
  staffIds: readonly string[],
): SlackIntake {
  const event = data.event as Record<string, unknown> | undefined;
  const route = slackQuestionRoute(event?.channel);
  if (!event || !["app_mention", "message"].includes(String(event.type)) || !route ||
      event.bot_id || event.subtype) return { kind: "ignore" };
  if (typeof event.user !== "string" || !/^[UW][A-Z0-9]{8,24}$/.test(event.user)) return { kind: "ignore" };
  // Slack user ID, not email or display name, is the identity boundary.
  if (!staffIds.includes(event.user)) return { kind: "ignore" };
  const eventId = typeof data.event_id === "string" ? data.event_id : "";
  const ts = typeof event.ts === "string" ? event.ts : "";
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(eventId) || !TS.test(ts)) return { kind: "invalid" };
  const channel = event.channel as string;
  // Messages are untrusted user input. Never let a Slack message authorize an operation.
  const question = slackQuestionText(withoutSelfChannelPrefix(event.text, channel));
  if (!question.length) return { kind: "ignore" };
  const parentTs = typeof event.thread_ts === "string" ? event.thread_ts : "";
  const isRoot = !parentTs;
  // In #ask-bloom a top-level staff post is a question in its own right, so it is
  // enqueued exactly as an app_mention would be. Everywhere else, ordinary channel
  // chatter is never ingested: an unmentioned message may only continue a durable
  // conversation or ticket thread, which SQL checks transactionally.
  const isMention = event.type === "app_mention" || (isRoot && UNMENTIONED_ROOT_ROUTES.has(route));
  if (!isMention && !TS.test(parentTs)) return { kind: "ignore" };
  const rootTs = parentTs || ts;
  if (!TS.test(rootTs)) return { kind: "invalid" };
  // Slack sends a separate message and app_mention event (with different event_ids)
  // for one mentioned post. Both carry the same channel and ts, and the SQL enqueue
  // keys the job on slack:conversation:<channel>:<message_ts>, so only one job exists.
  return {
    kind: "enqueue",
    route,
    args: {
      p_event_id: eventId, p_channel: channel, p_user_id: event.user,
      p_question: question, p_root_ts: rootTs, p_message_ts: ts, p_is_mention: isMention,
    },
  };
}

/** The idempotency key bloom_support_enqueue_slack_conversation uses for the job. */
export function slackConversationJobKey(args: Pick<SlackEnqueueArgs, "p_channel" | "p_message_ts">): string {
  return `slack:conversation:${args.p_channel}:${args.p_message_ts}`;
}
