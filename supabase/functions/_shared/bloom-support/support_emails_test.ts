import { assert, assertEquals, assertFalse, assertMatch, assertNotMatch } from "@std/assert";
import { botanicalEmailIcon, PREMIUM_BOTANICAL_EMAIL, renderBotanicalEmail } from "./botanical-email.ts";
import {
  type AlertFinding, cleanStaffText, coalesceOutgoing, customerStatusLabel, type DigestReport, groupAlertFindings, type OutgoingMessage,
  reasonSentence, renderAlertEmail, renderCustomerEmail, renderDigestEmail, renderEscalationEmail, type StaffTicket, threadingHeaders,
  ticketThreadRoot, toolLabel,
} from "./support-emails.ts";
import { liveNextStep, nextStepForReason, supportLink } from "./next-step.ts";

const APP = "https://bloomsuite.app";
const NOW = new Date("2026-11-03T18:00:00Z");
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const CODE_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/;

/** What a person reads: text without tags and without link targets. */
function readable(htmlOrText: string): string {
  return htmlOrText
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/https:\/\/\S+/g, "")
    .replace(/&[a-z#0-9]+;/g, " ");
}

function assertNoLeaks(s: string, label: string) {
  const r = readable(s);
  assertNotMatch(r, UUID_RE, `${label}: no UUIDs`);
  assertNotMatch(r, CODE_RE, `${label}: no snake_case codes`);
  assertNotMatch(r, /\b\d{6,}\b/, `${label}: no run ids`);
  assertNotMatch(r, /[{}]|"\w+":/, `${label}: no JSON`);
}

// Shaped like the real #1011 escalation (fundraising logo upload, website client).
const ticket1011: StaffTicket = {
  id: "0b8a7f6e-1c2d-4e3f-9a8b-7c6d5e4f3a2b",
  number: 1011,
  subject: "When I add a logo for St Mary's in the fundraising organization page it won't let me save.",
  summary: "When I add a logo for St Mary's in the fundraising organization page it won't let me save.",
  status: "working", stage: "investigating", kind: "bug", product: "cms", automation: "auto",
  created_at: "2026-11-02T17:27:24Z",
  account: { name: "Greenleaf Garden Centre" },
  messages: [
    { id: "m1", author_kind: "client", visibility: "public", body: "When I add a logo for St Mary's in the fundraising organization page it won't let me save.", created_at: "2026-11-02T17:27:24Z", delivery: "none" },
    { id: "m2", author_kind: "bloom", visibility: "internal", body: "Triage (model): bug, high, fundraising", created_at: "2026-11-02T17:28:09Z", delivery: "none" },
    { id: "m3", author_kind: "bloom", visibility: "public", purpose: "acknowledgement", body: "Thanks — we've received your request (#1011). Bloom is looking at it now and will keep you posted here.", created_at: "2026-11-02T17:28:09Z", delivery: "delivered" },
  ],
};

Deno.test("every escalation reason code becomes a sentence with no raw code", () => {
  for (const reason of [
    "ticket_overdue", "engineering_failed", "engineering_start_requested", "engineering_awaiting_approval", "engineering_escalated",
    "engineering_not_reproduced", "engineering_rolled_back", "engineering_merging", "automation_failed", "decision_needed", "feature_decision",
    "some_new_code", "Urgent request needs a person",
  ]) {
    const s = reasonSentence(reason, "Repair run 41831389396 failed before doing any work (codex auth) 0b8a7f6e-1c2d-4e3f-9a8b-7c6d5e4f3a2b");
    assert(s.length > 10, reason);
    assertNoLeaks(s, reason);
  }
  assertEquals(reasonSentence("engineering_failed", "Repair run 41831389396 failed before doing any work (codex auth)"),
    "Bloom's automatic repair couldn't sign in to do the work, so nothing was changed.");
});

Deno.test("cleanStaffText strips ids, JSON and codes", () => {
  const s = cleanStaffText('Repair run 41831389396 failed {"tool_name":"x"} for c190e3a2-1111-4222-8333-444455556666 on explore_customer_purchases');
  assertNoLeaks(s, "clean");
  assertMatch(s, /look up customer purchases/);
});

for (const reason of ["ticket_overdue", "engineering_failed", "engineering_start_requested"]) {
  Deno.test(`escalation email (${reason}) is readable, safe and has one primary action`, () => {
    const mail = renderEscalationEmail({
      escalation: { reason, detail: reason === "engineering_failed" ? "Repair run 41831389396 failed before doing any work (codex auth)." : "#1011 When I add a logo…",
        recommendation: null, created_at: "2026-11-03T17:28:01Z" },
      ticket: ticket1011, appUrl: APP, now: NOW,
    });
    assertNoLeaks(mail.subject, "subject");
    assertNoLeaks(mail.text, "text");
    assertNoLeaks(mail.html, "html");
    // The subject says what to do: a reply for a stuck or overdue request, a decision for a repair start.
    assertMatch(mail.subject, /^Needs a (reply|decision): Greenleaf Garden Centre — When I add a logo .* \(#1011\)$/);
    assert(mail.html.includes("What Bloom told the client"));
    assert(mail.html.includes("we&#39;ve received your request"));
    assert(mail.html.includes("What Bloom did"));
    assert(mail.html.includes(mail.step.recommendation.replace(/'/g, "&#39;")));
    // One primary button, deep-linked to the ticket with the recommended action.
    assertEquals(mail.html.match(/bgcolor="#1B3049" style="border-radius:8px/g)?.length, 1);
    assert(mail.html.includes(`href="${supportLink(APP, ticket1011.id, mail.step.action).replace(/&/g, "&amp;")}"`));
    assertFalse(/Needs Jon\/Jeff/.test(mail.html));
  });
}

Deno.test("overdue headline says who is waiting, how long, on what", () => {
  const mail = renderEscalationEmail({ escalation: { reason: "ticket_overdue" }, ticket: ticket1011, appUrl: APP, now: NOW });
  assert(mail.html.includes("Greenleaf Garden Centre is waiting 24 hours on “When I add a logo"));
  assertEquals(mail.step.action, "take-over");
});

Deno.test("customer emails never show internal status labels", () => {
  for (const status of ["new", "working", "waiting", "needs_owner", "resolved", "something_else"]) {
    const label = customerStatusLabel(status, "internal");
    assertNotMatch(label, /Jon|Jeff|needs|owner|_/i);
    const mail = renderCustomerEmail({ number: 1015, subject: "Import past orders", status, purpose: "progress", bodies: ["Thanks for the suggestion."], trackUrl: "https://bloomsuite.app/support/track/abc" });
    assertNotMatch(mail.text, /Needs Jon\/Jeff|Jon|Jeff/);
    assertNotMatch(mail.html, /Needs Jon\/Jeff|Jon\/Jeff/);
    assert(mail.text.includes("Track this request: https://bloomsuite.app/support/track/abc"));
    assert(mail.html.includes('href="https://bloomsuite.app/support/track/abc"'));
  }
  assertEquals(customerStatusLabel("needs_owner"), "With our team");
  assertEquals(customerStatusLabel("waiting", "customer"), "Waiting for your reply");
  assertEquals(customerStatusLabel("received"), "Received");
  assertEquals(customerStatusLabel("in_progress"), "In progress");
  assertEquals(customerStatusLabel("waiting_on_you"), "Waiting for your reply");
});

Deno.test("threading: a stable per-ticket root, then In-Reply-To and References to it", () => {
  const root = ticketThreadRoot("t-1", "support.bloomsuite.app");
  assertEquals(root, "<bloom-ticket.t-1@support.bloomsuite.app>");
  assertEquals(threadingHeaders(root, { root }), {});
  const second = threadingHeaders("<bloom.b@x>", { root });
  assertEquals(second, { "In-Reply-To": root, References: root });
  const third = threadingHeaders("<bloom.c@x>", { root, inReplyTo: "<bloom.b@x>", references: ["<bloom.b@x>"] });
  assertEquals(third["In-Reply-To"], "<bloom.b@x>");
  assertEquals(third.References, `${root} <bloom.b@x>`);
});

Deno.test("coalescing: two Bloom messages queued in the same second become one email", () => {
  const msgs: OutgoingMessage[] = [
    { id: "client", author_kind: "staff", visibility: "public", body: "Client request…", created_at: "2026-11-05T17:30:10.098Z", delivery: "none" },
    { id: "note", author_kind: "bloom", visibility: "internal", body: "Bloom read this as a feature idea.", created_at: "2026-11-05T17:30:32.493Z", delivery: "none" },
    { id: "ack", author_kind: "bloom", visibility: "public", purpose: "acknowledgement", body: "Thanks — we've received your request (#1015).", created_at: "2026-11-05T17:30:32.533Z", delivery: "queued" },
    { id: "fwd", author_kind: "bloom", visibility: "public", purpose: "progress", body: "We've passed it to Jon for a decision.", created_at: "2026-11-05T17:30:32.597Z", delivery: "queued" },
    { id: "later", author_kind: "bloom", visibility: "public", body: "Much later", created_at: "2026-11-05T19:00:00Z", delivery: "queued" },
  ];
  assertEquals(coalesceOutgoing(msgs, "ack").map((m) => m.id), ["ack", "fwd"]);
  // The second message's own job finds nothing earlier to pull in.
  assertEquals(coalesceOutgoing(msgs, "fwd").map((m) => m.id), ["fwd"]);
  // A person's message is never folded into Bloom's email (it may not notify the client).
  assertEquals(coalesceOutgoing(msgs, "client").map((m) => m.id), ["client"]);
});

const westCoast: AlertFinding[] = [
  { condition: "bloom_tool_failures", tools: [{ tenant_id: "c190e3a2-1111-4222-8333-444455556666", tenant_name: "Harbour View Gardens", tool_name: "explore_customer_purchases", calls: 5, failed: 5 }] },
  { condition: "bloom_tool_timeouts", tools: [{ tenant_id: "c190e3a2-1111-4222-8333-444455556666", tenant_name: "Harbour View Gardens", tool_name: "explore_customer_purchases", timeouts: 5 }] },
];

Deno.test("alert dedupe: failures and timeouts for one tool and company are one alert", () => {
  const groups = groupAlertFindings(westCoast);
  assertEquals(groups.length, 1);
  assertEquals(groups[0].tools, [{ tenant: "Harbour View Gardens", tool: "explore_customer_purchases", calls: 5, failed: 5, timeouts: 5 }]);
  assertEquals(groups[0].conditions, ["bloom_tool_failures", "bloom_tool_timeouts"]);
  // Other findings stay separate.
  assertEquals(groupAlertFindings([...westCoast, { condition: "dead_jobs", jobs: 2 }]).length, 2);
});

Deno.test("alert email is plain English with impact, what Bloom is doing and one button", () => {
  const mail = renderAlertEmail(groupAlertFindings(westCoast)[0], { appUrl: APP });
  assertEquals(mail.subject, "Bloom alert: Bloom couldn't look up customer purchases for Harbour View Gardens");
  assert(mail.text.includes("5 of 5 tries failed, 5 timed out in the last hour"));
  assert(mail.html.includes("Who is affected"));
  assert(mail.html.includes("What Bloom is doing"));
  assertNoLeaks(mail.subject + mail.text, "alert text");
  assertNoLeaks(mail.html, "alert html");
  assertEquals(toolLabel("query_widgets"), "look up widgets");
});

const digest: DigestReport = {
  needs_you: [{ id: ticket1011.id, number: 1011, subject: ticket1011.subject, client: "Greenleaf Garden Centre", reason: "ticket_overdue", since: "2026-11-03T17:28:01Z" }],
  resolved: [{ number: 1013, subject: "Email intake test", client: null, by_bloom: true, summary: null }],
  said: [
    { number: 1015, subject: "Import past orders", client: "Fern & Co", body: "Thanks — we've received your request (#1015).", at: "2026-11-05T17:30:32Z" },
    { number: 1015, subject: "Import past orders", client: "Fern & Co", body: "We've passed it to the team for a decision.", at: "2026-11-05T17:30:33Z" },
  ],
  repairs: [{ title: "Fundraising slug ends with a dash", status: "awaiting_approval", client: null }],
  alerts: westCoast.map((d) => ({ condition: d.condition, detail: d, at: "2026-11-05T10:00:00Z" })),
};

Deno.test("digest covers needs-you, resolved, said, repairs and alerts; skipped when empty", () => {
  const mail = renderDigestEmail(digest, { appUrl: APP, date: "Thu, Nov 5" })!;
  for (const section of ["What needs you", "What Bloom resolved", "What Bloom said to clients", "Repairs in progress", "Alerts"]) {
    assert(mail.html.includes(section), section);
  }
  assertEquals(mail.subject, "Bloom daily: 1 request needs you today");
  assert(mail.html.includes(supportLink(APP, ticket1011.id, "take-over").replace(/&/g, "&amp;")));
  // Failures + timeouts for the same tool show as one alert line.
  assertEquals((mail.text.match(/Bloom couldn't look up customer purchases/g) ?? []).length, 1);
  assertNoLeaks(mail.subject + mail.text, "digest text");
  assertNoLeaks(mail.html, "digest html");
  assertEquals(renderDigestEmail({ needs_you: [], resolved: [], said: [], repairs: [], alerts: [] }, { appUrl: APP, date: "x" }), null);
});

Deno.test("the live ticket decides the action; a stale link hint is ignored", () => {
  assertEquals(liveNextStep({ status: "working", automation: "auto", engineering: { id: "e", status: "awaiting_approval" } })?.action, "approve-fix");
  assertEquals(liveNextStep({ status: "working", automation: "auto" }, "approve-fix")?.action, "take-over");
  assertEquals(liveNextStep({ status: "working", automation: "human" }, "take-over")?.action, "reply");
  assertEquals(liveNextStep({ status: "resolved", automation: "auto" }, "take-over"), null);
  assertEquals(liveNextStep({ status: "working", automation: "auto", engineering: { id: "e", status: "open" }, escalations: [{ reason: "engineering_start_requested", status: "open" }] })?.action, "start-repair");
  assertEquals(nextStepForReason("engineering_awaiting_approval").action, "approve-fix");
});

Deno.test("botanical palette and icon host match BloomSites premium-botanical.ts", () => {
  // Copied from cms-brandsinblooms src/lib/emails/premium-botanical.ts (PREMIUM_BOTANICAL_EMAIL, ASSETS).
  // `callout` is BloomSites calloutBlock's #F8F9F6, which is also POS POS_EMAIL_ART.panel.
  assertEquals({ ...PREMIUM_BOTANICAL_EMAIL }, {
    navy: "#1B3049", ink: "#243D55", body: "#536475", muted: "#5B6B79", sage: "#527566",
    page: "#FAF9F6", panel: "#F5F7F3", callout: "#F8F9F6", border: "#DBE3DF", white: "#FFFFFF",
  });
  for (const icon of ["sun", "water", "soil", "check", "truck", "calendar", "mail", "alert", "leaf"] as const) {
    const img = botanicalEmailIcon(icon);
    assert(img.includes(`src="https://bloomsites.app/email/premium-icons/${icon}.png"`), icon);
    assert(img.includes('alt=""'), icon);
  }
  const html = renderBotanicalEmail({ header: "Bloom Support", eyebrow: "x", title: "<b>t</b>", preheader: "p", bodyHtml: "", footer: "f" });
  assert(html.includes('width="600"'));
  assert(html.includes("&lt;b&gt;t&lt;/b&gt;"));
  assertFalse(/<script|<svg|@import|font-face/i.test(html));
});

Deno.test("digest renders alerts whose detail has no condition (escalation_unanswered from the live report)", () => {
  const mail = renderDigestEmail({
    needs_you: [], resolved: [], said: [], repairs: [],
    alerts: [
      { condition: "escalation_unanswered", at: "2026-11-05T02:01:12Z", detail: { reason: "ticket_overdue", escalation_id: "2960c9bb-5ec6-4cfc-a840-6379cd9f9d6c" } as unknown as AlertFinding },
      { condition: "bloom_tool_timeouts", at: "2026-11-05T00:00:02Z", detail: { condition: "bloom_tool_timeouts", tools: [{ timeouts: 4, tool_name: "explore_customer_purchases", tenant_name: "West Coast Gardens" }] } },
    ],
  }, { appUrl: APP, date: "Thu, Nov 5" })!;
  assert(mail);
  assertNotMatch(mail.html, /2960c9bb|escalation_unanswered|ticket_overdue/);
  assertMatch(mail.html, /West Coast Gardens/);
});

Deno.test("digest merges repeat firings of the same escalation alert into one line with a count", () => {
  const esc = "2960c9bb-5ec6-4cfc-a840-6379cd9f9d6c";
  // Shape of the live bloom_support_digest_report rows: one per deadline sweep that missed again.
  const repeat = [8, 9, 10, 11, 12].map((level) => ({
    condition: "escalation_unanswered", at: `2026-11-05T${String(level).padStart(2, "0")}:00:00Z`,
    detail: { reason: "ticket_overdue", escalation_id: esc } as unknown as AlertFinding,
  }));
  const report: DigestReport = {
    needs_you: [], resolved: [], said: [], repairs: [],
    alerts: [...repeat, { condition: "dead_jobs", at: "2026-11-05T19:30:00Z", detail: { condition: "dead_jobs", jobs: 2 } }],
  };
  const mail = renderDigestEmail(report, { appUrl: APP, date: "Thu, Nov 5" })!;
  const escLines = mail.text.split("\n").filter((l) => /escalated request/i.test(l));
  assertEquals(escLines, ["• An escalated request still has no reply from a person (flagged 5 times)"]);
  assertEquals((mail.html.match(/escalated request still has no reply/g) ?? []).length, 1);
  assertMatch(mail.text, /Some of Bloom's automatic steps gave up/);
  assertNotMatch(mail.html, new RegExp(`${esc}|escalation_unanswered|ticket_overdue`));

  // A second, different escalation shares the line rather than repeating it.
  const two = renderDigestEmail({ ...report, alerts: [...report.alerts, { condition: "escalation_unanswered", at: "2026-11-05T13:30:00Z", detail: { reason: "ticket_overdue", escalation_id: "ae67e02c-361d-410c-9e49-54c6596891df" } as unknown as AlertFinding }] }, { appUrl: APP, date: "Thu, Nov 5" })!;
  assertEquals(two.text.split("\n").filter((l) => /escalated request/i.test(l)), ["• An escalated request still has no reply from a person (2 cases, flagged 6 times)"]);
});

Deno.test("alert grouping keeps different escalations and checks apart and counts repeats", () => {
  const groups = groupAlertFindings([
    { condition: "escalation_unanswered", escalation_id: "a" }, { condition: "escalation_unanswered", escalation_id: "a" },
    { condition: "escalation_unanswered", escalation_id: "b" },
    { condition: "watchdog_check_failed", check: "x" }, { condition: "watchdog_check_failed", check: "y" },
  ]);
  assertEquals(groups.map((g) => [g.key, g.count]), [
    ["escalation_unanswered:a", 2], ["escalation_unanswered:b", 1], ["watchdog_check_failed:x", 1], ["watchdog_check_failed:y", 1],
  ]);
});
