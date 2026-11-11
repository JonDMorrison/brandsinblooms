import { assertEquals, assertStringIncludes } from "@std/assert";
import { announceableMainMerge, classifyPublicReleaseTitle, isPublicReleaseCategory } from "./release-notes.ts";
import { slackSafeMessage } from "./slack.ts";

const url = "https://github.com/JonDMorrison/brandsinblooms/pull/440";

Deno.test("only a classified main-branch merge warrants a public release update", () => {
  const checkout = { merged: true, baseRef: "main", title: "Fix customer checkout when Stripe payment session expires" };
  assertEquals(announceableMainMerge(checkout), "checkout");
  assertEquals(announceableMainMerge({ ...checkout, baseRef: "dev" }), null);
  assertEquals(announceableMainMerge({ ...checkout, merged: false }), null);
  assertEquals(announceableMainMerge({ ...checkout, baseRef: null }), null);
  const honolulu = { merged: true, baseRef: "dev", title: "fix(events): remove invalid Honolulu timezone option" };
  assertEquals(announceableMainMerge(honolulu), null);
  assertEquals(announceableMainMerge({ ...honolulu, baseRef: "main" }), null);
  assertEquals(announceableMainMerge({ ...checkout, title: "Fix checkout for owner@example.com private secret sk_live_123456" }), null);
});

Deno.test("real feature titles select only preapproved, non-sensitive topics", () => {
  assertEquals(classifyPublicReleaseTitle("Bloom Operations: one investigation task shared by Slack and dashboard"), "support_tasks");
  assertEquals(classifyPublicReleaseTitle("Bloom: safely inspect Heartland and ShipStation integration health"), "integration_checks");
  assertEquals(classifyPublicReleaseTitle("Fix customer checkout when Stripe payment session expires"), "checkout");
  assertEquals(classifyPublicReleaseTitle("Delivery workflow completed status and dispatch tracking"), "delivery");
  assertEquals(classifyPublicReleaseTitle("Newsletter editor improvements"), "newsletters");
  assertEquals(classifyPublicReleaseTitle("Improve inventory and product photos"), "catalogue");
  assertEquals(classifyPublicReleaseTitle("Make Bloom tickets readable and conversational directly in private Slack threads"), "support_tasks");
});

Deno.test("useful release updates stay short, avoid promises and name their unverified stage", () => {
  const msg = slackSafeMessage("github.pr_merged", null, url, undefined, "support_tasks");
  assertStringIncludes(msg, "Bloom tickets are getting easier to follow");
  assertStringIncludes(msg, "read a support request");
  assertStringIncludes(msg, "*Status:* Code merged.");
  assertStringIncludes(msg, "Live customer use has not been verified");
  assertStringIncludes(msg, url);
  assertEquals(msg.includes("*Release check:*"), false);
  assertEquals(msg.includes("Do you need to do anything?"), false);
  assertEquals(msg.includes("We've made an update behind the scenes"), false);
  assertEquals(msg.length < 500, true);
});

Deno.test("unclassified or private PR details never produce a filler Slack message", () => {
  const category = classifyPublicReleaseTitle("Fix checkout for owner@example.com: private secret sk_live_123456789");
  assertEquals(category, "other");
  assertEquals(slackSafeMessage("github.pr_merged", null, url, undefined, category), "");
  assertEquals(slackSafeMessage("github.pr_merged", null, url, undefined, undefined), "");
  const malformed = "support_tasks\n<@U123> *everyone*";
  assertEquals(isPublicReleaseCategory(malformed), false);
  assertEquals(slackSafeMessage("github.pr_merged", null, url, undefined, malformed), "");
  assertEquals(slackSafeMessage("github.pr_merged", null, "https://attacker.example/evil", undefined, "checkout"), "");
  assertEquals(classifyPublicReleaseTitle({title:"security fixes"}), "other");
});

Deno.test("deployment status and customer verification remain distinct", () => {
  const msg = slackSafeMessage("github.deployment_succeeded", null,
    "https://github.com/JonDMorrison/brandsinblooms/deployments/1234", undefined, "checkout");
  assertStringIncludes(msg, "haven't checked the full customer experience yet");
  assertEquals(msg.includes("shopping carts"), false);
});

Deno.test("known releases stay readable and never claim a verified customer fix", () => {
  const categories = ["support_tasks", "integration_checks", "checkout", "delivery", "newsletters",
    "catalogue", "pos", "website", "security", "performance", "projects", "support"];
  for (const category of categories) {
    const msg = slackSafeMessage("github.pr_merged", null, url, undefined, category);
    assertStringIncludes(msg, "*Status:* Code merged.");
    assertStringIncludes(msg, "Live customer use has not been verified");
    assertEquals(msg.includes("*Release check:*"), false);
    assertEquals(msg.includes("Do you need to do anything?"), false);
    assertEquals(/(?:source code|pull request|technical change)/i.test(msg), false);
    assertEquals(msg.length < 500, true, category);
  }
  assertEquals(slackSafeMessage("github.pr_merged", null, url, undefined, "other"), "");
});
