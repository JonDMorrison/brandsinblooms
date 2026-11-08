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
});

Deno.test("release body gives a plain-English benefit, state and next action", () => {
  const msg = slackSafeMessage("github.pr_merged",null,url,undefined,"support_tasks");
  assertStringIncludes(msg,"What changed:");
  assertStringIncludes(msg,"Slack requests and Bloom dashboard investigations");
  assertStringIncludes(msg,"Why it matters:");
  assertStringIncludes(msg,"Where it stands:");
  assertStringIncludes(msg,"not yet been verified");
  assertStringIncludes(msg,"Next:");
  assertStringIncludes(msg,"/pull/440");
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
  assertStringIncludes(msg,"approved customer-facing description is not available");
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
