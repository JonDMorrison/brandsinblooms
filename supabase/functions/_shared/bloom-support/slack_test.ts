import { assertEquals, assertStringIncludes, assertRejects } from "@std/assert";
import { postSlackInternalMessage, postSlackSupportNotification, githubSourceLink, slackChannelId, slackRoute, slackSafeMessage } from "./slack.ts";

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

Deno.test("QA-ready Major Project asks Jon/Jeff to review with protected links only", () => {
  const projectId="11111111-1111-4111-8111-111111111111";
  assertEquals(slackRoute("major_project.review_ready"),"projects");
  const message=slackSafeMessage("major_project.review_ready",null,undefined,projectId);
  assertStringIncludes(message,"Website draft ready for your review");
  assertStringIncludes(message,"Project reviewers");
  assertStringIncludes(message,"/dashboard/admin/major-projects/review?projectId="+projectId);
  assertStringIncludes(message,"/dashboard/admin/major-projects?project="+projectId);
  assertEquals(message.includes("/preview/"),false);
  assertEquals(message.includes("@"),false);
  assertEquals(slackSafeMessage("major_project.review_ready",null,undefined,"https://evil.example"),"");
});

Deno.test("Slack only links to validated company check pages", () => {
  const sha = "a".repeat(40);
  const url = "https://github.com/JonDMorrison/brandsinblooms/commit/" + sha + "/checks";
  assertEquals(githubSourceLink(url), url);
  assertEquals(githubSourceLink(url + "?access_token=secret"), null);
  assertEquals(githubSourceLink("https://github.com/other/repo/commit/" + sha + "/checks"), null);
  assertEquals(githubSourceLink("http://github.com/JonDMorrison/brandsinblooms/commit/" + sha + "/checks"), null);
});

Deno.test("Slack receipts accept real timestamps and reject malformed successful responses", async () => {
  const originalFetch = globalThis.fetch;
  const keys = ["BLOOM_SUPPORT_SLACK_BOT_TOKEN", "BLOOM_SUPPORT_SLACK_CHANNEL_TICKETS"];
  const previous = keys.map((key) => Deno.env.get(key));
  Deno.env.set(keys[0], "test-token");
  Deno.env.set(keys[1], "C0CFNEQBS2X");
  try {
    for (const ts of ["1794160000.123456", "1234567890.000001"]) {
      let calls = 0;
      globalThis.fetch = () => {
        calls++;
        return Promise.resolve(Response.json({ ok: true, ts }));
      };
      const receipt = await postSlackInternalMessage("tickets", "Test", "11111111-1111-4111-8111-111111111111");
      assertEquals(receipt.ts, ts);
      assertEquals(calls, 1);
    }
    for (const ts of [undefined, null, 1794160000.123456, "", "1794160000x123456", "1794160000.12345", "1794160000.1234567"]) {
      globalThis.fetch = () => Promise.resolve(Response.json({ ok: true, ts }));
      await assertRejects(
        () => postSlackInternalMessage("tickets", "Test", "11111111-1111-4111-8111-111111111111"),
        Error, "Slack did not return a valid message timestamp",
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => {
      const value = previous[index];
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    });
  }
});

Deno.test("merged release messages include a clear status and validated link", () => {
  const url = "https://github.com/JonDMorrison/brandsinblooms/pull/418";
  const message = slackSafeMessage("github.pr_merged", null, url, undefined, "support_tasks");
  assertStringIncludes(message, "See the change");
  assertStringIncludes(message, "*Status:* Code merged.");
  assertStringIncludes(message, "not been verified");
  assertStringIncludes(message, url);
  const unsafe = slackSafeMessage("github.pr_merged", null, "https://attacker.example/evil", undefined, "support_tasks");
  assertEquals(unsafe, "");
});

Deno.test("queued unclassified releases are quietly skipped without calling Slack", async () => {
  const fetchBefore = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error("Slack should not be called for a filler message"); };
  try {
    const skipped = await postSlackSupportNotification({
      kind: "github.pr_merged", ticketId: null,
      githubUrl: "https://github.com/JonDMorrison/brandsinblooms/pull/4405",
      releaseCategory: "other",
      jobId: "11111111-1111-4111-8111-111111111111",
    });
    assertEquals(skipped, "skipped: no useful reviewed release summary");
    assertEquals(calls, 0);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
