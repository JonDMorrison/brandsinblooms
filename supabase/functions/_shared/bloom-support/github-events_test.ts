import { assertEquals } from "@std/assert";
import { failedMainCheckSuite, engineeringEventHints, isProductionEnvironment, deploymentNotice, releaseMatchesEngineering } from "./github-events.ts";

const sha = "a".repeat(40);
Deno.test("report failed checks from the release branch with a stable source", () => {
  assertEquals(failedMainCheckSuite({id: 123456789, head_branch: "main", conclusion: "failure", head_sha: sha}), {id:123456789, sha});
});
Deno.test("ignore failed PR checks and successful release checks", () => {
  assertEquals(failedMainCheckSuite({id:123456789, head_branch:"feature/branch", conclusion:"failure", head_sha:sha}), null);
  assertEquals(failedMainCheckSuite({id:123456789, head_branch:"main", conclusion:"success", head_sha:sha}), null);
});
Deno.test("reject malformed or missing check identities", () => {
  assertEquals(failedMainCheckSuite(null), null);
  assertEquals(failedMainCheckSuite({id:"123456789",head_branch:"main",conclusion:"failure",head_sha:sha}), null);
  assertEquals(failedMainCheckSuite({id:123456789,head_branch:"main",conclusion:"failure",head_sha:"not-a-sha"}), null);
});

Deno.test("engineering hints bind PR repository and exact head, never titles", () => {
  const repository = { full_name: "JonDMorrison/brandsinblooms" };
  const pr = { number: 42, head: { sha, repo: repository }, base: { repo: repository } };
  const expected = [{ sha, pr: 42, deployment: false }];
  for (const event of ["pull_request", "pull_request_review"]) {
    assertEquals(engineeringEventHints(event, { repository, pull_request: pr }), expected);
    assertEquals(engineeringEventHints(event, { repository, pull_request: { ...pr, head: { sha, repo: { full_name: "other/fork" } } } }), []);
  }
  for (const event of ["workflow_run", "check_suite", "check_run"]) {
    assertEquals(engineeringEventHints(event, { action: "completed", [event]: { head_sha: sha, pull_requests: [pr] } }), expected);
    assertEquals(engineeringEventHints(event, { action: "completed", [event]: { head_sha: "b".repeat(40), pull_requests: [pr] } }), []);
    assertEquals(engineeringEventHints(event, { action: "requested", [event]: { head_sha: sha, pull_requests: [pr] } }), []);
  }
  assertEquals(engineeringEventHints("issue_comment", { body: "please merge PR 42" }), []);
});
Deno.test("production deployment hints accept qualified names and exact SHA, not preview or pending", () => {
  const payload = { deployment: { environment: "Production – BloomSuite", ref: sha, sha }, deployment_status: { state: "success" } };
  assertEquals(engineeringEventHints("deployment_status", payload), [{ sha, pr: null, deployment: true }]);
  assertEquals(engineeringEventHints("deployment_status", { ...payload, deployment_status: { state: "pending" } }), []);
  assertEquals(engineeringEventHints("deployment_status", { ...payload, deployment: { ...payload.deployment, sha: "main" } }), []);
  for (const environment of ["Preview", "Production – demo", "Production – staging", "test"]) {
    assertEquals(isProductionEnvironment({ environment, production_environment: true }), false);
    assertEquals(engineeringEventHints("deployment_status", { ...payload, deployment: { sha, environment, production_environment: true } }), []);
  }
});

Deno.test("deployment notices dedupe deliveries without losing new failures or deployments", () => {
  const repo = "JonDMorrison/brandsinblooms";
  const payload = { deployment: { id: 123, sha, environment: "Production" }, deployment_status: { id: 1, state: "success" } };
  const first = deploymentNotice(repo, payload)!;
  assertEquals(deploymentNotice(repo, { ...payload, deployment_status: { id: 2, state: "success" } }), first);
  const failed = deploymentNotice(repo, { ...payload, deployment_status: { state: "failure" } })!;
  assertEquals(failed.identity === first.identity, false);
  assertEquals(deploymentNotice(repo, { ...payload, deployment_status: { state: "error" } })!.identity, failed.identity);
  assertEquals(deploymentNotice(repo, { ...payload, deployment: { ...payload.deployment, id: 124 } })!.identity === first.identity, false);
  assertEquals(deploymentNotice(repo, { ...payload, deployment: { ...payload.deployment, sha: "b".repeat(40) } })!.identity === first.identity, false);
  assertEquals(deploymentNotice("Brands-In-Blooms/bloomtill", payload)!.identity === first.identity, false);
  assertEquals(deploymentNotice(repo, { ...payload, deployment: { ...payload.deployment, sha: sha.toUpperCase() } }), first);
});
Deno.test("deployment notices fail closed without trustworthy production identity", () => {
  const repo = "JonDMorrison/brandsinblooms";
  const payload = { deployment: { id: 123, sha, environment: "Production" }, deployment_status: { state: "success" } };
  for (const patch of [{ id: 0 }, { id: "123" }, { sha: "main" }, { sha: undefined }, { environment: "Preview", production_environment: true }]) {
    assertEquals(deploymentNotice(repo, { ...payload, deployment: { ...payload.deployment, ...patch } }), null);
  }
  assertEquals(deploymentNotice(repo, { ...payload, deployment_status: { state: "pending" } }), null);
  assertEquals(deploymentNotice(repo, { ...payload, deployment_status: { state: ["success"] } }), null);
  assertEquals(deploymentNotice(repo, {}), null);
  assertEquals(deploymentNotice("untrusted/../repo", payload), null);
});

Deno.test("release links use recorded repository and provider identity, never titles", () => {
  const e = { repository: "JonDMorrison/brandsinblooms", pr_number: 42, deployment: { deployment_id: 123, deployments: [{ deployment_id: 124 }] } };
  assertEquals(releaseMatchesEngineering("https://github.com/JonDMorrison/brandsinblooms/pull/42", e), true);
  assertEquals(releaseMatchesEngineering("https://github.com/JonDMorrison/brandsinblooms/deployments/123", e), true);
  assertEquals(releaseMatchesEngineering("https://github.com/JonDMorrison/brandsinblooms/deployments/124", e), true);
  for (const source of ["https://github.com/Brands-In-Blooms/bloomtill/pull/42", "https://github.com/JonDMorrison/brandsinblooms/pull/43", "https://github.com/JonDMorrison/brandsinblooms/deployments/125", "https://github.com/JonDMorrison/brandsinblooms/pull/42?ticket=42", "https://evil.test/pull/42"]) assertEquals(releaseMatchesEngineering(source, e), false);
  assertEquals(releaseMatchesEngineering("https://github.com/JonDMorrison/brandsinblooms/pull/42", { title: "Fix ticket42" }), false);
});
