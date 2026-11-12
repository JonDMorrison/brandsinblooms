import { assertEquals } from "@std/assert";
import { liveReceiptMatches, validLiveRequest, type LiveRequest } from "./trusted-live.ts";
import type { EngineeringIssue } from "./engineering.ts";
import { RECIPE, WORKFLOW } from "./trusted-reproduction.ts";
const issueId = "00000000-0000-0000-0000-000000000001", ticketId = "00000000-0000-0000-0000-000000000002";
const head = "b".repeat(40), deployed = "c".repeat(40), now = Date.parse("2026-11-12T12:00:00Z");
const request: LiveRequest = { nonce: "00000000-0000-0000-0000-000000000003", engineering_issue_id: issueId, issue_version: 2, head_sha: head, deployed_sha: deployed, deployment_id: "dpl_test", project_id: "prj_test", team_id: null, ticket_binding: "d".repeat(64), pr_number: 8, created_at: "2026-11-12T11:45:00Z" };
const pins = { [WORKFLOW]: "1".repeat(64), ".github/scripts/bloom-trusted-live.mjs": "2".repeat(64), ".github/scripts/bloom-public-attachment-recipe.mjs": "3".repeat(64), "package-lock.json": "4".repeat(64), "package.json": "5".repeat(64) };
const run = { id: 10, run_attempt: 1, head_sha: "a".repeat(40), run_started_at: "2026-11-12T11:46:00Z", updated_at: "2026-11-12T11:49:00Z" };
const receipt = { ...request, schema: 1, mode: "live", recipe: RECIPE, repository: "JonDMorrison/brandsinblooms", repository_id: "30", workflow_path: WORKFLOW, trusted_sha: run.head_sha, run_id: "10", run_attempt: "1", origin: "https://bloomsuite.app", path: "/support/contact", started_at: "2026-11-12T11:47:00Z", created_at: "2026-11-12T11:48:00Z", workflow_digest: pins[WORKFLOW], supervisor_digest: pins[".github/scripts/bloom-trusted-live.mjs"], recipe_digest: pins[".github/scripts/bloom-public-attachment-recipe.mjs"], dependency_lock_digest: pins["package-lock.json"], package_manifest_digest: pins["package.json"], observation: { recipe: RECIPE, outcome: "green", observed_origin: "https://bloomsuite.app", observed_path: "/support/contact", assertions: { controlAccepted: true, controlRemoved: true, overlongAccepted: false, overlongRejected: true, filenameLimitWarning: true, formUnsubmitted: true }, safety: { nonGetAttempts: 0, externalGetBlocked: 2, webSocketAttempts: 0, serviceWorkerAttempts: 0, redirectsBlocked: 0, networkFailures: 0 } } };
Deno.test("live proof requires exact persisted request and observed route, not copied deployment claims", () => {
  assertEquals(validLiveRequest(request), true);
  assertEquals(liveReceiptMatches(receipt, request, run, 30, now, pins), true);
  for (const key of ["nonce", "engineering_issue_id", "issue_version", "head_sha", "deployed_sha", "deployment_id", "ticket_binding", "pr_number", "origin", "path", "run_attempt", "supervisor_digest"]) assertEquals(liveReceiptMatches({ ...receipt, [key]: "wrong" }, request, run, 30, now, pins), false, key);
  assertEquals(liveReceiptMatches({ ...receipt, observation: { ...receipt.observation, observed_path: "/login" } }, request, run, 30, now, pins), false);
  assertEquals(liveReceiptMatches({ ...receipt, observation: { ...receipt.observation, outcome: "setup_failure" } }, request, run, 30, now, pins), false);
  assertEquals(liveReceiptMatches(receipt, request, run, 30, now + 3600_000, pins), false);
  assertEquals(liveReceiptMatches({ ...receipt, started_at: "2026-11-12T11:44:00Z" }, request, run, 30, now, pins), false);
  assertEquals(validLiveRequest({ ...request, deployment_id: "https://evil.test" }), false);
  for (const key of ["nonce", "engineering_issue_id", "head_sha", "deployed_sha", "ticket_binding"]) {
    assertEquals(validLiveRequest({ ...request, [key]: [request[key as keyof LiveRequest]] }), false, key);
  }
});

Deno.test("live dispatch intent is persisted once, uncertain dispatch never repeats, changed production fails closed", async () => {
  const { verify, trustedBrowserFlow } = await import("./engineering.ts");
  const originalFetch = globalThis.fetch;
  const keys = { SUPABASE_URL: "https://live.test", SUPABASE_SERVICE_ROLE_KEY: "test", BLOOM_GITHUB_RELEASE_TOKEN: "test", BLOOM_GITHUB_REPAIR_TOKEN: "test", BLOOM_VERCEL_TOKEN: "test" };
  const prior = Object.fromEntries(Object.keys(keys).map(k => [k, Deno.env.get(k)]));
  Object.entries(keys).forEach(([k,v]) => Deno.env.set(k,v));
  const repo = "JonDMorrison/brandsinblooms";
  const issue = { id: issueId, title: "filename validation", version: 1, product: "crm", repository: repo, status: "verifying", pr_number: 8, head_sha: head, merge_sha: deployed, deployment: { state: "success", url: "https://immutable.vercel.app" }, verification: null as Record<string, unknown> | null, rollback: null, evidence: { github_issue: { number: 5 } }, tickets: [{ id: ticketId, kind: "bug", product: "crm" }] };
  const policy = { verificationOrigins: { [repo]: ["https://bloomsuite.app"] }, verificationChecks: { [repo]: [{ url: "https://bloomsuite.app/health" }] }, vercel: { [repo]: { projectId: "prj_test" } }, trustedReproductionIssues: { [issueId]: { recipe: RECIPE, github_issue: 5, ticket_ids: [ticketId] } } };
  let deploymentProject: Record<string, unknown> = { projectId: "prj_test" };
  let dispatches = 0, changed = false, ticketsAutomatic = true, pauseDuringProvider = false, driftPersistedRequest = false;
  globalThis.fetch = (input, init) => Promise.resolve().then(() => {
    const u = new URL(input instanceof Request ? input.url : String(input));
    if (u.pathname === "/rest/v1/rpc/bloom_support_rpc") {
      const { p_fn, p } = JSON.parse(String(init?.body));
      if (p_fn === "list_engineering") return Response.json([issue]);
      if (p_fn === "setting") return Response.json(p.key === "release_policy" ? policy : p.key === "automation_scopes" ? { engineering: true } : true);
      if (p_fn === "update_engineering_issue") {
        assertEquals(p.update.version, issue.version);
        // PostgreSQL JSONB does not preserve insertion order.
        const patch = structuredClone(p.update.patch);
        if (patch.verification?.trusted_browser_request) {
          patch.verification.trusted_browser_request = Object.fromEntries(Object.entries(patch.verification.trusted_browser_request).reverse());
          if (driftPersistedRequest) patch.verification.trusted_browser_request.nonce = "00000000-0000-0000-0000-000000000099";
        }
        Object.assign(issue, patch); if (p.update.status) issue.status = p.update.status; issue.version++;
        return Response.json(issue);
      }
    }
    if (u.pathname === "/rest/v1/rpc/bloom_support_ticket_flow_context") return Response.json({ issue_id: issue.id, version: issue.version, head_sha: head, tickets_automatic: ticketsAutomatic, tickets: [{ id: ticketId, kind: "bug", product: "crm", page_url: "https://bloomsuite.app/support/contact" }] });
    if (u.pathname.endsWith("/labels")) return Response.json([]);
    if (u.pathname === "/health") return new Response("ok");
    if (u.pathname === "/v4/aliases/bloomsuite.app") return Response.json({ deploymentId: changed ? "dpl_newer" : "dpl_test", projectId: "prj_test" });
    const deployment = { id: changed ? "dpl_newer" : "dpl_test", projectId: "prj_test", target: "production", readyState: "READY", meta: { githubCommitSha: changed ? "e".repeat(40) : deployed, githubOrg: "JonDMorrison", githubRepo: "brandsinblooms" } };
    if (u.pathname.startsWith("/v13/deployments/")) return Response.json({ ...deployment, projectId: undefined, ...deploymentProject });
    if (u.pathname === "/v9/projects/prj_test") {
      if (pauseDuringProvider) ticketsAutomatic = false;
      return Response.json({ id: "prj_test", targets: { production: deployment } });
    }
    if (u.pathname.endsWith("/dispatches")) { dispatches++; assertEquals(issue.version, 2, "intent must precede dispatch"); assertEquals((JSON.parse(String(init?.body))).inputs.mode, "verify"); throw Error("uncertain network outcome"); }
    if (u.pathname.endsWith("/runs")) return Response.json({ workflow_runs: [] });
    throw Error(`Unexpected ${u.pathname}`);
  });
  try {
    const actor = { principalId: "release-test", role: "release", via: "service" as const, scopes: [] };
    assertEquals((await verify(actor, issueId)).next?.step, "verify");
    assertEquals(dispatches, 1); assertEquals(issue.status, "verifying");
    assertEquals(validLiveRequest(issue.verification?.trusted_browser_request), true);
    assertEquals((await verify(actor, issueId)).next?.step, "verify");
    assertEquals(dispatches, 1); assertEquals(issue.version, 2);
    const current = () => structuredClone(issue) as unknown as EngineeringIssue;
    const successful = await trustedBrowserFlow(actor, current(), policy, () => Promise.resolve({ state: "proved", evidence: { nonce: request.nonce, started_at: "2026-11-12T01:00:00Z" } }));
    assertEquals(successful.flow?.ticketIds, [ticketId]);
    assertEquals(successful.flow?.passed, true);
    assertEquals(successful.flow?.startedAt, "2026-11-12T01:00:00Z", "actual observation start must survive polling");
    assertEquals(issue.status, "verifying", "a flow result is not itself a state transition");
    for (const projectBinding of [{ project: { id: "prj_test", name: "fixture" } }, { projectId: "prj_test", project: { id: "prj_test" } }]) {
      deploymentProject = projectBinding;
      const nested = await trustedBrowserFlow(actor, current(), policy, () => Promise.resolve({ state: "proved", evidence: { started_at: "2026-11-12T01:00:00Z" } }));
      assertEquals(nested.flow?.passed, true, "documented project.id response remains exact-project bound");
      assertEquals(dispatches, 1, "schema normalization cannot duplicate dispatch");
    }
    deploymentProject = { projectId: "prj_test", project: { id: "different" } };
    const conflict = await trustedBrowserFlow(actor, current(), policy, () => Promise.resolve({ state: "proved", evidence: { started_at: "2026-11-12T01:00:00Z" } }));
    assertEquals(conflict.flow, undefined); assertEquals(issue.status, "escalated");
    assertEquals(dispatches, 1);
    issue.status = "verifying"; issue.version = 2;
    deploymentProject = { projectId: "prj_test" };
    const changedDuringObservation = await trustedBrowserFlow(actor, current(), policy, () => Promise.resolve().then(() => {
      changed = true;
      return { state: "proved" as const, evidence: { started_at: "2026-11-12T01:00:00Z" } };
    }));
    assertEquals(changedDuringObservation.flow, undefined); assertEquals(issue.status, "escalated");
    assertEquals(dispatches, 1);
    // Restore only the test fixture, with the original persisted request version.
    changed = false; issue.status = "verifying"; issue.version = 2;
    const heldDuringObservation = await trustedBrowserFlow(actor, current(), policy, () => Promise.resolve().then(() => {
      ticketsAutomatic = false;
      return { state: "proved" as const, evidence: { started_at: "2026-11-12T01:00:00Z" } };
    }));
    assertEquals(heldDuringObservation.flow, undefined); assertEquals(issue.status, "escalated");
    assertEquals(dispatches, 1);
    issue.status = "verifying"; issue.version = 2; ticketsAutomatic = true; pauseDuringProvider = true;
    let observedAfterHold = false;
    const heldDuringProvider = await trustedBrowserFlow(actor, current(), policy, () => Promise.resolve().then(() => {
      observedAfterHold = true;
      return { state: "proved" as const, evidence: { started_at: "2026-11-12T01:00:00Z" } };
    }));
    assertEquals(heldDuringProvider.flow, undefined); assertEquals(issue.status, "escalated");
    assertEquals(observedAfterHold, false, "final projection catches a pause after the initial hold read");
    issue.status = "verifying"; issue.version = 1; issue.verification = null;
    ticketsAutomatic = true; pauseDuringProvider = false; driftPersistedRequest = true;
    const drifted = await trustedBrowserFlow(actor, current(), policy);
    assertEquals(drifted.step?.note, "live request changed before dispatch");
    assertEquals(dispatches, 1, "real field drift must prevent another dispatch");
  } finally {
    globalThis.fetch = originalFetch;
    Object.keys(keys).forEach(k => prior[k] === undefined ? Deno.env.delete(k) : Deno.env.set(k, prior[k]!));
  }
});
