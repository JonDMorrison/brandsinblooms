import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  classify, DEFAULT_RELEASE_POLICY, evaluateRelease, indicatesStillBroken, isAutomatedEmail, matchesAny, mergeModelClassification,
  parseReferences, redactText, resolvePolicy, sanitizeContext, stripQuotedReply, ticketNumberFromSubject, type IssueFacts, type PullRequestFacts,
} from "./policy.ts";
import { signIntake, verifyIntakeSignature, verifySvix, hmacSha256 } from "./crypto.ts";

Deno.test("sanitizeContext keeps allow-listed fields and strips secrets", () => {
  const out = sanitizeContext({
    page_url: "https://shop.test/checkout?token=abc123&step=2#frag",
    password: "hunter2",
    app_version: "abc123",
    record_refs: { order_id: "o1", card_number: "4242 4242 4242 4242", session_token: "x" },
    random_field: "drop me",
    error_message: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U failed",
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

Deno.test("classify routes without requiring the user to choose", () => {
  assertEquals(classify("Checkout broken", "Customers cannot take payments, checkout is broken. Expected it to work.", "cms").kind, "bug");
  assertEquals(classify("Checkout broken", "Customers cannot take payments, checkout is broken.", "cms").priority, "urgent");
  assertEquals(classify("Idea", "It would be great if we could add gift cards", "pos").kind, "feature");
  assertEquals(classify("Question", "How do I add a new staff member?", "pos").kind, "question");
  assertEquals(classify("Update", "Please update our holiday hours on the website", "cms").kind, "request");
  const bug = classify("Broken", "It's broken", "unknown");
  assert(bug.missing.length >= 2);
});

Deno.test("model classification cannot lower an outage priority or invent vocabulary", () => {
  const rules = classify("Down", "site is down", "cms");
  assertEquals(mergeModelClassification(rules, { kind: "question", priority: "low", impact: "account", category: "website", missing: [], confidence: 0.9 }).priority, "urgent");
  assertEquals(mergeModelClassification(rules, { kind: "delete-everything", priority: "low" }), rules);
});

Deno.test("automated mail and loops are detected", () => {
  assertEquals(isAutomatedEmail("a@b.com", "Out of Office: back Monday", {}, []), "autoreply-subject");
  assertEquals(isAutomatedEmail("a@b.com", "Hi", { "Auto-Submitted": "auto-replied" }, []), "auto-submitted");
  assertEquals(isAutomatedEmail("mailer-daemon@b.com", "x", {}, []), "system-sender");
  assertEquals(isAutomatedEmail("support@bloomsuite.app", "Re: x", {}, ["bloomsuite.app"]), "own-domain");
  assertEquals(isAutomatedEmail("news@b.com", "Weekly", { "List-Id": "<x>" }, []), "mailing-list");
  assertEquals(isAutomatedEmail("gail@greenleaf.ca", "Re: [Bloom #1203] Campaign", {}, ["bloomsuite.app"]), null);
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

const goodIssue: IssueFacts = { kind: "bug", reproduced: true, intendedBehaviourEstablished: true, productsTouched: 1, labels: [], hasProductionVerification: true, hasRollback: true };
const repo = "Brands-In-Blooms/cms-brandsinblooms";
const policy = { ...resolvePolicy({ approvedPaths: { [repo]: ["src/components/**"] }, requiredChecks: { [repo]: ["build", "unit"] } }, true) };
function pr(over: Partial<PullRequestFacts> = {}): PullRequestFacts {
  return {
    repository: repo,
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
