import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";
import { engineeringIssuePayload } from "./engineering.ts";

Deno.test("the final GitHub issue payload contains no client contact details or customer identifiers", () => {
  const issueId = "11111111-2222-4333-8444-555555555555";
  const payload = engineeringIssuePayload({
    issueId,
    title: "Logo save fails for jane.doe+support@example.com (+1 604-555-0199)",
    branch: "bloom/fix-11111111",
    base: "main",
    evidence: [
      "### Report #1011: Logo save fails",
      "Contact jane.doe+support@example.com or (604) 555-0199.",
      "Customer ID: cust_private_42; account number acct_987654.",
      "Tenant ID: 5e7d2797-4169-46ae-b2d2-db3cb6990b7a; external user id cms-user-1.",
    ].join("\n"),
  });

  const outbound = JSON.stringify(payload);
  for (const privateValue of [
    "jane.doe+support@example.com",
    "604-555-0199",
    "cust_private_42",
    "acct_987654",
    "5e7d2797-4169-46ae-b2d2-db3cb6990b7a",
    "cms-user-1",
  ]) assertFalse(outbound.includes(privateValue), `GitHub payload leaked ${privateValue}`);
  assertStringIncludes(payload.title, "[redacted email]");
  assertStringIncludes(payload.body, "[redacted phone]");
  assertStringIncludes(payload.body, "[redacted customer id]");
  assertStringIncludes(payload.body, issueId, "the non-customer engineering correlation id remains available");
  assertEquals(payload.labels, ["bloom-repair"]);
});

Deno.test("promotion polling backs off within five minutes without promoting or spending deployment polls", async (t) => {
  const { deploy } = await import("./engineering.ts");
  const originalFetch = globalThis.fetch;
  const settings = {
    SUPABASE_URL: "https://bloom-poll.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    BLOOM_GITHUB_RELEASE_TOKEN: "test-release-token",
    BLOOM_VERCEL_TOKEN: "",
  };
  const originalEnv = Object.fromEntries(Object.keys(settings).map((key) => [key, Deno.env.get(key)]));
  for (const [key, value] of Object.entries(settings)) Deno.env.set(key, value);
  const actor = { principalId: "release-test", role: "release", via: "service" as const, scopes: [] };
  let issue = {
    id: "promotion-test", pr_number: 42, repository: "Brands-In-Blooms/cms-brandsinblooms",
    merge_sha: "repair-sha", status: "deploying", deployment: {} as Record<string, unknown>,
  };
  let promoted = false;
  let deploymentState = "pending";
  let rollbackConfigured = false;
  const calls: string[] = [];
  const respond = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }));
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/rest/v1/rpc/bloom_support_rpc") {
      const { p_fn, p } = JSON.parse(String(init?.body));
      if (p_fn === "list_engineering") return respond([issue]);
      if (p_fn === "setting") return respond(rollbackConfigured
        ? { vercel: { [issue.repository]: { projectId: "test-project" } } }
        : {});
      if (p_fn === "update_engineering_issue") {
        if (p.update.status) issue.status = p.update.status;
        if (p.update.patch.deployment) issue.deployment = { ...issue.deployment, ...p.update.patch.deployment };
        return respond(issue);
      }
      throw new Error(`Unexpected RPC ${p_fn}`);
    }
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    assertEquals(init?.method, "GET", "deployment observation must never mutate GitHub or Vercel");
    if (url.pathname.endsWith("/pulls/42")) return respond({
      base: { ref: "dev" }, merged: true, merge_commit_sha: issue.merge_sha,
    });
    if (url.pathname.includes("/compare/")) return respond({ status: promoted ? "ahead" : "diverged" });
    if (url.pathname.endsWith("/pulls")) return respond([]);
    if (url.pathname.endsWith("/branches/main")) return respond({ commit: { sha: "production-sha" } });
    if (url.pathname.endsWith("/deployments")) return respond([{ id: 1, environment: "Production" }]);
    if (url.pathname.endsWith("/statuses")) return respond([{ state: deploymentState }]);
    if (url.pathname === "/v9/projects/test-project") return respond({ alias: [] });
    throw new Error(`Unexpected request ${url}`);
  };
  try {
    await t.step("persisted backoff is 60, 120, 240, then capped at 240 seconds", async () => {
      for (const delay of [60, 120, 240, 240, 240, 240]) {
        const result = await deploy(actor, issue.id);
        assertEquals(result.next?.step, "deploy");
        assertEquals(result.next?.delaySeconds, delay);
        assertEquals(typeof result.next?.runAfter, "string");
        assertEquals(issue.status, "deploying");
        assertEquals(issue.deployment.polls, undefined);
      }
      assertEquals(issue.deployment.promotion_polls, 4);
      assertFalse(calls.some((call) => call.includes("/deployments")));
    });
    await t.step("legacy and malformed counters safely begin a fresh bounded observation", async () => {
      for (const value of [undefined, -1, 0.5, "20", Number.NaN, Number.POSITIVE_INFINITY]) {
        issue.deployment = { promotion_polls: value };
        assertEquals((await deploy(actor, issue.id)).next?.delaySeconds, 60);
      }
      issue.deployment = { promotion_polls: Number.MAX_SAFE_INTEGER };
      assertEquals((await deploy(actor, issue.id)).next?.delaySeconds, 240);
    });
    await t.step("observed promotion retains the separate production timeout and verification step", async () => {
      promoted = true;
      issue.deployment = { promotion_polls: 4 };
      assertEquals((await deploy(actor, issue.id)).next, { step: "deploy", delaySeconds: 300 });
      assertEquals(issue.deployment.polls, 1);
      assertEquals(issue.deployment.production_sha, "production-sha");
      assertEquals(issue.status, "deploying");
      deploymentState = "success";
      assertEquals((await deploy(actor, issue.id)).next, { step: "verify", delaySeconds: 30 });
      assertEquals(issue.status, "verifying", "deployment evidence is not ticket resolution");
      assertFalse(calls.some((call) => call.includes("sha=repair-sha")));
      issue.status = "deploying";
      deploymentState = "pending";
      issue.deployment = { polls: 24, promotion_polls: 4 };
      assertEquals((await deploy(actor, issue.id)).note, "deployment timeout");
      assertEquals(issue.status, "failed");
    });
    await t.step("unproven rollback still blocks an observed promotion", async () => {
      issue = { ...issue, status: "deploying", deployment: {} };
      rollbackConfigured = true;
      Deno.env.set("BLOOM_VERCEL_TOKEN", "test-vercel-token");
      assertEquals((await deploy(actor, issue.id)).note, "promotion found; rollback point could not be proven");
      assertEquals(issue.status, "escalated");
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});

Deno.test("rollback preflight refuses stale production, changed decisions and holds", async (t) => {
  const { verify } = await import("./engineering.ts");
  const originalFetch = globalThis.fetch;
  const keys = { SUPABASE_URL: "https://bloom-poll.test", SUPABASE_SERVICE_ROLE_KEY: "test", BLOOM_GITHUB_RELEASE_TOKEN: "test", BLOOM_VERCEL_TOKEN: "test" };
  const prior = Object.fromEntries(Object.keys(keys).map(key => [key, Deno.env.get(key)]));
  for (const [key, value] of Object.entries(keys)) Deno.env.set(key, value);
  const repo = "JonDMorrison/brandsinblooms", sha = "a".repeat(40);
  const meta = { githubOrg: "JonDMorrison", githubRepo: "brandsinblooms", githubCommitSha: sha };
  const released = { id: "dpl_release", url: "release.vercel.app", projectId: "project", readyState: "READY", target: "production", meta };
  const policy = { verificationOrigins: { [repo]: ["https://bloomsuite.app"] }, verificationChecks: { [repo]: [{ url: "https://bloomsuite.app/health" }] }, vercel: { [repo]: { projectId: "project" } } };
  let scenario = "unchanged", posts = 0, issueReads = 0;
  let issue: Record<string, unknown>;
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const respond = (body: unknown) => Promise.resolve(Response.json(body));
    if (url.pathname === "/rest/v1/rpc/bloom_support_ticket_flow_context") return respond({
      issue_id: "issue", head_sha: sha, version: 1,
      tickets_automatic: !["ticket_hold", "resolved", "account_pause"].includes(scenario),
    });
    if (url.pathname === "/rest/v1/rpc/bloom_support_rpc") {
      const { p_fn, p } = JSON.parse(String(init?.body));
      if (p_fn === "list_engineering") {
        issueReads++;
        if (issueReads > 1 && scenario === "version") issue.version = 2;
        if (issueReads > 1 && scenario === "status") issue.status = "escalated";
        return respond([issue]);
      }
      if (p_fn === "setting") return respond(p.key === "release_policy" ? policy
        : p.key === "automation_scopes" ? { engineering: scenario !== "scope_pause" }
        : scenario !== "global_pause");
      if (p_fn === "get_ticket") return respond({ id: "ticket", status: scenario === "resolved" ? "resolved" : "working", automation: scenario === "ticket_hold" ? "human" : "auto", executor: "bloom", merged_into: null });
      if (p_fn === "update_engineering_issue") {
        if (p.update.version !== undefined && p.update.version !== issue.version) return Promise.resolve(Response.json({ code: "40001", message: "version conflict" }, { status: 409 }));
        Object.assign(issue, p.update.patch);
        if (p.update.status) issue.status = p.update.status;
        return respond(issue);
      }
      throw new Error(`Unexpected RPC ${p_fn}`);
    }
    if (url.hostname === "bloomsuite.app") return Promise.resolve(new Response("unhealthy", { status: 503 }));
    if (url.pathname.endsWith("/labels")) return respond(scenario === "project_hold" ? [{ name: "release-hold" }] : []);
    if (url.pathname === "/v13/deployments/release.vercel.app") return respond({ ...released,
      ...(scenario === "wrong_project" ? { projectId: "other" } : {}),
      ...(scenario === "wrong_repo" ? { meta: { ...meta, githubRepo: "other" } } : {}),
      ...(scenario === "mutable_alias" ? { url: "another.vercel.app" } : {}),
    });
    if (url.pathname === "/v13/deployments/dpl_previous") return respond({ ...released, id: "dpl_previous", url: "previous.vercel.app", meta: { ...meta, githubCommitSha: "b".repeat(40) }, ...(scenario === "previous_project" ? { projectId: "other" } : {}) });
    if (url.pathname === "/v9/projects/project") {
      if (scenario === "provider_error") throw new Error("provider unavailable");
      return respond({ id: "project", targets: scenario === "missing_target" ? {} : { production: { ...released,
        ...(scenario === "newer_release" ? { id: "dpl_newer", meta: { ...meta, githubCommitSha: "c".repeat(40) } } : {}),
        ...(scenario === "same_sha_new_id" ? { id: "dpl_rebuilt" } : {}),
      } } });
    }
    if (url.pathname === "/v1/projects/project/rollback/dpl_previous") {
      assertEquals(init?.method, "POST"); posts++; return respond({});
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    for (scenario of ["unchanged", "newer_release", "same_sha_new_id", "wrong_project", "wrong_repo", "mutable_alias", "previous_project", "missing_target", "provider_error", "version", "status", "project_hold", "global_pause", "scope_pause", "ticket_hold", "resolved", "account_pause"]) {
      await t.step(scenario, async () => {
        posts = 0; issueReads = 0;
        issue = { id: "issue", version: 1, status: "verifying", repository: repo, pr_number: 42, head_sha: sha, merge_sha: sha, evidence: { github_issue: { number: 7 } }, tickets: [{ id: "ticket", status: "working", kind: "bug" }], deployment: { state: "success", url: "https://release.vercel.app", production_sha: sha }, rollback: { previous_deployment_id: "dpl_previous", previous_commit_sha: "b".repeat(40), provider: "vercel" } };
        try { await verify({ principalId: "release", role: "release", via: "service", scopes: [] }, "issue"); }
        catch (error) { if (scenario !== "version") throw error; }
        assertEquals(posts, scenario === "unchanged" ? 1 : 0, "only the still-current unheld release may initiate rollback");
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) Deno.env.delete(key); else Deno.env.set(key, value);
    }
  }
});
