import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { explainSupportEvent, explainGithubMilestone, githubMilestoneFromKind } from "./slack-language.ts";
Deno.test("GitHub messages explicitly separate merge, deploy and verified customer outcome", () => {
  const merged = explainGithubMilestone("pr_merged");
  assertStringIncludes(merged.whatItMeans, "still checking it");
  assertStringIncludes(merged.nextStep, "checked");
  const deployed = explainGithubMilestone("deployment_succeeded");
  assertStringIncludes(deployed.whatItMeans, "haven\u0027t checked the full customer experience yet");
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

Deno.test("all GitHub milestones are understandable without developer terminology", () => {
  for(const milestone of ["pr_merged","pr_closed","checks_failed","checks_passed","deployment_succeeded","deployment_failed"] as const) {
    const note=explainGithubMilestone(milestone);
    const text=[note.headline,note.whatItMeans,note.nextStep].join(" ");
    assertEquals(/(?:source code|merged|deployment|pull request|workflow|commit|CI|GitHub)/i.test(text),false,milestone);
    assertEquals(text.length < 370,true,milestone);
  }
});
