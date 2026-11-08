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

Deno.test("release message is short, friendly and doesn't claim a change is live", () => {
  const msg = slackSafeMessage("github.pr_merged",null,url,undefined,"support_tasks");
  assertStringIncludes(msg,"*Bloom investigations*");
  assertStringIncludes(msg,"We're making it easier to follow the same support task in Slack and Bloom.");
  assertStringIncludes(msg,"*Status:*");
  assertStringIncludes(msg,"Not yet confirmed working for customers.");
  assertStringIncludes(msg,"*Next:* Try one Slack request");
  assertStringIncludes(msg,"/pull/440");
  assertStringIncludes(msg,"More details");
  assertEquals(msg.includes("What changed:"),false);
  assertEquals(msg.includes("Why it matters:"),false);
  assertEquals(msg.includes("Where it stands:"),false);
  assertEquals(msg.includes("technical change"),false);
  assertEquals(msg.length < 400,true);
});

Deno.test("customer support updates are understandable without GitHub knowledge", () => {
  const msg=slackSafeMessage("github.pr_merged",null,url,undefined,"support");
  assertStringIncludes(msg,"*Customer support*");
  assertStringIncludes(msg,"We're making customer support requests easier to follow.");
  assertStringIncludes(msg,"*Status:* Added to our software.");
  assertStringIncludes(msg,"*Next:* Test a support request from start to finish.");
  assertEquals(/\b(merged|codebase|deployment|workflow|technical change)\b/i.test(msg),false);
});

Deno.test("every approved category stays concise and never claims a customer result", () => {
  for (const category of ["support_tasks","integration_checks","checkout","delivery","newsletters","catalogue","pos","website","security","performance","projects","support","other"]) {
    const msg=slackSafeMessage("github.pr_merged",null,url,undefined,category);
    assertStringIncludes(msg,"Not yet confirmed working for customers.");
    assertEquals(msg.length < 440,true,category);
    assertEquals(msg.includes("See the technical change"),false,category);
  }
});

Deno.test("untrusted PR text, customer identities and secrets never reach public Slack",()=>{
  const privateTitle = "Fix checkout for owner@example.com: private secret sk_live_123456789";
  const category = classifyPublicReleaseTitle(privateTitle);
  assertEquals(category,"other");
  const msg = slackSafeMessage("github.pr_merged",null,url,undefined,category);
  assertEquals(msg.includes("owner@example.com"),false);
  assertEquals(msg.includes("sk_live"),false);
  assertEquals(msg.includes("private secret"),false);
  assertStringIncludes(msg,"don't yet have a confirmed explanation");
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
