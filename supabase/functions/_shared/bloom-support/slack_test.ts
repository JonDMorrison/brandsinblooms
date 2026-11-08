import { assertEquals, assertStringIncludes } from "@std/assert";
import { githubSourceLink, slackChannelId, slackRoute, slackSafeMessage } from "./slack.ts";

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

Deno.test("Major Project links open the selected record without accepting arbitrary URLs", () => {
  const projectId = "11111111-1111-4111-8111-111111111111";
  const message = slackSafeMessage("major_project.accepted", null, undefined, projectId);
  assertStringIncludes(message, "?project=" + projectId);
  assertEquals(message.includes("https://evil.example"), false);
  const invalid = slackSafeMessage("major_project.onboarding", null, undefined, "https://evil.example");
  assertEquals(invalid.includes("?project="), false);
  assertEquals(slackRoute("major_project.accepted"), "clients");
  assertEquals(slackRoute("major_project.stage_changed"), "projects");
});

Deno.test("Slack only links to validated company check pages", () => {
  const sha = "a".repeat(40);
  const url = "https://github.com/JonDMorrison/brandsinblooms/commit/" + sha + "/checks";
  assertEquals(githubSourceLink(url), url);
  assertEquals(githubSourceLink(url + "?access_token=secret"), null);
  assertEquals(githubSourceLink("https://github.com/other/repo/commit/" + sha + "/checks"), null);
  assertEquals(githubSourceLink("http://github.com/JonDMorrison/brandsinblooms/commit/" + sha + "/checks"), null);
});
