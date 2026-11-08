import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { explainSupportEvent, explainGithubMilestone, githubMilestoneFromKind } from "./slack-language.ts";
Deno.test("GitHub messages explicitly separate merge, deploy and verified customer outcome", () => {
  const merged = explainGithubMilestone("pr_merged");
  assertStringIncludes(merged.whatItMeans, "does not prove");
  assertStringIncludes(merged.nextStep, "test");
  const deployed = explainGithubMilestone("deployment_succeeded");
  assertStringIncludes(deployed.whatItMeans, "not been verified");
  assertEquals(githubMilestoneFromKind("github.checks_failed"), "checks_failed");
  assertEquals(githubMilestoneFromKind("engineering.failed"), null);
  assert(explainGithubMilestone("deployment_failed").requiresAttention);
});
Deno.test("Staff notifications say what to do without technical jargon or false success", () => {
  assertStringIncludes(explainSupportEvent("engineering.awaiting_approval").nextStep, "reviewer");
  assertStringIncludes(explainSupportEvent("engineering.deployed").nextStep, "customer");
  assert(explainSupportEvent("ticket.reopened").requiresAttention);
  assert(!explainSupportEvent("engineering.in_review").whatItMeans.includes("live and working"));
  assertStringIncludes(explainSupportEvent("feature.awaiting_decision").whatItMeans, "not been approved");
});
