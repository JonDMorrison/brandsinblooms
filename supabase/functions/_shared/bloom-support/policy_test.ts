import { assert, assertEquals, assertFalse, assertRejects } from "@std/assert";
import {
  authorizedManualForwarder, classify, DEFAULT_RELEASE_POLICY, evaluateRelease, indicatesStillBroken, isAutomatedEmail, linkedTicketReleaseFacts, matchesAny, mergeModelClassification,
  parseReferences, PRODUCT_REPOSITORIES, redactForEngineering, redactText, releaseBaseForPR, resolvePolicy, sanitizeContext, stripQuotedReply, ticketNumberFromSubject, type IssueFacts, type PullRequestFacts,
} from "./policy.ts";
import { signIntake, verifyIntakeSignature, verifySvix, hmacSha256 } from "./crypto.ts";
import { isProductionEnvironment, productionCommitForRepair, pullRequestFacts, releaseLabels } from "./github.ts";
import { readBodyText, readJson } from "./runtime.ts";

Deno.test("sanitizeContext keeps allow-listed fields and strips secrets", () => {
  const out = sanitizeContext({
    page_url: "https://shop.test/checkout?token=abc123&step=2#frag",
    password: "hunter2",
    app_version: "abc123",
    record_refs: { order_id: "o1", card_number: "4242 4242 4242 4242", session_token: "x" },
    random_field: "drop me",
    error_message: `Bearer ${"eyJ" + "hbGciOiJIUzI1NiJ9"}.${"eyJ" + "zdWIiOiIxMjM0NTY3ODkwIn0"}.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U failed`,
  });
  assertEquals(Object.keys(out).sort(), ["app_version", "error_message", "page_url", "record_refs"]);
  assert(String(out.page_url).includes("token=%5Bredacted%5D"));
  assertFalse(String(out.page_url).includes("#frag"));
  assertEquals(out.record_refs, { order_id: "o1" });
  assertFalse(String(out.error_message).includes("eyJ"));
});

Deno.test("redactText masks valid card numbers and keys, keeps ordinary numbers", () => {
  assertEquals(redactText("card 4242 4242 4242 4242 ok"), "card [redacted card] ok");
  assertEquals(redactText("order 1234567890123 shipped"), "order 1234567890123 shipped");
  assertEquals(redactText("key sk_live_abcdefghijkl"), "key [redacted key]");
});

Deno.test("engineering redaction removes contact details and customer identifiers only at the outbound boundary", () => {
  const privateSupportText = "Email jane.doe+orders@example.com or call +1 (604) 555-0123. Customer ID cust_4G8Q2. Site ID 5e7d2797-4169-46ae-b2d2-db3cb6990b7a. Order 1234567890123.";
  assertEquals(redactText(privateSupportText), privateSupportText, "the private desk keeps contact details available to staff");
  assertEquals(
    redactForEngineering(privateSupportText),
    "Email [redacted email] or call [redacted phone]. Customer ID: [redacted customer id]. Site ID: [redacted customer id]. Order 1234567890123.",
  );
  assertEquals(redactForEngineering("released 2026-11-05 in build 12345678"), "released 2026-11-05 in build 12345678", "dates and ordinary build numbers are not mistaken for phone numbers");
  assertEquals(redactForEngineering("Phone: 6045550123"), "Phone: [redacted phone]");
});

Deno.test("classify routes without requiring the user to choose", () => {
  assertEquals(classify("Checkout broken", "Customers cannot take payments, checkout is broken. Expected it to work.", "cms").kind, "bug");
  assertEquals(classify("Checkout broken", "Customers cannot take payments, checkout is broken.", "cms").priority, "urgent");
  assertEquals(classify("Idea", "It would be great if we could add gift cards", "pos").kind, "feature");
  assertEquals(classify("Question", "How do I add a new staff member?", "pos").kind, "question");
  assertEquals(classify("Update", "Please update our holiday hours on the website", "cms").kind, "change");
  const bug = classify("Broken", "It's broken", "unknown");
  assert(bug.missing.length >= 2);
});

Deno.test("model classification cannot lower an outage priority or invent vocabulary", () => {
  const rules = classify("Down", "site is down", "cms");
  const merged = mergeModelClassification(rules, { kind: "question", priority: "low", impact: "account", category: "website", missing: [], confidence: 0.9 });
  assertEquals(rules.kind, "incident");
  assertEquals(merged.kind, "incident");
  assertEquals(merged.priority, "urgent");
  assertEquals(mergeModelClassification(rules, { kind: "delete-everything", priority: "low" }), rules);
});

Deno.test("deterministic outage evidence covers varied current high-impact failures", () => {
  const cases: Array<[string, string]> = [
    ["Website unavailable", "Every customer sees an unavailable page and cannot access the store."],
    ["Checkout failing", "Payments fail for every customer right now."],
    ["Website not loading", "The website will not load for anyone."],
    ["Platform disruption", "We are experiencing a current service outage."],
    ["POS outage", "No one can use the tills; all stores see 503 errors."],
    ["Cannot access the platform", "Customers cannot access the platform."],
    ["BloomSites unavailable", "BloomSites is unavailable across multiple sites."],
    ["Login failure", "No one can log in to the CRM."],
    ["App crash", "The app crashes for every user."],
  ];
  for (const [subject, body] of cases) {
    const rules = classify(subject, body, "cms");
    assertEquals(rules.kind, "incident", `${subject}: deterministic rules recognize the observed outage`);
    assertEquals(rules.priority, "urgent", `${subject}: observed outages are urgent`);
    const merged = mergeModelClassification(rules, {
      kind: "question", priority: "low", impact: "single_user", category: "website", missing: [], confidence: 0.95,
    });
    assertEquals(merged.kind, "incident", `${subject}: a model cannot downgrade deterministic outage evidence`);
    assertEquals(merged.priority, "urgent", `${subject}: a model cannot lower deterministic outage urgency`);
  }
});

Deno.test("model classification cannot turn routing checks or outage-information questions into incidents", () => {
  const cases: Array<[string, string]> = [
    ["Support-subdomain fallback check", "Please confirm the established address reaches the same support pipeline. No staff action is required."],
    ["Status question", "Is there an outage page where I can check service health?"],
    ["Reporting question", "How do I report an outage?"],
    ["Notification question", "Can I subscribe to outage alerts?"],
    ["Website down?", "Is the website down?"],
    ["Store status", "Are all stores unavailable?"],
    ["Outage notification test", "Please send a test outage notification."],
    ["Platform outage", "Where can I find outage history?"],
    ["Website down", "Can I subscribe to status alerts?"],
  ];
  for (const [subject, body] of cases) {
    const rules = classify(subject, body, "unknown");
    assertFalse(rules.kind === "incident", `${subject}: an information request is not outage evidence`);
    const merged = mergeModelClassification(rules, {
      kind: "incident", priority: "normal", impact: "platform", category: "support", missing: [], confidence: 0.92,
    });
    assertFalse(merged.kind === "incident", `${subject}: a model-only incident label cannot page people`);
  }
});

Deno.test("automated mail and loops are detected", () => {
  assertEquals(isAutomatedEmail("a@b.com", "Out of Office: back Monday", {}, []), "autoreply-subject");
  assertEquals(isAutomatedEmail("a@b.com", "Hi", { "Auto-Submitted": "auto-replied" }, []), "auto-submitted");
  assertEquals(isAutomatedEmail("mailer-daemon@b.com", "x", {}, []), "system-sender");
  assertEquals(isAutomatedEmail("support@bloomsuite.app", "Re: x", {}, ["support@bloomsuite.app"]), "own-address");
  assertEquals(isAutomatedEmail("jon@bloomsuite.app", "Fwd: x", {}, ["support@bloomsuite.app"]), null, "staff on the same domain are not Bloom");
  assertEquals(isAutomatedEmail("news@b.com", "Weekly", { "List-Id": "<x>" }, []), "mailing-list");
  assertEquals(isAutomatedEmail("gail@greenleaf.ca", "Re: [Bloom #1203] Campaign", {}, ["support@bloomsuite.app"]), null);
});

Deno.test("reply parsing threads and strips quotes", () => {
  assertEquals(ticketNumberFromSubject("Re: [Bloom #1203] Campaign stuck"), 1203);
  assertEquals(parseReferences({ "In-Reply-To": "<a@x>", References: "<r@x> <a@x>" }), ["<a@x>", "<r@x>"]);
  assertEquals(stripQuotedReply("Still broken for me.\n\nOn Tue, Oct 31, 2026 at 9:00 AM Bloom <s@x> wrote:\n> old"), "Still broken for me.");
  assert(indicatesStillBroken("This is still not working on my phone"));
  assertFalse(indicatesStillBroken("Thanks, that fixed it!"));
});

Deno.test("globs", () => {
  assert(matchesAny("supabase/migrations/2026_x.sql", ["supabase/migrations/**"]));
  assert(matchesAny("src/lib/stripe/checkout.ts", ["**/*checkout*"]));
  assert(matchesAny("app/components/Hero.tsx", ["app/components/**"]));
  assertFalse(matchesAny("app/api/x.ts", ["app/components/**"]));
});

const goodIssue: IssueFacts = { kind: "bug", reproduced: true, intendedBehaviourEstablished: true, productsTouched: 1, labels: [], labelsVerified: true, scopeEstablished: true, featureProductApproved: true, hasProductionVerification: true, hasRollback: true };
const repo = "Brands-In-Blooms/cms-brandsinblooms";
const policy = { ...resolvePolicy({ approvedPaths: { [repo]: ["src/components/**"] }, requiredChecks: { [repo]: ["build", "unit"] } }, true) };
function pr(over: Partial<PullRequestFacts> = {}): PullRequestFacts {
  return {
    repository: repo,
    factsComplete: true,
    files: [{ path: "src/components/events/EventCard.tsx", additions: 6, deletions: 2, status: "modified" }, { path: "src/components/events/EventCard.regression.test.tsx", additions: 30, deletions: 0, status: "added" }],
    checks: [{ name: "build", status: "completed", conclusion: "success" }, { name: "unit", status: "completed", conclusion: "success" }],
    reviews: [{ state: "APPROVED", author: "jon", independent: true }],
    unresolvedThreads: 0, mergeable: true, baseBranch: "dev",
    testFilesAdded: ["src/components/events/EventCard.regression.test.tsx"], testFilesModifiedOrDeleted: [],
    ...over,
  };
}

Deno.test("eligible contained bug fix passes", () => {
  const r = evaluateRelease(policy, goodIssue, pr());
  assertEquals(r.reasons, []);
  assert(r.eligible);
});

Deno.test("automatic release waits for every current-head check, not only required checks", () => {
  const green = pr();
  assert(evaluateRelease(policy, goodIssue, green).eligible);
  for (const status of ["queued", "in_progress", "pending", "waiting", "requested", "unknown"]) {
    for (const name of ["additional-browser-check", "build"]) {
      // Include a duplicate required name: the first green result must not hide
      // another run of that check which is still running.
      const checks = [...green.checks, { name, status, conclusion: null }];
      const result = evaluateRelease(policy, goodIssue, { ...green, checks });
      assertFalse(result.eligible, `${name}: ${status} blocks automatic release`);
      assert(result.reasons.includes("checks still running"));
    }
  }
  const staleConclusion = evaluateRelease(policy, goodIssue, {
    ...green, checks: [...green.checks, { name: "additional-check", status: "queued", conclusion: "success" }],
  });
  assertFalse(staleConclusion.eligible, "a queued check's stale success does not establish completion");
  // Preserve the existing policy for completed optional checks and independent review.
  assert(evaluateRelease(policy, goodIssue, {
    ...green, checks: [...green.checks, { name: "not-applicable", status: "completed", conclusion: "skipped" }],
  }).eligible);
  assertFalse(evaluateRelease(policy, goodIssue, { ...green, reviews: [] }).eligible);
});

Deno.test("fresh premerge eligibility rejects a check that started after an earlier green decision", () => {
  const current = pr();
  assert(evaluateRelease(policy, goodIssue, current).eligible);
  current.checks.push({ name: "late-current-head-check", status: "in_progress", conclusion: null });
  const refreshed = evaluateRelease(policy, goodIssue, current);
  assertFalse(refreshed.eligible);
  assertEquals(refreshed.reasons, ["checks still running"]);
  current.checks[current.checks.length - 1] = { name: "late-current-head-check", status: "completed", conclusion: "success" };
  assert(evaluateRelease(policy, goodIssue, current).eligible);
});

Deno.test("sensitive and policy-weakening changes always need review", () => {
  const cases: Array<[string, PullRequestFacts | IssueFacts]> = [
    ["migration", pr({ files: [{ path: "supabase/migrations/20261101_x.sql", additions: 3, deletions: 0, status: "added" }] })],
    ["payment", pr({ files: [{ path: "src/components/checkout/PaymentForm.tsx", additions: 1, deletions: 1, status: "modified" }] })],
    ["auth", pr({ files: [{ path: "src/lib/auth/session.ts", additions: 1, deletions: 1, status: "modified" }] })],
    ["workflow", pr({ files: [{ path: ".github/workflows/ci.yml", additions: 1, deletions: 1, status: "modified" }] })],
    ["policy file", pr({ files: [{ path: "supabase/functions/_shared/bloom-support/policy.ts", additions: 1, deletions: 1, status: "modified" }] })],
    ["weakened test", pr({ testFilesModifiedOrDeleted: ["src/components/events/EventCard.test.tsx"] })],
    ["failing check", pr({ checks: [{ name: "build", status: "completed", conclusion: "success" }, { name: "unit", status: "completed", conclusion: "failure" }] })],
    ["missing check", pr({ checks: [{ name: "build", status: "completed", conclusion: "success" }] })],
    ["self review only", pr({ reviews: [{ state: "APPROVED", author: "bloom-bot", independent: false }] })],
    ["open thread", pr({ unresolvedThreads: 1 })],
    ["outside approved area", pr({ files: [{ path: "src/lib/catalogue/match.ts", additions: 2, deletions: 1, status: "modified" }] })],
    ["too big", pr({ files: Array.from({ length: 8 }, (_, i) => ({ path: `src/components/a${i}.tsx`, additions: 5, deletions: 0, status: "modified" })) })],
  ];
  for (const [name, facts] of cases) {
    const r = "files" in facts ? evaluateRelease(policy, goodIssue, facts) : evaluateRelease(policy, facts, pr());
    assertFalse(r.eligible, `${name} must not be eligible`);
  }
  assertFalse(evaluateRelease(policy, { ...goodIssue, kind: "feature" }, pr()).eligible, "features need review");
  assertFalse(evaluateRelease(policy, { ...goodIssue, reproduced: false }, pr()).eligible, "unreproduced needs review");
  assertFalse(evaluateRelease(policy, { ...goodIssue, productsTouched: 2 }, pr()).eligible, "cross-product needs review");
  assertFalse(evaluateRelease({ ...policy, autoReleaseEnabled: false }, goodIssue, pr()).eligible, "switch off");
});

Deno.test("stored policy cannot remove default sensitive paths", () => {
  const p = resolvePolicy({ sensitivePaths: [], maxChangedFiles: 999 }, true);
  assert(p.sensitivePaths.includes("supabase/migrations/**"));
  assertEquals(p.maxChangedFiles, 20);
  assertEquals(DEFAULT_RELEASE_POLICY.autoReleaseEnabled, false);
});

Deno.test("production evidence excludes preview and demo names before provider flags", () => {
  assert(isProductionEnvironment({ environment: "Production – BloomSuite", production_environment: false }));
  assert(isProductionEnvironment({ environment: "Production - POS", production_environment: false }));
  assertFalse(isProductionEnvironment({ environment: "Production – demo", production_environment: true }));
  assertFalse(isProductionEnvironment({ environment: "Preview – pull-request", production_environment: true }));
});

Deno.test("a trusted merged source-to-main squash is production evidence", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = Deno.env.get("BLOOM_GITHUB_RELEASE_TOKEN");
  Deno.env.set("BLOOM_GITHUB_RELEASE_TOKEN", "test-release-token");
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/compare/dev-merge-sha...main")) return Promise.resolve(Response.json({ status: "diverged" }));
    if (url.includes("/pulls?state=closed")) {
      return Promise.resolve(Response.json([{
        merged: true,
        merge_commit_sha: "main-squash-sha",
        head: { sha: "release-pr-head", ref: "dev" },
        base: { ref: "main" },
      }]));
    }
    if (url.includes("/compare/dev-merge-sha...release-pr-head")) return Promise.resolve(Response.json({ status: "ahead" }));
    if (url.includes("/compare/main-squash-sha...main")) return Promise.resolve(Response.json({ status: "ahead" }));
    return Promise.resolve(Response.json({ message: "unexpected" }, { status: 404 }));
  }) as typeof fetch;
  try {
    assertEquals(
      await productionCommitForRepair(
        "Brands-In-Blooms/cms-brandsinblooms",
        "dev-merge-sha",
        "dev",
      ),
      "main-squash-sha",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) Deno.env.delete("BLOOM_GITHUB_RELEASE_TOKEN");
    else Deno.env.set("BLOOM_GITHUB_RELEASE_TOKEN", originalToken);
  }
});

Deno.test("bounded bodies reject declared and streamed UTF-8 byte overflow", async () => {
  const declared = new Request("https://example.test/report", {
    method: "POST",
    headers: { "content-length": "11" },
    body: "small",
  });
  await assertRejects(
    () => readBodyText(declared, 10),
    Error,
    "Request too large",
  );

  const chunks = ["{\"body\":\"", "🌷🌷", "\"}"];
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk === undefined) controller.close();
      else controller.enqueue(new TextEncoder().encode(chunk));
    },
  });
  await assertRejects(
    () => readJson(new Request("https://example.test/public", { method: "POST", body }), 15),
    Error,
    "Request too large",
  );
});

Deno.test("product intake signatures", async () => {
  const body = JSON.stringify({ report: { body: "x" } });
  const ts = Math.floor(Date.now() / 1000);
  const sig = await signIntake("s3cret", ts, body);
  assert(await verifyIntakeSignature("s3cret", String(ts), sig, body));
  assertFalse(await verifyIntakeSignature("s3cret", String(ts), sig, body + " "));
  assertFalse(await verifyIntakeSignature("other", String(ts), sig, body));
  assertFalse(await verifyIntakeSignature("s3cret", String(ts - 1000), await signIntake("s3cret", ts - 1000, body), body));
});

Deno.test("svix signatures (Resend webhooks)", async () => {
  const secretBytes = new TextEncoder().encode("0123456789abcdef0123456789abcdef");
  const secret = "whsec_" + btoa(String.fromCharCode(...secretBytes));
  const ts = String(Math.floor(Date.now() / 1000));
  const body = '{"type":"email.received"}';
  const sig = btoa(String.fromCharCode(...await hmacSha256(secretBytes, `msg_1.${ts}.${body}`)));
  assert(await verifySvix(secret, "msg_1", ts, `v1,${sig}`, body));
  assertFalse(await verifySvix(secret, "msg_2", ts, `v1,${sig}`, body));
});

Deno.test("manual forwarding aliases require aligned DKIM and grant no automatic staff authority", () => {
  const aliases = ["jon@brandsinblooms.com"];
  assert(authorizedManualForwarder("Jon@BrandsInBlooms.com", true, false, aliases));
  assert(authorizedManualForwarder("jeff@brandsinblooms.com", true, true, aliases));
  assertFalse(authorizedManualForwarder("jon@brandsinblooms.com", false, false, aliases));
  assertFalse(authorizedManualForwarder("jon@brandsinblooms.com", false, true, aliases));
  assertFalse(authorizedManualForwarder("attacker@example.com", true, false, aliases));
  assertFalse(authorizedManualForwarder("jon@brandsinblooms.com.attacker.test", true, false, aliases));
  assertFalse(authorizedManualForwarder("jon@brandsinblooms.com", true, false, []));
});

Deno.test("new BloomSites repairs target main without confusing already opened dev PRs", () => {
  const cms = PRODUCT_REPOSITORIES.cms.repository;
  assertEquals(PRODUCT_REPOSITORIES.cms.base, "main");
  assertEquals(releaseBaseForPR(cms, "main"), "main");
  assertEquals(releaseBaseForPR(cms, "dev"), "dev");
  assertEquals(releaseBaseForPR(PRODUCT_REPOSITORIES.crm.repository, "dev"), null);
  assertEquals(releaseBaseForPR(PRODUCT_REPOSITORIES.pos.repository, "dev"), null);
  assertEquals(releaseBaseForPR(cms, "feature/unreviewed"), null);
  assertEquals(releaseBaseForPR("Other/repository", "main"), null);
  assertEquals(releaseBaseForPR(cms, undefined), null);
});

Deno.test("release eligibility requires complete ticket scope and verified labels", () => {
  const good = { kind: "bug", product: "cms" };
  assertEquals(linkedTicketReleaseFacts([good, good], "cms", repo), {
    kind: "bug", productsTouched: 1, scopeEstablished: true, featureProductApproved: true,
  });
  assertEquals(linkedTicketReleaseFacts([{ ...good, kind: "feature" }], "cms", repo).kind, "feature");
  for (const tickets of [[], [null], [good, null], [good, { kind: "feature", product: "cms" }]]) {
    const facts = linkedTicketReleaseFacts(tickets, "cms", repo);
    assertFalse(evaluateRelease(policy, { ...goodIssue, ...facts }, pr()).eligible);
  }
  for (const tickets of [[{ kind: "bug" }], [{ kind: "bug", product: "unknown" }],
    [good, { kind: "bug", product: "crm" }], [{ kind: "bug", product: "platform" }]]) {
    assertFalse(linkedTicketReleaseFacts(tickets, "cms", repo).scopeEstablished);
  }
  assertFalse(linkedTicketReleaseFacts([good], "crm", repo).scopeEstablished);
  assertFalse(linkedTicketReleaseFacts([good], "cms", "other/repo").scopeEstablished);
  for (const productsTouched of [0, -1, NaN, Infinity, 1.5]) {
    assertFalse(evaluateRelease(policy, { ...goodIssue, productsTouched }, pr()).eligible);
  }
  assertFalse(evaluateRelease(policy, { ...goodIssue, labelsVerified: false }, pr()).eligible);
  for (const label of ["security", "payments", "release-hold", "do-not-merge", "blocked"]) {
    assertFalse(evaluateRelease(policy, { ...goodIssue, labels: [label] }, pr()).eligible);
  }
});

Deno.test("evaluate uses authorized linked summaries, fails closed on agent claims and preserves approved release holds", async () => {
  const { evaluate } = await import("./engineering.ts");
  const originalFetch = globalThis.fetch;
  const keys = { SUPABASE_URL: "https://bloom-poll.test", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", BLOOM_GITHUB_RELEASE_TOKEN: "test-release-token", BLOOM_VERCEL_TOKEN: "test-vercel-token" };
  const prior = Object.fromEntries(Object.keys(keys).map((key) => [key, Deno.env.get(key)]));
  for (const [key, value] of Object.entries(keys)) Deno.env.set(key, value);
  const repository = "JonDMorrison/brandsinblooms";
  let kind = "bug", product = "crm", missing = false;
  let labels = ["bloom-repair"];
  let eligibility: { eligible: boolean; reasons: string[] } | null = null;
  const issue = {
    id: "11111111-2222-4333-8444-555555555555", product: "crm", repository, status: "in_review",
    pr_number: 42, approved_head_sha: "claimed-head", evidence: { github_issue: { number: 7 } },
    reproduction: { reproduced: true, failing_test: "src/claimed.test.ts", intended_behaviour_established: true },
    tickets: [{ id: "ticket-1" }, { id: "ticket-2" }],
  };
  const ticketReads: string[] = [];
  const policy = {
    approvedPaths: { [repository]: ["src/components/**"] }, requiredChecks: { [repository]: ["unit"] },
    verificationOrigins: { [repository]: ["https://bloomsuite.app"] },
    verificationChecks: { [repository]: [{ url: "https://bloomsuite.app/health" }] },
    vercel: { [repository]: { projectId: "test-project" } },
  };
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const respond = (body: unknown) => Promise.resolve(Response.json(body));
    if (url.pathname === "/rest/v1/rpc/bloom_support_rpc") {
      const { p_fn, p } = JSON.parse(String(init?.body));
      if (p_fn === "list_engineering") return respond([{
        ...issue,
        tickets: issue.tickets.map((ticket) => missing ? ticket : {
          ...ticket, kind: ticket.id === "ticket-1" ? "bug" : kind, product,
        }),
      }]);
      if (p_fn === "setting") return respond(p.key === "release_policy" ? policy : true);
      if (p_fn === "get_ticket") {
        ticketReads.push(p.ticket_id);
        throw new Error("Release principal must not read full tickets");
      }
      if (p_fn === "update_engineering_issue") {
        eligibility = p.update.patch.eligibility;
        Object.assign(issue, p.update.patch);
        if (p.update.status) issue.status = p.update.status;
        return respond(issue);
      }
      throw new Error(`Unexpected RPC ${p_fn}`);
    }
    if (url.pathname === "/v9/projects/test-project") return respond({ alias: [] });
    if (url.pathname === "/graphql") return respond({ data: { repository: { pullRequest: { reviewThreads: { nodes: [] } } } } });
    assertEquals(init?.method, "GET", "blocked evaluations must never merge");
    if (url.pathname.endsWith("/pulls/42")) return respond({
      number: 42, state: "open", merged: false, mergeable: true,
      head: { ref: "bloom/fix-11111111", sha: "claimed-head" }, base: { ref: "main" }, user: { login: "bloom" },
    });
    if (url.pathname.endsWith("/files")) return respond([{ filename: "src/components/Card.tsx", additions: 1, deletions: 1, status: "modified" }]);
    if (url.pathname.endsWith("/check-runs")) return respond({ check_runs: [{ name: "unit", status: "completed", conclusion: "success" }] });
    if (url.pathname.endsWith("/status")) return respond({ statuses: [] });
    if (url.pathname.endsWith("/reviews")) return respond([{ state: "APPROVED", user: { login: "reviewer" }, commit_id: "claimed-head" }]);
    if (url.pathname.endsWith("/labels")) return respond(labels.map((name) => ({ name })));
    throw new Error(`Unexpected GitHub read ${url.pathname}`);
  };
  const actor = { principalId: "release-test", role: "release", via: "service" as const, scopes: [] };
  const check = async () => {
    eligibility = null; ticketReads.length = 0;
    assertEquals((await evaluate(actor, issue.id)).note, "awaiting approval");
    assertEquals(ticketReads, [], "release evaluation uses summaries, never full ticket reads");
    const result = eligibility as { eligible: boolean; reasons: string[] } | null;
    assertEquals(result?.eligible, false);
    assertEquals(result?.reasons.includes("bug was not reproduced"), true);
    return result!.reasons;
  };
  try {
    assertEquals(await check(), ["bug was not reproduced"]);
    kind = "feature";
    assertEquals((await check()).includes("only bugs are eligible; features and behaviour changes need review"), true);
    kind = "bug"; product = "unknown";
    assertEquals((await check()).includes("product scope is not established"), true);
    product = "crm"; missing = true;
    assertEquals((await check()).includes("product scope is not established"), true);
    missing = false; labels = ["security", "release-hold"];
    const reasons = await check();
    assertEquals(reasons.includes("issue carries a sensitive label"), true);
    assertEquals(reasons.includes("project release hold"), true);
    issue.status = "approved";
    assertEquals((await evaluate(actor, issue.id)).note, "approved, waiting: project release hold");
    labels = ["bloom-repair"];
    // A person can approve the current head despite unavailable automatic
    // reproduction, but the existing rollback safeguard still prevents merge.
    assertEquals((await evaluate(actor, issue.id)).note, "merge blocked: rollback point could not be proven");
    issue.status = "approved";
    issue.approved_head_sha = "older-head";
    assertEquals((await evaluate(actor, issue.id)).note, "re-approval needed");
    issue.status = "approved";
    issue.approved_head_sha = "claimed-head";
    issue.evidence.github_issue.number = 0;
    assertEquals((await evaluate(actor, issue.id)).note, "approved, waiting: PR and issue labels are not verified");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) Deno.env.delete(key); else Deno.env.set(key, value);
    }
  }
});

Deno.test("release labels include source-issue holds and reject incomplete label evidence", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = Deno.env.get("BLOOM_GITHUB_RELEASE_TOKEN");
  Deno.env.set("BLOOM_GITHUB_RELEASE_TOKEN", "test-release-token");
  let issueLabels: unknown = [{ name: "release-hold" }];
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assertEquals(init?.method, "GET");
    return Promise.resolve(Response.json(url.pathname.endsWith("/issues/7/labels") ? issueLabels : [{ name: "bloom-repair" }]));
  };
  try {
    assertEquals(await releaseLabels("owner/repo", 42, 7), ["bloom-repair", "release-hold"]);
    assertEquals(await releaseLabels("owner/repo", 42, undefined), null);
    issueLabels = Array.from({ length: 100 }, () => ({ name: "ordinary" }));
    assertEquals(await releaseLabels("owner/repo", 42, 7), null);
    issueLabels = [{ name: null }];
    assertEquals(await releaseLabels("owner/repo", 42, 7), null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) Deno.env.delete("BLOOM_GITHUB_RELEASE_TOKEN");
    else Deno.env.set("BLOOM_GITHUB_RELEASE_TOKEN", originalToken);
  }
});

Deno.test("bounded GitHub fact pages must be complete before release evaluation", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = Deno.env.get("BLOOM_GITHUB_RELEASE_TOKEN");
  Deno.env.set("BLOOM_GITHUB_RELEASE_TOKEN", "test-release-token");
  let fullPage = "";
  const repeated = <T>(page: string, value: T, bound = 100): T[] =>
    Array.from({ length: fullPage === page ? bound : 1 }, () => value);
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const respond = (body: unknown) => Promise.resolve(Response.json(body));
    if (url.pathname === "/graphql") return respond({ data: { repository: { pullRequest: {
      reviewThreads: { nodes: repeated("threads", { isResolved: true }) },
    } } } });
    assertEquals(init?.method, "GET", "fact collection is read only");
    if (url.pathname.endsWith("/pulls/42")) return respond({
      number: 42, state: "open", merged: false, mergeable: true,
      head: { ref: "repair", sha: "fixture-head" }, base: { ref: "main" }, user: { login: "author" },
    });
    if (url.pathname.endsWith("/files")) return respond(repeated("files", {
      filename: "src/components/Card.tsx", additions: 1, deletions: 1, status: "modified",
    }));
    if (url.pathname.endsWith("/check-runs")) return respond({ check_runs: repeated("checks", {
      name: "unit", status: "completed", conclusion: "success",
    }) });
    if (url.pathname.endsWith("/status")) return respond({ statuses: repeated("statuses", {
      context: "build", state: "success",
    }, 30) });
    if (url.pathname.endsWith("/reviews")) return respond(repeated("reviews", {
      state: "APPROVED", user: { login: "reviewer" }, commit_id: "fixture-head",
    }));
    throw new Error(`Unexpected read ${url.pathname}`);
  };
  try {
    for (const page of ["", "files", "checks", "statuses", "reviews", "threads"]) {
      fullPage = page;
      const { facts } = await pullRequestFacts(repo, 42, []);
      assertEquals(facts.factsComplete, page === "", page || "complete short pages");
      const result = evaluateRelease(policy, goodIssue, facts);
      assertEquals(result.reasons.includes("GitHub release facts are incomplete"), page !== "");
    }
    assert(evaluateRelease(policy, goodIssue, { ...pr(), factsComplete: false }).reasons.includes("GitHub release facts are incomplete"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) Deno.env.delete("BLOOM_GITHUB_RELEASE_TOKEN");
    else Deno.env.set("BLOOM_GITHUB_RELEASE_TOKEN", originalToken);
  }
});

Deno.test("every linked feature needs its own positive human product decision", () => {
  for (const tickets of [[], new Array<null>(1), [null]]) {
    assertFalse(linkedTicketReleaseFacts(tickets, "cms", repo).featureProductApproved,
      "empty or missing linked evidence cannot establish product approval");
  }
  const approved = { kind: "feature", product: "cms", feature_request_id: "exact-feature", feature_status: "accepted", feature_product_approved: true };
  for (const status of ["accepted", "planned", "shipped"]) {
    assertEquals(linkedTicketReleaseFacts([{ ...approved, feature_status: status }], "cms", repo).featureProductApproved, true);
  }
  for (const ticket of [
    null,
    {},
    { kind: "unknown" },
    { ...approved, feature_request_id: null },
    { ...approved, feature_status: "declined" },
    { ...approved, feature_status: "awaiting_decision" },
    { ...approved, feature_status: "merged" },
    { ...approved, feature_product_approved: false },
    { ...approved, feature_product_approved: undefined },
    { ...approved, kind: "bug", feature_product_approved: false },
  ]) {
    const scope = linkedTicketReleaseFacts([approved, ticket], "cms", repo);
    assertFalse(scope.featureProductApproved, "another feature's approval cannot authorize this one");
    assert(evaluateRelease(policy, { ...goodIssue, ...scope }, pr()).reasons.includes("feature requires a separate human product approval"));
  }
});
