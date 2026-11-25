import { assertEquals } from "@std/assert";
import { slackConversationJobKey, slackIntake, type SlackEnqueueArgs } from "./slack-intake.ts";

const STAFF = "U0STAFF0001";
const ASK = "C0CFUG4LFLJ";
const PROJECTS = "C0CFUHJ5ESW";
const TS = "1795600000.000100";

function callback(event: Record<string, unknown>, eventId = "Ev0ASKROOT001"): Record<string, unknown> {
  return { type: "event_callback", team_id: "T0TEAM", event_id: eventId, event };
}
const message = (channel: string, extra: Record<string, unknown> = {}) =>
  ({ type: "message", channel, user: STAFF, ts: TS, text: "How do I add a loyalty reward?", ...extra });

/**
 * Mirrors bloom_support_enqueue_slack_conversation's duplicate guard: one job per
 * 'slack:conversation:' || channel || ':' || message_ts, regardless of event_id.
 */
function fakeQueue() {
  const jobs = new Map<string, SlackEnqueueArgs>();
  return {
    jobs,
    enqueue(args: SlackEnqueueArgs) {
      const key = slackConversationJobKey(args);
      if (jobs.has(key)) return { queued: false, reason: "duplicate" };
      jobs.set(key, args);
      return { queued: true };
    },
  };
}

Deno.test("an unmentioned top-level staff post in #ask-bloom is enqueued as a new question", () => {
  const intake = slackIntake(callback(message(ASK)), [STAFF]);
  assertEquals(intake.kind, "enqueue");
  if (intake.kind !== "enqueue") return;
  assertEquals(intake.route, "ask");
  // Treated exactly like an app_mention: it may start a conversation, rooted at itself.
  assertEquals(intake.args.p_is_mention, true);
  assertEquals(intake.args.p_root_ts, TS);
  assertEquals(intake.args.p_message_ts, TS);
  assertEquals(intake.args.p_question, "How do I add a loyalty reward?");
  const queue = fakeQueue();
  assertEquals(queue.enqueue(intake.args).queued, true);
  assertEquals(queue.jobs.size, 1);
});

Deno.test("a '#ask-bloom' channel link typed in front of the question is not part of the question", () => {
  const intake = slackIntake(callback(message(ASK, { text: `<#${ASK}|ask-bloom> how do refunds work?` })), [STAFF]);
  assertEquals(intake.kind === "enqueue" && intake.args.p_question, "how do refunds work?");
});

Deno.test("an unmentioned top-level post in any other route is still ignored", () => {
  assertEquals(slackIntake(callback(message(PROJECTS)), [STAFF]).kind, "ignore");
  for (const channel of ["C0CFWJDUQU9", "C0CFNEQBS2X", "C0CFUG4STS6", "C0CGP4GPG8G", "C0CFYDVE4A0", "C0CFDBT8JAK"]) {
    assertEquals(slackIntake(callback(message(channel)), [STAFF]).kind, "ignore", channel);
  }
});

Deno.test("a mention and a message for the same #ask-bloom post produce one job", () => {
  const text = "<@U0BLOOMBOT1> How do I add a loyalty reward?";
  const mention = slackIntake(callback({ ...message(ASK, { text }), type: "app_mention" }, "Ev0MENTION001"), [STAFF]);
  const plain = slackIntake(callback(message(ASK, { text }), "Ev0MESSAGE001"), [STAFF]);
  assertEquals(mention.kind, "enqueue");
  assertEquals(plain.kind, "enqueue");
  if (mention.kind !== "enqueue" || plain.kind !== "enqueue") return;
  // Slack gives the two deliveries different event_ids; the job key is the post itself.
  assertEquals(slackConversationJobKey(mention.args), slackConversationJobKey(plain.args));
  const queue = fakeQueue();
  assertEquals(queue.enqueue(mention.args).queued, true);
  assertEquals(queue.enqueue(plain.args), { queued: false, reason: "duplicate" });
  // A Slack retry of the same delivery is also a duplicate.
  assertEquals(queue.enqueue(plain.args).queued, false);
  assertEquals(queue.jobs.size, 1);
});

Deno.test("#ask-bloom still ignores non-staff, bots, edits and empty posts", () => {
  assertEquals(slackIntake(callback(message(ASK, { user: "U0NOTSTAFF1" })), [STAFF]).kind, "ignore");
  assertEquals(slackIntake(callback(message(ASK, { bot_id: "B0BOT00001" })), [STAFF]).kind, "ignore");
  assertEquals(slackIntake(callback(message(ASK, { subtype: "message_changed" })), [STAFF]).kind, "ignore");
  assertEquals(slackIntake(callback(message(ASK, { text: "   " })), [STAFF]).kind, "ignore");
  assertEquals(slackIntake(callback(message(ASK, { text: `<#${ASK}|ask-bloom>` })), [STAFF]).kind, "ignore");
});

Deno.test("unmentioned thread replies keep needing a known thread, in every route", () => {
  const reply = { thread_ts: "1795599999.000100" };
  for (const channel of [ASK, PROJECTS]) {
    const intake = slackIntake(callback(message(channel, reply)), [STAFF]);
    assertEquals(intake.kind, "enqueue", channel);
    if (intake.kind !== "enqueue") continue;
    // Not a mention: SQL only accepts it for this user's durable conversation or ticket thread.
    assertEquals(intake.args.p_is_mention, false);
    assertEquals(intake.args.p_root_ts, "1795599999.000100");
  }
});

Deno.test("mentions start conversations in every route, as before", () => {
  const intake = slackIntake(callback({ ...message(PROJECTS), type: "app_mention" }), [STAFF]);
  assertEquals(intake.kind === "enqueue" && intake.args.p_is_mention, true);
});

Deno.test("malformed ids are rejected rather than enqueued", () => {
  assertEquals(slackIntake(callback(message(ASK), "bad"), [STAFF]).kind, "invalid");
  assertEquals(slackIntake(callback(message(ASK, { ts: "nope" })), [STAFF]).kind, "invalid");
});
