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
    id: "promotion-test", repository: "Brands-In-Blooms/cms-brandsinblooms",
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
    if (url.pathname.includes("/compare/")) return respond({ status: promoted ? "ahead" : "diverged" });
    if (url.pathname.endsWith("/pulls")) return respond([]);
    if (url.pathname.endsWith("/branches/main")) return respond({ commit: { sha: "production-sha" } });
    if (url.pathname.endsWith("/deployments")) return respond([{ id: 1, environment: "Production" }]);
    if (url.pathname.endsWith("/statuses")) return respond([{ state: deploymentState }]);
    if (url.pathname === "/v9/projects/test-project") return respond({ alias: [] });
    throw new Error(`Unexpected request ${url}`);
  };
  try {
    await t.step("persisted backoff is 60, 120, 240, then capped at 300 seconds", async () => {
      for (const delay of [60, 120, 240, 300, 300, 300]) {
        const result = await deploy(actor, issue.id);
        assertEquals(result.next, { step: "deploy", delaySeconds: delay });
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
      assertEquals((await deploy(actor, issue.id)).next?.delaySeconds, 300);
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
