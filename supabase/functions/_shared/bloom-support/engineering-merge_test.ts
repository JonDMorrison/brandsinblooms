import { assertEquals } from "@std/assert";
Deno.test("pre-merge recheck preserves holds and changed release decisions after rollback discovery", async (t) => {
    const { evaluate } = await import("./engineering.ts");
    const originalFetch = globalThis.fetch;
    const keys = { SUPABASE_URL: "https://bloom-poll.test", SUPABASE_SERVICE_ROLE_KEY: "test", BLOOM_GITHUB_RELEASE_TOKEN: "test", BLOOM_VERCEL_TOKEN: "test" };
    const prior = Object.fromEntries(Object.keys(keys).map(key => [key, Deno.env.get(key)]));
    for (const [key, value] of Object.entries(keys))
        Deno.env.set(key, value);
    const repository = "JonDMorrison/brandsinblooms";
    const issue = { id: "race", title: "race", version: 1, product: "crm", repository, status: "approved", pr_number: 42, head_sha: "head", approved_head_sha: "head", eligibility: { base_branch: "main" }, evidence: { github_issue: { number: 7 } }, reproduction: {}, tickets: [{ id: "t", kind: "bug", product: "crm", feature_request_id: null as string | null, feature_status: null as string | null, feature_product_approved: false }] };
    const policy = { requiredChecks: { [repository]: ["unit"] }, verificationOrigins: { [repository]: ["https://bloomsuite.app"] }, verificationChecks: { [repository]: [{ url: "https://bloomsuite.app/health" }] }, vercel: { [repository]: { projectId: "test-project" } } };
    let hold = false, merges = 0;
    let scenario = "hold";
    const serving = { uid: "previous", url: "previous.test", readyState: "READY", meta: { githubCommitSha: "previous-sha" } };
    globalThis.fetch = (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const respond = (body: unknown) => Promise.resolve(Response.json(body));
        if (url.pathname === "/rest/v1/rpc/bloom_support_rpc") {
            const { p_fn, p } = JSON.parse(String(init?.body));
            if (p_fn === "list_engineering")
                return respond([issue]);
            if (p_fn === "setting")
                return respond(p.key === "release_policy" ? policy : true);
            if (p_fn === "update_engineering_issue") {
                if (p.update.version !== undefined && p.update.version !== issue.version)
                    throw new Error("version conflict");
                Object.assign(issue, p.update.patch);
                if (p.update.status)
                    issue.status = p.update.status;
                issue.version++;
                return respond(issue);
            }
            throw new Error(`Unexpected RPC ${p_fn}`);
        }
        if (url.pathname === "/v9/projects/test-project") {
            hold = true;
            if (scenario === "revoked") {
                issue.status = "escalated";
                issue.version++;
            }
            if (scenario === "empty_after") issue.tickets = [];
            if (scenario === "feature_revoked") {
                issue.tickets[0].feature_status = "declined";
                issue.tickets[0].feature_product_approved = false;
            }
            return respond({ alias: [{ target: "PRODUCTION", deployment: serving }] });
        }
        if (url.pathname === "/v6/deployments")
            return respond({ deployments: [serving] });
        if (url.pathname.includes("/compare/"))
            return respond({ status: "behind" });
        if (url.pathname.endsWith("/merge")) {
            merges++;
            return respond({ merged: true, sha: "merged-sha" });
        }
        if (url.pathname === "/graphql")
            return respond({ data: { repository: { pullRequest: { reviewThreads: { nodes: [] } } } } });
        if (url.pathname.endsWith("/pulls/42"))
            return respond({ number: 42, state: "open", merged: false, mergeable: true, head: { ref: "fix", sha: "head" }, base: { ref: "main" }, user: { login: "repair" } });
        if (url.pathname.endsWith("/files"))
            return respond([{ filename: "src/Card.tsx", additions: 1, deletions: 1, status: "modified" }]);
        if (url.pathname.endsWith("/check-runs"))
            return respond({ check_runs: [{ name: "unit", status: "completed", conclusion: "success" }] });
        if (url.pathname.endsWith("/status"))
            return respond({ statuses: [] });
        if (url.pathname.endsWith("/reviews"))
            return respond([{ state: "APPROVED", user: { login: "reviewer" }, commit_id: "head" }]);
        if (url.pathname.endsWith("/labels")) {
            if (hold && scenario === "unavailable")
                throw new Error("labels unavailable");
            return respond(hold && scenario === "hold" ? [{ name: "release-hold" }] : []);
        }
        throw new Error(`Unexpected fetch ${url}`);
    };
    try {
        for (scenario of ["hold", "revoked", "unavailable", "unchanged", "feature_missing", "feature_declined", "feature_approved", "feature_revoked", "empty_initial", "empty_after"]) {
            await t.step(scenario, async () => {
                hold = false;
                merges = 0;
                Object.assign(issue, { status: "approved", rollback: null, eligibility: { base_branch: "main" } });
                const feature = scenario.startsWith("feature_");
                const productApproved = scenario === "feature_approved" || scenario === "feature_revoked";
                issue.tickets = [{ id: "t", product: "crm", kind: feature ? "feature" : "bug", feature_request_id: feature && scenario !== "feature_missing" ? "feature-exact" : null, feature_status: productApproved ? "accepted" : "declined", feature_product_approved: productApproved }];
                if (scenario === "empty_initial") issue.tickets = [];
                const result = await evaluate({ principalId: "release", role: "release", via: "service", scopes: [] }, issue.id);
                const shouldMerge = scenario === "unchanged" || scenario === "feature_approved";
                assertEquals(merges, shouldMerge ? 1 : 0, "merge must honor project holds, release decision, and separate feature product approval");
                assertEquals(issue.status, shouldMerge ? "deploying" : ["feature_missing", "feature_declined", "empty_initial"].includes(scenario) ? "approved" : "escalated");
                if (scenario === "revoked")
                    assertEquals(result.note, "release decision changed during rollback discovery");
            });
        }
    }
    finally {
        globalThis.fetch = originalFetch;
        for (const [key, value] of Object.entries(prior)) {
            if (value === undefined)
                Deno.env.delete(key);
            else
                Deno.env.set(key, value);
        }
    }
});
