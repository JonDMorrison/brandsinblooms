import { assertEquals, assertStringIncludes } from "@std/assert";
import { slackChannelId, slackRoute, slackSafeMessage } from "./slack.ts";

Deno.test("Slack routes support notifications by purpose", () => {
  assertEquals(slackRoute("ticket.created"), "tickets");
  assertEquals(slackRoute("ticket.reopened"), "tickets");
  assertEquals(slackRoute("engineering.awaiting_approval"), "tickets");
  assertEquals(slackRoute("feature.awaiting_decision"), "features");
  assertEquals(slackRoute("alert.queue_backlog"), "alerts");
  assertEquals(slackRoute("escalation.overdue"), "alerts");
  assertEquals(slackRoute("job.dead"), "alerts");
  assertEquals(slackRoute("digest"), null);
});
Deno.test("Slack channel validation refuses arbitrary URLs and garbage IDs", () => {
  assertEquals(slackChannelId("C0CFNEQBS2X"), "C0CFNEQBS2X");
  assertEquals(slackChannelId("https://hooks.slack.com/services/abc"), null);
  assertEquals(slackChannelId("G0CFNEQBS2X"), null);
  assertEquals(slackChannelId(undefined), null);
});
Deno.test("Slack notification never echoes private client data or incoming text", () => {
  const msg = slackSafeMessage("ticket.created", "e77f4ae5-a67a-499d-8a10-96aaa4c0ce77");
  assertStringIncludes(msg, "Open in Bloom Support");
  assertStringIncludes(msg, "?ticket=e77f4ae5-a67a-499d-8a10-96aaa4c0ce77");
  assertEquals(msg.includes("@"), false);
  assertEquals(msg.includes("Customer"), false);
});
