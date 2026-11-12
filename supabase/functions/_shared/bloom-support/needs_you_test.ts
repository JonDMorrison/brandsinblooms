import { assert, assertEquals, assertFalse, assertMatch, assertNotMatch } from "@std/assert";
import {
  type EscalationFacts, failedStep, needsYouDelivery, needsYouStep, renderEscalationEmail, resolutionAlreadyTold, type StaffTicket,
} from "./support-emails.ts";
import { liveNextStep, nextStepFor, resolutionOutcome, resolutionPlan, supportLink } from "./next-step.ts";

const APP = "https://bloomsuite.app";
const NOW = new Date("2026-11-05T23:26:00Z");
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const CODE_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/;

function readable(htmlOrText: string): string {
  return htmlOrText.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/https:\/\/\S+/g, "").replace(/&[a-z#0-9]+;/g, " ");
}
/** Visible words, with the escaped quotes and apostrophes decoded. */
function words(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
}
function assertNoLeaks(s: string, label: string) {
  const r = readable(s);
  assertNotMatch(r, UUID_RE, `${label}: no UUIDs`);
  assertNotMatch(r, CODE_RE, `${label}: no snake_case codes`);
  assertNotMatch(r, /\b\d{6,}\b/, `${label}: no run ids`);
  assertNotMatch(r, /[{}]|"\w+":/, `${label}: no JSON`);
  assertNotMatch(r, /Cannot read properties|undefined|TypeError/, `${label}: no raw errors`);
  assertNotMatch(r, /\b(Jon|Jeff)\b/, `${label}: roles, not names`);
}

// Shaped like #1011 today: investigated, not reproduced, the client's later save worked (names anonymised).
const notReproduced = {
  version: 1,
  id: "43bd1617-4695-4abe-aafc-236a498a2e57",
  status: "open",
  repair_started_at: null,
  reproduction: {
    result: "not_reproduced",
    checked_at: "2026-11-04T21:30:00Z",
    organization: { id: "ce547514-d152-400f-a39e-6945e22c6551", name: "St Mary's Youth Group" },
    server_path_test: "PATCH /api/fundraising/organizations/[id] with the exact client payload returned 200 and called save_fundraising_organization_v1 once.",
  },
  evidence: {
    later_success: "Logo WYD_Logo2 uploaded 2026-11-03 16:12:54 UTC and saved 16:12:58 (RPC 200); org row now has a same-site CDN logo.",
    code_change: "none - no confirmed defect; no PR opened",
  },
};

const ticket: StaffTicket = {
  id: "b41dfe4c-3adc-4986-89e7-f98c222f3c40",
  number: 1011,
  subject: "When I add a logo for St Mary's in the fundraising organization page it won't let me save.",
  summary: null,
  status: "needs_owner", stage: "escalated", kind: "bug", product: "cms", automation: "auto",
  created_at: "2026-11-02T17:27:24Z",
  account: { name: "Greenleaf Garden Centre" },
  requester: { name: "Dana Whitfield", email: "dana@greenleaf.test" },
  engineering: notReproduced,
  escalations: [
    { reason: "engineering_start_requested", status: "acknowledged" },
    { reason: "ticket_overdue", status: "acknowledged" },
  ],
  messages: [
    { id: "m1", author_kind: "client", visibility: "public", body: "When I add a logo for St Mary's in the fundraising organization page it won't let me save.", created_at: "2026-11-02T17:27:24Z", delivery: "none" },
    { id: "m3", author_kind: "bloom", visibility: "public", purpose: "acknowledgement", body: "Thanks — we've received your request (#1011). Bloom is looking at it now and will keep you posted here.", created_at: "2026-11-02T17:28:09Z", delivery: "delivered" },
  ],
};
const fresh: StaffTicket = { ...ticket, engineering: null, escalations: [], status: "working", stage: "investigating" };
const overdue: EscalationFacts = { reason: "ticket_overdue", detail: "#1011 When I add a logo…", created_at: "2026-11-03T17:28:01Z" };

/** The one primary button (the bulletproof table) and where the always-visible facts start. */
function layout(html: string) {
  const buttons = html.match(/class="bs-button"/g)?.length ?? 0;
  const button = html.indexOf('class="bs-button"');
  const facts = html.indexOf(">Client</strong>");
  const details = html.indexOf(">The request</h2>");
  return { buttons, button, facts, details };
}

Deno.test("a preview or staff-only job failure never asks a person to act on the client's request", () => {
  for (const detail of ["notify: Cannot read properties of undefined (reading 'replace')", "digest: timeout after 115s", "escalate: provider 500"]) {
    assertEquals(needsYouStep({ reason: "automation_failed", detail }, fresh), null, detail);
  }
  // A failure in work the client depends on still does.
  assert(needsYouStep({ reason: "automation_failed", detail: "send_email: provider 500" }, fresh));
});

Deno.test("send-and-solve is chosen when the investigation says not reproduced", () => {
  assertEquals(resolutionOutcome(notReproduced), "not_reproduced");
  assertEquals(liveNextStep({ status: "needs_owner", automation: "auto", engineering: notReproduced })?.action, "send-and-solve");
  // A not-reproduced problem never offers an automatic repair, even with an old start request.
  assertEquals(liveNextStep({ status: "needs_owner", automation: "auto", engineering: notReproduced, escalations: [{ reason: "engineering_start_requested", status: "acknowledged" }] })?.action, "send-and-solve");
  for (const reason of ["ticket_overdue", "engineering_start_requested", "automation_failed"]) {
    const step = needsYouStep({ reason, detail: reason === "automation_failed" ? "triage: timeout" : null }, ticket);
    assertEquals(step?.action, "send-and-solve", reason);
  }
  // Resolved: a live fix with a passing check.
  const fixed = { id: "e", version: 1, status: "verified", deployment: { state: "success" }, verification: { passed: true, scope: "ticket_flow", started_at: "2026-11-08T00:00:00Z", ticket_ids: [ticket.id] } };
  assertEquals(resolutionOutcome(fixed, ticket.id), "fixed");
  assertEquals(needsYouStep(overdue, { ...fresh, engineering: fixed })?.action, "send-and-solve");
  // Not settled yet: no draft, the specific recommendation stays.
  assertEquals(resolutionOutcome({ id: "e", status: "investigating" }), null);
  assertEquals(needsYouStep({ reason: "engineering_awaiting_approval" }, { ...fresh, engineering: { id: "e", status: "awaiting_approval" } })?.action, "approve-fix");
  assertEquals(needsYouStep(overdue, { ...ticket, status: "resolved" }), null);
});

Deno.test("the drafted reply comes from stored facts with a fixed template", () => {
  const plan = resolutionPlan({ engineering: notReproduced, requesterName: "Dana Whitfield" })!;
  assertEquals(plan.outcome, "not_reproduced");
  assertMatch(plan.draft, /^Hi Dana,\n\n/);
  assertMatch(plan.draft, /couldn't reproduce the problem on our side, and we can see your logo saved successfully on Nov 3\./);
  assertEquals(plan.findings, [
    "Bloom investigated and couldn't reproduce the problem.",
    "The client saved the logo successfully on Nov 3.",
    "The same save, replayed on our side, worked.",
  ]);
  assertNoLeaks(plan.draft, "draft");
  assertEquals(resolutionPlan({ engineering: notReproduced, requesterName: "Dana Whitfield" }), plan, "deterministic");
  // Without evidence of a later success it claims only what it knows.
  const bare = resolutionPlan({ engineering: { id: "e", version: 1, status: "not_reproduced", reproduction: { checked_at: "2026-11-08T00:00:00Z" } }, requesterName: null })!;
  assertMatch(bare.draft, /^Hi there,/);
  assertFalse(/saved successfully/.test(bare.draft));
});

const cases: Array<{ name: string; x: EscalationFacts; t: StaffTicket; action: string; subject: RegExp }> = [
  { name: "#1011 now: not reproduced, reply drafted", x: overdue, t: ticket, action: "send-and-solve", subject: /^Ready to close: Greenleaf Garden Centre — When I add a logo .* \(#1011\) · reply drafted$/ },
  { name: "a client email kept failing", x: { reason: "automation_failed", detail: "send_email: email failed: provider 500 bad gateway" }, t: fresh, action: "take-over", subject: /^Needs a reply: Greenleaf Garden Centre/ },
  { name: "a fix waiting for approval", x: { reason: "engineering_awaiting_approval" }, t: { ...fresh, engineering: { id: "e", status: "awaiting_approval" } }, action: "approve-fix", subject: /^Needs a decision: / },
];

for (const c of cases) {
  Deno.test(`needs-you email (${c.name}): one button, before the facts, no codes`, () => {
    const mail = renderEscalationEmail({ escalation: c.x, ticket: c.t, appUrl: APP, now: NOW });
    assertEquals(mail.step.action, c.action);
    assertMatch(mail.subject, c.subject);
    const l = layout(mail.html);
    assertEquals(l.buttons, 1, "exactly one primary button");
    assert(l.button > 0 && l.button < l.facts, "the button comes before the facts");
    assert(l.facts < l.details, "details come after the facts");
    assert(mail.html.includes(`href="${supportLink(APP, c.t.id, mail.step.action).replace(/&/g, "&amp;")}"`), "the button deep-links the action");
    assert(mail.text.indexOf(`${mail.step.button}: `) < mail.text.indexOf("Client: "), "text: action before facts");
    assertNoLeaks(mail.subject, "subject");
    assertNoLeaks(mail.text, "text");
    assertNoLeaks(mail.html, "html");
  });
}

Deno.test("#1011 email: specific reason, quoted draft, send-and-solve link", () => {
  const mail = renderEscalationEmail({ escalation: overdue, ticket, appUrl: APP, now: NOW });
  assertEquals(mail.step, nextStepFor("send-and-solve"));
  assert(mail.html.includes("Send this reply and mark solved"));
  assert(mail.html.includes("action=send-and-solve"));
  assert(words(mail.html).includes("Bloom investigated and couldn't reproduce the problem. The client saved the logo successfully on Nov 3."));
  assert(mail.draft && mail.html.includes("The reply Bloom drafted"));
  assert(mail.text.includes("> Hi Dana,"));
  assertFalse(/automatic steps on this request kept failing/.test(mail.html), "no vague filler");
});

Deno.test("a failed step is named with a human error class", () => {
  assertEquals(failedStep("send_email: email failed: provider 500")?.label, "emailing the client");
  assertEquals(failedStep("send_email: email failed: provider 500")?.problem, "couldn't reach a service it depends on");
  assertEquals(failedStep("triage: timeout after 115s")?.problem, "kept timing out");
  assertEquals(failedStep("notify: Cannot read properties of undefined (reading 'replace')")?.problem, "hit a bug in Bloom's own code");
  const mail = renderEscalationEmail({ escalation: cases[1].x, ticket: fresh, appUrl: APP, now: NOW });
  assert(words(mail.html).includes("Bloom's step “emailing the client” couldn't reach a service it depends on after every retry"));
});

Deno.test("re-sends are de-duplicated: one needs-you per ticket per person per day; repeats go to the digest", () => {
  const step = nextStepFor("send-and-solve");
  const sentAt = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
  const withEmail = (h: number, status = "delivered", to = "owner@bloom.test"): StaffTicket => ({ ...ticket, emails: [{ purpose: "escalation", to, status, created_at: sentAt(h) }] });
  assertEquals(needsYouDelivery({ step, ticket, to: "owner@bloom.test", now: NOW }), "send");
  assertEquals(needsYouDelivery({ step, ticket: withEmail(4), to: "Owner@bloom.test", now: NOW }), "digest", "the 4-hourly re-fire");
  assertEquals(needsYouDelivery({ step, ticket: withEmail(25), to: "owner@bloom.test", now: NOW }), "send", "a day later");
  assertEquals(needsYouDelivery({ step, ticket: withEmail(4, "failed"), to: "owner@bloom.test", now: NOW }), "send", "a failed send is not a send");
  assertEquals(needsYouDelivery({ step, ticket: withEmail(4, "delivered", "other@bloom.test"), to: "owner@bloom.test", now: NOW }), "send");
  assertEquals(needsYouDelivery({ step: nextStepFor("approve-fix"), ticket: withEmail(1), to: "owner@bloom.test", now: NOW }), "send", "a decision is never held back");
  assertEquals(needsYouDelivery({ step: null, ticket, to: "owner@bloom.test", now: NOW }), "digest", "no concrete action, no email");
});

Deno.test("send-and-solve sends the client one email, not a reply plus a resolution email", () => {
  const msgs = [...(ticket.messages ?? []), { id: "r1", author_kind: "staff", visibility: "public", body: "Hi Dana…", created_at: NOW.toISOString(), delivery: "queued" }];
  assert(resolutionAlreadyTold({ via: "send-and-solve", reply_message_id: "r1" }, msgs));
  assertFalse(resolutionAlreadyTold({ verification: { passed: true } }, msgs), "an ordinary Mark solved still emails the summary");
  assertFalse(resolutionAlreadyTold({ via: "send-and-solve", reply_message_id: "missing" }, msgs));
  assertFalse(resolutionAlreadyTold({ via: "send-and-solve", reply_message_id: "r1" }, msgs.map((m) => (m.id === "r1" ? { ...m, delivery: "suppressed" } : m))));
});

Deno.test("a feature decision closes the support request without a duplicate resolution email", () => {
  const messages = [...(ticket.messages ?? []), {
    id: "feature-1", author_kind: "bloom", visibility: "public", purpose: "feature_decision",
    body: "Our product team plans to build this.", created_at: NOW.toISOString(), delivery: "queued",
  }];
  assert(resolutionAlreadyTold({ feature_decision_message_id: "feature-1", product_decision: "planned" }, messages));
  assertFalse(resolutionAlreadyTold({ feature_decision_message_id: "missing" }, messages));
});
