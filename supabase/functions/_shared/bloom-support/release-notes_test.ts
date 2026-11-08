import { assertEquals, assertStringIncludes } from "@std/assert";
import { classifyPublicReleaseTitle, isPublicReleaseCategory, publicReleaseNote } from "./release-notes.ts";
import { slackSafeMessage } from "./slack.ts";

const url = "https://github.com/JonDMorrison/brandsinblooms/pull/440";

Deno.test("real Bloom Support PR titles become specific approved categories", () => {
  assertEquals(classifyPublicReleaseTitle("Bloom Operations: one investigation task shared by Slack and dashboard"),"support_tasks");
  assertEquals(classifyPublicReleaseTitle("Bloom: safely inspect Heartland and ShipStation integration health"),"integration_checks");
  assertEquals(classifyPublicReleaseTitle("Fix customer checkout when Stripe payment session expires"),"checkout");
  assertEquals(classifyPublicReleaseTitle("Delivery workflow completed status and dispatch tracking"),"delivery");
  assertEquals(classifyPublicReleaseTitle("Newsletter editor improvements"),"newsletters");
  assertEquals(classifyPublicReleaseTitle("Improve inventory and product photos"),"catalogue");
  assertEquals(classifyPublicReleaseTitle("Make Bloom tickets readable and conversational directly in private Slack threads"),"support_tasks");
});

Deno.test("release body gives a plain-English benefit, state and next action", () => {
  const msg = slackSafeMessage("github.pr_merged",null,url,undefined,"support_tasks");
  assertStringIncludes(msg,"Bloom tickets are getting easier to follow");
  assertStringIncludes(msg,"read a support request");
  assertStringIncludes(msg,"What this means for you:");
  assertStringIncludes(msg,"*Status:* The change has been added.");
  assertStringIncludes(msg,"still checking it");
  assertStringIncludes(msg,"Do you need to do anything?");
  assertEquals(msg.includes("/pull/440"),false);
  assertEquals(/(?:merged|deployment|codebase|software improvement|technical change|support workflow)/i.test(msg),false);
  assertEquals(msg.includes("live and working"),false);
});

Deno.test("untrusted PR text, customer identities and secrets never reach public Slack",()=>{
  const privateTitle = "Fix checkout for owner@example.com: private secret sk_live_123456789";
  const category = classifyPublicReleaseTitle(privateTitle);
  assertEquals(category,"other");
  const msg = slackSafeMessage("github.pr_merged",null,url,undefined,category);
  assertEquals(msg.includes("owner@example.com"),false);
  assertEquals(msg.includes("sk_live"),false);
  assertEquals(msg.includes("private secret"),false);
  assertStringIncludes(msg,"don\u0027t have a clear team-friendly description");
});

Deno.test("unknown/invalid classifications fail closed and cannot inject Slack mentions",()=>{
  const invalid = "support_tasks\n<@U123> *everyone*";
  assertEquals(isPublicReleaseCategory(invalid),false);
  const msg=slackSafeMessage("github.pr_merged",null,url,undefined,invalid);
  assertEquals(msg.includes("<@"),false);
  assertEquals(msg.includes("everyone"),false);
  assertStringIncludes(msg,publicReleaseNote("other").changed);
  assertEquals(classifyPublicReleaseTitle({title:"security fixes"}),"other");
});

Deno.test("the original deployment-vs-verified safety messages remain distinct",()=>{
  const msg=slackSafeMessage("github.deployment_succeeded",null,
    "https://github.com/JonDMorrison/brandsinblooms/deployments/1234",undefined,"checkout");
  assertStringIncludes(msg,"customer experience has not been verified");
  assertEquals(msg.includes("shopping carts"),false);
});

Deno.test("a generic support improvement sounds like a teammate, not a developer",()=>{
  const msg=slackSafeMessage("github.pr_merged",null,url,undefined,"support");
  assertStringIncludes(msg,"Bloom is getting better at helping customers");
  assertStringIncludes(msg,"easier to see what needs attention");
  assertStringIncludes(msg,"Do you need to do anything?");
  assertEquals(/(?:merged into|deployment|codebase|gitHub|pull request|technical change|workflow)/i.test(msg),false);
  assertEquals(msg.includes("http"),false);
});

Deno.test("every known release category is brief, readable and honest about readiness",()=>{
  const categories=["support_tasks","integration_checks","checkout","delivery",
    "newsletters","catalogue","pos","website","security","performance","projects","support","other"];
  for(const category of categories) {
    const msg=slackSafeMessage("github.pr_merged",null,url,undefined,category);
    assertStringIncludes(msg,"*Status:*");
    assertStringIncludes(msg,"still checking");
    assertStringIncludes(msg,"Do you need to do anything?");
    assertEquals(/\b(?:merged|deployment|source code|github|pull request|technical change)\b/i.test(msg),false);
    assertEquals(msg.length<850,true,category);
  }
});
