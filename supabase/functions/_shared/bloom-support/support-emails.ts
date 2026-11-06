// Bloom Support — every email Bloom sends, built on the botanical visual contract.
// Pure: no I/O and no Deno globals. The worker gathers the data; these
// functions turn it into a subject, a plain-text body and an HTML body.
//
// Staff emails never show raw reason codes, UUIDs, run IDs or JSON. Customer
// emails never show internal routing labels.
import {
  botanicalEmailButton, botanicalEmailClientLine, botanicalEmailFacts, botanicalEmailLinks, botanicalEmailList, botanicalEmailParagraph,
  botanicalEmailQuote, botanicalEmailSection, type BotanicalEmailFact, type ClientBrand, clientWebsite, renderBotanicalEmail,
} from "./botanical-email.ts";
import { asSentence, humanizeStaffNote } from "./notes.ts";
import {
  DECISION_ACTIONS, type EngineeringFacts, liveNextStep, type NextAction, type NextStep, nextStepFor, nextStepForReason, type ResolutionPlan,
  resolutionPlan, supportLink,
} from "./next-step.ts";
import { BLOOM_ROLE_DISCLOSURE, BLOOM_SIGNATURE } from "./voice.ts";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

// ---------------------------------------------------------------------------
// Plain-language helpers
// ---------------------------------------------------------------------------
const PRODUCT_NAME: Record<string, string> = {
  cms: "BloomSites", crm: "BloomSuite CRM", pos: "BloomSuite POS", platform: "BloomSuite", unknown: "BloomSuite",
};
export const productName = (p: string | null | undefined) => PRODUCT_NAME[String(p ?? "unknown")] ?? "BloomSuite";

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const LONG_NUMBER = /\b\d{6,}\b/g;
const SNAKE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

const words = (code: string | null | undefined) => String(code ?? "").replace(/[_-]+/g, " ").trim();

/**
 * Makes staff-facing free text safe to show: no UUIDs, run IDs, JSON or
 * snake_case codes. Known codes become words; anything else is spelled out.
 */
export function cleanStaffText(input: string | null | undefined, max = 400): string {
  let s = String(input ?? "").trim();
  if (!s) return "";
  if (/^[[{]/.test(s)) {
    try {
      JSON.parse(s);
      return "";
    } catch { /* not JSON; keep cleaning */ }
  }
  s = s.replace(/\{[^{}]*"[^{}]*\}/g, "").replace(/\[[^[\]]*"[^[\]]*\]/g, "");
  s = s.replace(UUID, "").replace(/\b(run|job|id|issue|pr)\s+#?\d{3,}\b/gi, "$1").replace(LONG_NUMBER, "");
  s = s.replace(SNAKE, (code) => TOOL_LABEL[code] ?? words(code));
  s = s.replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** "under an hour", "5 hours", "26 hours", "3 days". */
export function formatAge(ms: number): string {
  const hours = Math.floor(Math.max(0, ms) / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} days`;
}

export function formatWhen(iso: string, timeZone = "America/Toronto"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

const cleanSubject = (s: string) => s.replace(/^(re|fwd?):\s*/i, "").replace(/\[Bloom #\d+\]\s*/i, "").trim();
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** A ticket subject cut to a scannable topic: first clause, at most `max` characters, on a word boundary. */
export function shortTopic(subject: string, max = 60): string {
  let s = cleanSubject(subject).replace(/\s+/g, " ");
  const first = s.split(/(?<=[.!?])\s|;\s|,\s+and\s/)[0];
  if (first.length >= 12) s = first;
  s = s.replace(/[.!?]+$/, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Customer-facing status (never an internal routing label)
// ---------------------------------------------------------------------------
export function customerStatusLabel(status: string, waitingReason?: string | null): string {
  switch (status) {
    case "new": return "Received";
    case "working": return "In progress";
    case "waiting": return waitingReason === "customer" ? "Waiting for your reply" : "In progress";
    case "needs_owner": return "With our team";
    case "resolved": return "Resolved";
    // Client reads of the ticket API already arrive projected (bloom_support.client_status).
    case "received": return "Received";
    case "in_progress": return "In progress";
    case "waiting_on_you": return "Waiting for your reply";
    default: return "In progress";
  }
}

// ---------------------------------------------------------------------------
// Threading: one Gmail/Outlook conversation per ticket
// ---------------------------------------------------------------------------
/** A stable per-ticket thread root. The first email for the ticket uses it as its Message-ID. */
export function ticketThreadRoot(ticketId: string, domain: string): string {
  return `<bloom-ticket.${ticketId}@${domain}>`;
}

/** In-Reply-To and References for an email, always anchored to the ticket's thread root. */
export function threadingHeaders(messageId: string, opts: { root: string; inReplyTo?: string | null; references?: string[] }): Record<string, string> {
  if (messageId === opts.root && !opts.inReplyTo) return {};
  const parent = opts.inReplyTo ?? opts.root;
  const refs = [...new Set([opts.root, ...(opts.references ?? []), parent].filter((x): x is string => !!x && x !== messageId))];
  return { "In-Reply-To": parent, References: refs.join(" ") };
}

// ---------------------------------------------------------------------------
// Coalescing: messages queued together go out as one email
// ---------------------------------------------------------------------------
export interface OutgoingMessage {
  id: string;
  author_kind: string;
  visibility: string;
  body: string;
  created_at: string;
  delivery?: string | null;
  purpose?: string | null;
  ticket_id?: string | null;
}

/**
 * The anchor message plus every later public, still-queued Bloom message on
 * the same ticket within `windowMs`, oldest first. Earlier messages belong to
 * their own (earlier) send job in the same lane. Only Bloom's own messages are
 * folded in: Bloom messages always email the client, while a person's public
 * message may have been posted without notifying them.
 */
export function coalesceOutgoing(messages: OutgoingMessage[], anchorId: string, windowMs = 120_000, ticketId?: string): OutgoingMessage[] {
  const anchor = messages.find((m) => m.id === anchorId);
  if (!anchor) return [];
  const start = new Date(anchor.created_at).getTime();
  const rest = messages.filter((m) =>
    m.id !== anchor.id &&
    m.visibility === "public" &&
    m.author_kind === "bloom" &&
    anchor.author_kind === "bloom" &&
    m.delivery === "queued" &&
    (!ticketId || !m.ticket_id || m.ticket_id === ticketId) &&
    new Date(m.created_at).getTime() >= start &&
    new Date(m.created_at).getTime() - start <= windowMs
  );
  return [anchor, ...rest].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || (a.id === anchor.id ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Customer emails
// ---------------------------------------------------------------------------
const CUSTOMER_FOOTER = "Bloom Support for BloomSites, BloomSuite CRM and BloomSuite POS. Reply to this email at any time; your message stays with this request.";

function customerFirstName(value: string | null | undefined): string | null {
  const clean = [...String(value ?? "")]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point < 32 || point === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || clean.includes("@")) return null;
  return clean.split(" ")[0].slice(0, 40) || null;
}

function customerEmailMoment(input: { purpose: string; status: string; body: string; fromBloom: boolean }) {
  const resolved = input.purpose === "resolution" || input.status === "resolved";
  const ack = input.purpose === "acknowledgement";
  const clarify = input.purpose === "clarification";
  const feature = input.purpose === "feature_decision" || /product team (?:has accepted|plans to build|reviewed)|feature is now available/i.test(input.body);
  const handoff = /hand(?:ing|ed) this to a person|person on our support team/i.test(input.body);
  const investigation = /started (?:the |an )?investigation|possible incident|possible product problem/i.test(input.body);
  if (!input.fromBloom) return {
    eyebrow: "A reply from our team", title: "Our support team replied", icon: "mail" as const,
    intro: "A person from BloomSuite Support has replied to your request.",
    next: "Reply to this email if you need anything else. Your response will stay in the same conversation.",
  };
  if (resolved) return {
    eyebrow: "Request resolved", title: "Good news: this is sorted", icon: "check" as const,
    intro: "The result has been recorded on your request.",
    next: "If anything still isn't right, reply to this email. I'll reopen the request and continue from here.",
  };
  if (clarify) return {
    eyebrow: "One quick question", title: "A little more detail will help", icon: "alert" as const,
    intro: "Once you reply, I'll pick this up from the same place.",
    next: "Reply with the detail below. You don't need to repeat anything you've already shared.",
  };
  if (feature) return {
    eyebrow: "Feature update", title: "An update on your idea", icon: "leaf" as const,
    intro: "Your idea has been reviewed by our product team.",
    next: "Reply if you'd like help with an alternative or with using what is now available.",
  };
  if (handoff) return {
    eyebrow: "With our support team", title: "I've handed this over", icon: "mail" as const,
    intro: "A person has the request and the context already gathered.",
    next: "Our support team will continue in this same conversation. You can reply here at any time.",
  };
  if (investigation) return {
    eyebrow: "Investigation started", title: "I'm looking into this", icon: "leaf" as const,
    intro: "Your request is tied to the investigation, so the history stays together.",
    next: "No action is needed unless I ask a question. If a person is needed, I'll hand over the full context.",
  };
  if (ack) return {
    eyebrow: "Request received", title: "I've got your request", icon: "leaf" as const,
    intro: "I'll take the first look and keep the work connected to this conversation.",
    next: "I'll use approved guidance where it fits. If this needs a person, I'll hand it over with the context already gathered.",
  };
  return {
    eyebrow: "Update on your request", title: "Here's the latest", icon: "mail" as const,
    intro: "I've added an update to your request.",
    next: "Reply if this doesn't answer what you need. I'll keep the conversation moving from here.",
  };
}

export function renderCustomerEmail(input: {
  number: number;
  subject: string;
  status: string;
  waitingReason?: string | null;
  purpose: string;
  bodies: string[];
  trackUrl: string;
  /** Trusted display name from the requester's principal. Only the first name is shown. */
  requesterName?: string | null;
  /** A public message written by staff must never be presented as if Bloom wrote it. */
  sender?: "bloom" | "team";
  /** The client company, from the ticket's account. Its website and logo show only when validated. */
  client?: ClientBrand | null;
}): Omit<RenderedEmail, "subject"> {
  const status = customerStatusLabel(input.status, input.waitingReason);
  const body = input.bodies.map((b) => b.trim()).filter(Boolean).join("\n\n");
  const fromBloom = input.sender !== "team";
  const moment = customerEmailMoment({ purpose: input.purpose, status: input.status, body, fromBloom });
  const resolved = input.purpose === "resolution" || input.status === "resolved";
  const firstName = customerFirstName(input.requesterName);
  const greeting = `Hi ${firstName ?? "there"},`;
  const facts: BotanicalEmailFact[] = [
    { icon: "leaf", label: "Request", value: `#${input.number} ${clip(cleanSubject(input.subject), 90)}` },
    { icon: resolved ? "check" : "calendar", label: "Status", value: status },
  ];
  const client = input.client?.name?.trim() ? { ...input.client, name: input.client.name.trim() } : null;
  const site = client ? clientWebsite(client.website) : null;
  const signature = fromBloom ? BLOOM_SIGNATURE : "BloomSuite Support";
  const actionLabel = resolved ? "Confirm or reopen" : "View your request";
  const roleLine = fromBloom && input.purpose === "acknowledgement" && !body.includes(BLOOM_ROLE_DISCLOSURE)
    ? botanicalEmailParagraph(BLOOM_ROLE_DISCLOSURE, { muted: true, size: 14, margin: "0 0 14px" })
    : "";
  const html = renderBotanicalEmail({
    header: "Bloom Support",
    eyebrow: moment.eyebrow,
    title: moment.title,
    intro: moment.intro,
    preheader: clip(body.replace(/\s+/g, " "), 100),
    icon: moment.icon,
    bodyHtml: (client ? botanicalEmailClientLine(client) : "") +
      botanicalEmailParagraph(greeting, { margin: "0 0 14px" }) + roleLine +
      body.split(/\n{2,}/).map((p) => botanicalEmailParagraph(p, { margin: "0 0 14px" })).join("") +
      botanicalEmailParagraph(signature, { size: 14, margin: "18px 0 6px" }) +
      botanicalEmailSection("What happens next", botanicalEmailParagraph(moment.next, { size: 15, margin: "0" }), resolved ? "check" : "leaf") +
      botanicalEmailFacts(facts) +
      botanicalEmailButton(actionLabel, input.trackUrl) +
      botanicalEmailParagraph("Reply to this email at any time — it goes straight to this request.", { muted: true, size: 13, margin: "6px 0 0" }),
    footer: CUSTOMER_FOOTER,
  });
  const forLine = client ? `\nRequest for ${client.name}${site ? ` · ${site.href}` : ""}` : "";
  const text = `${greeting}\n\n${fromBloom && input.purpose === "acknowledgement" && !body.includes(BLOOM_ROLE_DISCLOSURE) ? `${BLOOM_ROLE_DISCLOSURE}\n\n` : ""}${body}\n\n${signature}\n\nWhat happens next\n${moment.next}\n\n—\nBloom Support · Request #${input.number} · ${status}${forLine}\n${actionLabel}: ${input.trackUrl}\nReply to this email at any time.\nBloomSuite · https://bloomsuite.app/`;
  return { text, html };
}

// ---------------------------------------------------------------------------
// Staff: "Needs you"
// ---------------------------------------------------------------------------
export interface StaffTicket {
  id: string;
  number: number;
  subject: string;
  summary?: string | null;
  status: string;
  stage?: string | null;
  kind?: string | null;
  product: string;
  priority?: string | null;
  automation?: string | null;
  created_at?: string | null;
  account?: { name: string } | null;
  requester?: { name?: string | null; email?: string | null } | null;
  next_action?: string | null;
  messages?: OutgoingMessage[];
  engineering?: EngineeringFacts | null;
  history?: Array<{ kind: string; from: string | null; to: string | null; at: string }>;
  pending_review?: string | null;
  merged_into?: string | null;
  operations?: Array<Record<string, unknown>> | null;
  feature_request?: { id?: unknown; status?: unknown } | null;
  escalations?: Array<{ reason?: unknown; status?: unknown }> | null;
  /** The ticket's email ledger (staff view): used to avoid sending the same "needs you" twice in a day. */
  emails?: Array<{ purpose?: string | null; to?: string | null; status?: string | null; created_at?: string | null }> | null;
}

export interface EscalationFacts {
  reason: string;
  detail?: string | null;
  recommendation?: string | null;
  created_at?: string | null;
}

const STAGE_DOING: Record<string, string> = {
  intake: "Bloom has the request and is reading it",
  triage: "Bloom is working out what this needs",
  answering: "Bloom is preparing an answer",
  operating: "Bloom has a change ready for a person to confirm",
  investigating: "Bloom is investigating the problem",
  fixing: "Bloom is preparing a fix",
  releasing: "Bloom is releasing a fix",
  verifying: "Bloom is checking the fix on the live site",
  needs_info: "Bloom asked the client for more detail",
  awaiting_client: "Bloom is waiting to hear back from the client",
};

/** Escalation reason code → the sentence a person reads. Never returns the code. */
export function reasonSentence(reason: string, detail?: string | null): string {
  const d = cleanStaffText(detail, 240);
  const failedAuth = /\b(auth|credential|token|permission denied|401|403)\b/i.test(String(detail ?? ""));
  switch (reason) {
    case "ticket_overdue": return "This request is past its response target and nobody has replied yet.";
    case "engineering_start_requested": return "Bloom found what looks like a bug and needs your OK before an automatic repair can start.";
    case "engineering_awaiting_approval": return "A fix is written and tested. It needs your approval before it goes live.";
    case "engineering_failed":
      return failedAuth
        ? "Bloom's automatic repair couldn't sign in to do the work, so nothing was changed."
        : "Bloom's automatic repair stopped before it finished, so nothing was released.";
    case "engineering_escalated": return "Bloom's repair needs a person: the fix isn't safe to finish automatically.";
    case "engineering_not_reproduced": return "Bloom couldn't reproduce the problem, so it needs a person to look.";
    case "engineering_rolled_back": return "A released fix was rolled back because the live check failed.";
    case "automation_failed": return "One of Bloom's automatic steps on this request kept failing, so Bloom handed it to you.";
    case "decision_needed": return d ? asSentence(`A decision is needed: ${d}`) : "This request needs a decision from you.";
    case "feature_decision": return "A client asked for something new and it needs your decision.";
    default:
      if (/^engineering_[a-z_]+$/.test(reason)) return asSentence(`The repair moved to "${words(reason.slice(12))}"`);
      if (/^[a-z]+(_[a-z]+)+$/.test(reason)) return asSentence(`Bloom flagged this: ${words(reason)}`);
      return asSentence(cleanStaffText(reason, 200)) || "Bloom needs a person to look at this request.";
  }
}

function clientNameOf(t: StaffTicket): string {
  return t.account?.name?.trim() || t.requester?.name?.trim() || t.requester?.email?.trim() || "A client";
}

/** "The Flowerhouse is waiting 26 hours on “Logo won't save”" */
export function escalationHeadline(x: EscalationFacts, t: StaffTicket, now: Date): string {
  const client = clientNameOf(t);
  const topic = `“${shortTopic(t.subject, 70)}”`;
  const age = t.created_at ? formatAge(now.getTime() - new Date(t.created_at).getTime()) : null;
  switch (x.reason) {
    case "ticket_overdue": return `${client} is waiting ${age ?? "a while"} on ${topic}`;
    case "engineering_start_requested": return `Bloom found a bug for ${client} and needs your OK to fix it`;
    case "engineering_awaiting_approval": return `A fix for ${client} is ready for your approval`;
    case "engineering_failed": return `Bloom's repair for ${client} didn't finish`;
    case "engineering_escalated":
    case "engineering_not_reproduced": return `${client}'s problem needs a person`;
    case "engineering_rolled_back": return `A fix for ${client} was rolled back`;
    case "automation_failed": return `Bloom got stuck on ${client}'s request`;
    case "feature_decision": return `${client} asked for something new`;
    case "decision_needed": return `${client}'s request needs your decision`;
    default: return `${client}'s request needs you`;
  }
}

/** What Bloom did, oldest first, at most six lines. */
export function bloomTimeline(t: StaffTicket, x: EscalationFacts, tz: string, now: Date): string[] {
  const out: Array<{ at: string; text: string }> = [];
  if (t.created_at) out.push({ at: t.created_at, text: `${formatWhen(t.created_at, tz)}: the request came in` });
  for (const m of t.messages ?? []) {
    if (m.author_kind !== "bloom") continue;
    const when = formatWhen(m.created_at, tz);
    if (m.visibility === "internal") {
      const note = cleanStaffText(humanizeStaffNote(m.body).split("\n")[0], 160);
      if (note) out.push({ at: m.created_at, text: `${when}: ${note.replace(/^Bloom /, "Bloom ")}` });
    } else {
      const what = m.purpose === "acknowledgement" ? "told the client we received it"
        : m.purpose === "clarification" ? "asked the client for more detail"
        : m.purpose === "resolution" ? "told the client it was resolved"
        : "replied to the client";
      out.push({ at: m.created_at, text: `${when}: Bloom ${what}` });
    }
  }
  const eng = typeof t.engineering?.status === "string" ? t.engineering.status : null;
  if (eng && eng !== "open") out.push({ at: now.toISOString(), text: `Repair status: ${ENGINEERING_WORDS[eng] ?? words(eng)}` });
  if (x.created_at) out.push({ at: x.created_at, text: `${formatWhen(x.created_at, tz)}: Bloom asked for a person` });
  out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const lines = out.map((o) => o.text);
  return lines.length > 6 ? [lines[0], ...lines.slice(-5)] : lines;
}

const ENGINEERING_WORDS: Record<string, string> = {
  investigating: "investigating", reproduced: "bug reproduced", not_reproduced: "couldn't reproduce the bug", fixing: "writing the fix",
  awaiting_approval: "fix ready, waiting for approval", approved: "fix approved", merging: "releasing", deploying: "releasing",
  verifying: "checking the fix on the live site", verified: "fix live and checked", failed: "the fix attempt failed",
  rolled_back: "fix rolled back", escalated: "needs a person", closed: "closed",
};

/** The last things the customer was told (Bloom or staff), newest last. */
export function toldCustomer(t: StaffTicket, limit = 2): OutgoingMessage[] {
  return (t.messages ?? []).filter((m) => m.visibility === "public" && m.author_kind !== "client" && m.delivery !== "suppressed").slice(-limit);
}

function lastFromClient(t: StaffTicket): OutgoingMessage | null {
  return [...(t.messages ?? [])].reverse().find((m) => m.author_kind === "client") ?? null;
}

// Which automatic step failed, in words. Staff-only steps never escalate (see fail_job).
const STEP_WORDS: Record<string, { label: string; verb: string }> = {
  triage: { label: "reading and sorting the request", verb: "sort" },
  answer: { label: "drafting an answer", verb: "draft an answer for" },
  send_email: { label: "emailing the client", verb: "email" },
  verify_resolution: { label: "checking the fix on the live site", verb: "check the fix for" },
  investigate: { label: "investigating the problem", verb: "investigate the problem for" },
  engineering_step: { label: "the automatic repair", verb: "finish the repair for" },
  post_resolution_reply: { label: "reading the client's reply", verb: "read the reply from" },
  operate: { label: "making the change", verb: "make the change for" },
  notify: { label: "a staff notification", verb: "notify staff about" },
  digest: { label: "the daily summary", verb: "send the summary for" },
  escalate: { label: "a staff email", verb: "email staff about" },
};
export const STAFF_ONLY_STEPS: readonly string[] = ["notify", "digest", "escalate"];

/** "send_email: provider 500 …" → the step and a human error class. Never the raw error. */
export function failedStep(detail: string | null | undefined): { kind: string; label: string; verb: string; problem: string } | null {
  const m = String(detail ?? "").match(/^([a-z_]+):\s*([\s\S]*)$/);
  if (!m || !STEP_WORDS[m[1]]) return null;
  const err = m[2];
  const problem = /timeout|timed out|aborted/i.test(err) ? "kept timing out"
    : /\b(401|403)\b|auth|credential|token|permission|forbidden/i.test(err) ? "was refused access"
    : /\b429\b|rate.?limit|too many/i.test(err) ? "was rate-limited by another service"
    : /\b5\d\d\b|fetch failed|network|ECONN|unavailable|bad gateway/i.test(err) ? "couldn't reach a service it depends on"
    : /\b404\b|not.?found/i.test(err) ? "couldn't find something it needed"
    : /cannot read prop|undefined|is not a function|null|TypeError|ReferenceError|SyntaxError/i.test(err) ? "hit a bug in Bloom's own code"
    : /not.?configured|missing/i.test(err) ? "isn't set up yet"
    : "kept failing";
  return { kind: m[1], ...STEP_WORDS[m[1]], problem };
}

/**
 * The one concrete thing this escalation needs from a person, or null when
 * there is nothing a person can do (the request is resolved or merged, or the
 * failure was in staff-only work). No step means no "needs you" email: the
 * open escalation still shows in the daily digest.
 */
export function needsYouStep(x: EscalationFacts, t: StaffTicket): NextStep | null {
  if (t.status === "resolved" || t.merged_into) return null;
  if (x.reason === "automation_failed") {
    const f = failedStep(x.detail);
    if (f && STAFF_ONLY_STEPS.includes(f.kind)) return null;
  }
  const live = liveNextStep({
    status: t.status, automation: t.automation, pending_review: t.pending_review, merged_into: t.merged_into, engineering: t.engineering,
    operations: t.operations, feature_request: t.feature_request, escalations: t.escalations,
  });
  // What the live ticket can do now wins over the escalation's original reason.
  if (live && live.action !== "take-over" && live.action !== "reply") return live;
  return nextStepForReason(x.reason, t);
}

/** Subject line: what to do, then who and what. */
export function needsYouSubject(step: NextStep, t: StaffTicket, preview = false): string {
  const lead = step.action === "send-and-solve" ? "Ready to close"
    : DECISION_ACTIONS.includes(step.action) ? "Needs a decision"
    : step.action === "review-reply" ? "Client wrote again"
    : "Needs a reply";
  const tail = step.action === "send-and-solve" ? " · reply drafted" : "";
  return clip(`${preview ? "[Preview] " : ""}${lead}: ${clientNameOf(t)} — ${shortTopic(t.subject, 48)} (#${t.number})${tail}`, 200);
}

const REPAIR_STATUS: Record<string, string> = {
  open: "The repair hasn't started.", investigating: "Bloom is still investigating.", fixing: "Bloom is writing a fix.",
  awaiting_approval: "A tested fix is waiting for approval.", failed: "The last repair attempt failed.", escalated: "The repair needs a person.",
  verified: "The fix is live and checked.", rolled_back: "The last fix was rolled back.",
};

/** Headline and the one-sentence reason, from the real escalation and what Bloom knows. */
function needsYouCopy(x: EscalationFacts, t: StaffTicket, step: NextStep, plan: ResolutionPlan | null, now: Date): { headline: string; why: string; findings: string[] } {
  const client = clientNameOf(t);
  if (step.action === "send-and-solve" && plan) {
    return plan.outcome === "fixed"
      ? { headline: `${client}'s fix is live: ready to close`, why: "Bloom's fix passed its live check. A reply to the client is drafted.", findings: plan.findings }
      : { headline: `${client}'s request is ready to close`, why: `${plan.findings.slice(0, 2).join(" ")} A reply to the client is drafted.`, findings: plan.findings };
  }
  const repair = typeof t.engineering?.status === "string" ? REPAIR_STATUS[t.engineering.status] ?? "" : "";
  if (x.reason === "automation_failed") {
    const f = failedStep(x.detail);
    if (f) {
      return {
        headline: `Bloom couldn't ${f.verb} ${client}`,
        why: `Bloom's step “${f.label}” ${f.problem} after every retry, so it stopped and nothing more went to the client.${repair ? ` ${repair}` : ""}`,
        findings: [],
      };
    }
  }
  return { headline: escalationHeadline(x, t, now), why: reasonSentence(x.reason, x.detail), findings: repair ? [repair] : [] };
}

export function renderEscalationEmail(input: {
  escalation: EscalationFacts;
  ticket: StaffTicket;
  appUrl: string;
  now?: Date;
  timeZone?: string;
  preview?: boolean;
  /** The client company's brand, from the ticket's account. Website and logo show only when validated. */
  client?: ClientBrand | null;
}): RenderedEmail & { step: NextStep; draft: string | null } {
  const { escalation: x, ticket: t } = input;
  const now = input.now ?? new Date();
  const tz = input.timeZone ?? "America/Toronto";
  // Previews render even when nothing is actionable; real sends check needsYouStep first.
  const step = needsYouStep(x, t) ?? nextStepForReason(x.reason, t);
  const plan = step.action === "send-and-solve" ? resolutionPlan({ engineering: t.engineering, requesterName: t.requester?.name, timeZone: tz }) : null;
  const client = clientNameOf(t);
  const { headline, why, findings } = needsYouCopy(x, t, step, plan, now);
  const age = t.created_at ? formatAge(now.getTime() - new Date(t.created_at).getTime()) : null;
  const summary = cleanStaffText(t.summary, 280);
  const doing = t.stage ? STAGE_DOING[t.stage] : null;
  const recommendation = x.recommendation && step.action !== "send-and-solve" ? cleanStaffText(x.recommendation, 300) : step.recommendation;
  const timeline = bloomTimeline(t, x, tz, now);
  const told = toldCustomer(t);
  const fromClient = lastFromClient(t);
  const primary = supportLink(input.appUrl, t.id, step.action);
  const open = supportLink(input.appUrl, t.id);
  const takeOver = supportLink(input.appUrl, t.id, "take-over");
  const subject = needsYouSubject(step, t, input.preview);
  const draft = plan?.draft ?? null;

  // Brand facts belong to the ticket's account, never to a requester's typed name.
  const brand = t.account?.name?.trim() && input.client ? { ...input.client, name: client } : null;
  const site = brand ? clientWebsite(brand.website) : null;
  const topic = shortTopic(t.subject, 70);
  const facts: BotanicalEmailFact[] = [
    { icon: "leaf", label: "Client", value: client, link: site, avatar: brand },
    { icon: "mail", label: "Request", value: `#${t.number} · ${topic} · ${productName(t.product)}` },
  ];
  if (age) facts.push({ icon: "calendar", label: "Waiting", value: `${age} since it came in` });

  const summaryLines = [summary ? asSentence(clip(summary, 280)) : asSentence(cleanSubject(t.subject)), doing ? asSentence(doing) : ""].filter(Boolean);
  const secondary = [{ label: "Open the request", href: open }, ...(step.action !== "take-over" ? [{ label: "Take it over instead", href: takeOver }] : [])];

  // Order: the action first (above the fold on a phone), then the facts, then the details.
  const bodyHtml =
    botanicalEmailButton(step.button, primary).replace("margin:20px 0 8px", "margin:0 0 6px") +
    botanicalEmailParagraph(`${recommendation} The button opens BloomSuite; nothing happens until you confirm there.`, { muted: true, size: 13, margin: "0 0 14px" }) +
    (draft ? botanicalEmailParagraph("The reply Bloom drafted", { size: 13, margin: "4px 0 0" }) + botanicalEmailQuote(draft, `To ${client} · you can edit it before sending`) : "") +
    botanicalEmailFacts(facts) +
    (findings.length ? botanicalEmailSection("What Bloom found", botanicalEmailList(findings), "check") : "") +
    botanicalEmailSection("The request", summaryLines.map((l) => botanicalEmailParagraph(l, { size: 14, margin: "0 0 8px" })).join(""), "alert") +
    (told.length || fromClient
      ? botanicalEmailSection("What Bloom told the client",
        told.map((m) => botanicalEmailQuote(clip(m.body.trim(), 600), `${m.author_kind === "bloom" ? "Bloom" : "Your team"} · ${formatWhen(m.created_at, tz)}`)).join("") +
          (told.length ? "" : botanicalEmailParagraph("Nothing yet.", { size: 14 })) +
          (fromClient ? botanicalEmailParagraph("Last from the client:", { size: 13, margin: "12px 0 0", muted: true }) +
            botanicalEmailQuote(clip(fromClient.body.trim(), 400), `${client} · ${formatWhen(fromClient.created_at, tz)}`) : ""),
        "mail")
      : "") +
    (timeline.length ? botanicalEmailSection("What Bloom did", botanicalEmailList(timeline), "leaf") : "") +
    botanicalEmailLinks(secondary);

  const html = renderBotanicalEmail({
    header: "Bloom Support",
    eyebrow: input.preview ? `Preview · ${subject.replace(/^\[Preview\] /, "").split(":")[0]}` : subject.split(":")[0],
    title: headline,
    intro: why,
    preheader: `${step.button}. ${why}`,
    icon: step.action === "send-and-solve" ? "check" : "alert",
    bodyHtml,
    footer: "Sent by Bloom to Brands in Blooms staff. Bloom never acts on a link in this email; every change is confirmed in BloomSuite.",
  });

  const text = [
    headline,
    why,
    "",
    `${step.button}: ${primary}`,
    `(${recommendation} Nothing happens until you confirm in BloomSuite.)`,
    ...(draft ? ["", "The reply Bloom drafted:", ...draft.split("\n").map((l) => (l ? `> ${l}` : ">"))] : []),
    "",
    `Client: ${client}${site ? ` · ${site.href}` : ""}`,
    `Request: #${t.number} · ${topic} · ${productName(t.product)}`,
    age ? `Waiting: ${age}` : "",
    "",
    "Details",
    ...findings.map((l) => `• ${l}`),
    ...summaryLines,
    told.length ? "What Bloom told the client:" : "",
    ...told.map((m) => `“${clip(m.body.trim(), 600)}” (${formatWhen(m.created_at, tz)})`),
    fromClient ? `Last from the client: “${clip(fromClient.body.trim(), 400)}”` : "",
    timeline.length ? "What Bloom did:" : "",
    ...timeline.map((l) => `• ${l}`),
    "",
    `Open the request: ${open}`,
    step.action !== "take-over" ? `Take it over instead: ${takeOver}` : "",
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim();

  return { subject, text, html, step, draft };
}

/**
 * Whether a "needs you" email goes out now or waits for the daily digest.
 * The same escalation is never emailed twice (the ledger's idempotency key),
 * and a ticket gets at most one "needs you" per person per day; repeats roll
 * into the digest. A decision only a person can make (approve a fix, decide
 * a feature, ...) is not held back.
 */
export function needsYouDelivery(input: { step: NextStep | null; ticket: StaffTicket; to: string; now?: Date }): "send" | "digest" {
  if (!input.step) return "digest";
  if (DECISION_ACTIONS.includes(input.step.action)) return "send";
  const now = (input.now ?? new Date()).getTime();
  const to = input.to.trim().toLowerCase();
  const recent = (input.ticket.emails ?? []).some((e) =>
    e.purpose === "escalation" && String(e.to ?? "").toLowerCase() === to &&
    !["failed", "suppressed", "not_configured"].includes(String(e.status ?? "")) &&
    now - new Date(String(e.created_at ?? 0)).getTime() < 86_400_000
  );
  return recent ? "digest" : "send";
}

/**
 * The automatic "this is resolved" email is skipped when the person resolved
 * the request with "Send this reply and mark solved": their reply already told
 * the client, so the client gets one email, not two. Only that flow records
 * the reply it sent in the resolution evidence; an ordinary "Mark solved"
 * still sends the resolution email with the summary the person wrote.
 */
export function resolutionAlreadyTold(evidence: unknown, messages: OutgoingMessage[]): boolean {
  const ev = evidence && typeof evidence === "object" ? evidence as Record<string, unknown> : null;
  if (ev?.via !== "send-and-solve" || typeof ev.reply_message_id !== "string") return false;
  const reply = messages.find((m) => m.id === ev.reply_message_id);
  return !!reply && reply.visibility === "public" && reply.author_kind !== "client" && reply.delivery !== "suppressed";
}

// ---------------------------------------------------------------------------
// Staff: watchdog alerts
// ---------------------------------------------------------------------------
export const TOOL_LABEL: Record<string, string> = {
  explore_customer_purchases: "look up customer purchases",
  get_customer_product_history: "look up a customer's purchase history",
  query_customers: "search customers",
  query_orders: "search orders",
  query_products: "search products",
  query_segments: "search customer groups",
  query_campaigns: "search campaigns",
  query_tags: "search tags",
  query_personas: "search personas",
  get_customer_detail: "open a customer",
  get_customer_insights: "read customer insights",
  get_customer_timeline: "read a customer's history",
  get_revenue_analytics: "read sales reports",
  get_campaign_analytics: "read campaign results",
  get_dashboard_summary: "read the dashboard summary",
  get_segment_members: "list a group's customers",
  get_product_detail: "open a product",
  get_email_health: "check email health",
  get_integration_status: "check connected apps",
  compute_audience_size: "count a campaign audience",
  rank_customers_by_intelligence: "rank customers",
  find_customer_opportunities: "find customer opportunities",
  read_suite_data: "read website and POS data",
  search_knowledge: "search the help articles",
  create_campaign: "create campaigns",
  update_campaign: "update campaigns",
  schedule_campaign: "schedule campaigns",
  send_campaign: "send campaigns",
  create_segment: "create customer groups",
  update_segment: "update customer groups",
  create_customer: "add customers",
  update_customer: "update customers",
  generate_content: "write content",
  generate_image: "make images",
  export_data: "export data",
  report_support_problem: "report a problem to support",
  check_support_request: "check a support request",
};

export function toolLabel(name: string): string {
  if (TOOL_LABEL[name]) return TOOL_LABEL[name];
  const w = words(name);
  return /^(get|query|explore|read|search|list) /.test(w) ? `look up ${w.replace(/^\w+ /, "")}` : w;
}

export interface AlertFinding {
  condition: string;
  summary?: string;
  tools?: Array<{ tenant_id?: string | null; tenant_name?: string | null; tool_name: string; calls?: number; failed?: number; timeouts?: number }>;
  tenants?: Array<{ tenant_id?: string | null; tenant_name?: string | null; errors?: number; access_denied?: number; answers?: number }>;
  [key: string]: unknown;
}

export interface ToolProblem {
  tenant: string;
  tool: string;
  calls: number;
  failed: number;
  timeouts: number;
}

export interface AlertGroup {
  key: string;
  conditions: string[];
  tools?: ToolProblem[];
  finding?: AlertFinding;
  /** How many findings were merged into this group (repeat firings of the same condition). */
  count?: number;
}

/**
 * Dedupe: tool failures and tool timeouts for the same tenant and tool in the
 * same hour are one problem and become one alert. Other findings with the same
 * condition, check and escalation are repeats of one problem (the watchdog or
 * the deadline sweep firing again) and merge into one group with a count,
 * keeping the latest finding.
 */
export function groupAlertFindings(findings: AlertFinding[]): AlertGroup[] {
  const groups: AlertGroup[] = [];
  const tools = new Map<string, ToolProblem>();
  const toolConditions = new Set<string>();
  const byKey = new Map<string, AlertGroup>();
  for (const f of findings) {
    if (f.condition === "bloom_tool_failures" || f.condition === "bloom_tool_timeouts") {
      toolConditions.add(f.condition);
      for (const r of f.tools ?? []) {
        const tenant = r.tenant_name?.trim() || "an unnamed company";
        const k = `${r.tenant_id ?? tenant}|${r.tool_name}`;
        const cur = tools.get(k) ?? { tenant, tool: r.tool_name, calls: 0, failed: 0, timeouts: 0 };
        if (f.condition === "bloom_tool_failures") {
          cur.calls = Math.max(cur.calls, Number(r.calls ?? 0));
          cur.failed = Math.max(cur.failed, Number(r.failed ?? 0));
        } else {
          cur.timeouts = Math.max(cur.timeouts, Number(r.timeouts ?? 0));
        }
        tools.set(k, cur);
      }
      continue;
    }
    const key = f.condition + (typeof f.check === "string" ? `:${f.check}` : "") + (typeof f.escalation_id === "string" ? `:${f.escalation_id}` : "");
    const seen = byKey.get(key);
    if (seen) {
      seen.count = (seen.count ?? 1) + 1;
      seen.finding = f;
      continue;
    }
    const g: AlertGroup = { key, conditions: [f.condition], finding: f, count: 1 };
    byKey.set(key, g);
    groups.push(g);
  }
  if (tools.size) {
    groups.unshift({
      key: "bloom_tools",
      conditions: [...toolConditions].sort(),
      tools: [...tools.values()].sort((a, b) => (b.failed + b.timeouts) - (a.failed + a.timeouts)),
    });
  }
  return groups;
}

function toolSentence(p: ToolProblem): string {
  const what = `Bloom couldn't ${toolLabel(p.tool)} for ${p.tenant}`;
  const failed = p.calls ? `${p.failed} of ${p.calls} tries failed` : p.failed ? `${p.failed} tries failed` : "";
  const slow = p.timeouts ? `${p.timeouts} timed out` : "";
  return `${what}: ${[failed, slow].filter(Boolean).join(", ")} in the last hour`;
}

interface AlertCopy {
  headline: string;
  lines: string[];
  impact: string;
  doing: string;
  button: string;
  path: string;
}

const ALERT_COPY: Record<string, Omit<AlertCopy, "lines"> & { line?: (f: AlertFinding) => string }> = {
  worker_not_running: {
    headline: "Bloom's background worker has stopped", impact: "New requests are not being triaged and emails to clients are waiting.",
    doing: "Requests are safe in the queue and will be processed as soon as the worker runs again.", button: "Check Bloom's health", path: "/admin/bloom-support?view=readiness",
  },
  queue_backlog: {
    headline: "Bloom's work queue is backed up", impact: "Replies and updates to clients are going out late.",
    doing: "Bloom keeps retrying each job; nothing is lost.", button: "See the queue", path: "/admin/bloom-support?view=readiness",
    line: (f) => `${Number(f.jobs ?? 0)} jobs have been waiting longer than they should.`,
  },
  dead_jobs: {
    headline: "Some of Bloom's automatic steps gave up", impact: "The affected requests need a person.",
    doing: "Bloom handed those requests to you.", button: "See what got stuck", path: "/admin/bloom-support?view=readiness",
    line: (f) => `${Number(f.jobs ?? 0)} automatic steps failed after every retry in the last hour.`,
  },
  email_failures: {
    headline: "Some support emails didn't send", impact: "A client may not have received an update.",
    doing: "Bloom will retry. The conversation is still visible in BloomSuite.", button: "Check email delivery", path: "/admin/bloom-support?view=readiness",
  },
  bloom_request_errors: {
    headline: "Bloom is failing for some companies", impact: "People at these companies get an error when they ask Bloom something.",
    doing: "Bloom records every failure so it can be fixed.", button: "Check Bloom's health", path: "/admin/bloom-support?view=readiness",
  },
  bloom_negative_feedback: {
    headline: "People didn't like some of Bloom's answers", impact: "Staff gave several answers a thumbs down in the last day.",
    doing: "The answers are saved for review.", button: "Review Bloom's answers", path: "/admin/bloom-support?view=readiness",
  },
  duplicate_system_segments: {
    headline: "Some built-in customer groups are duplicated", impact: "Group counts may look doubled to these companies.",
    doing: "Nothing is deleted automatically; a person should merge them.", button: "Check readiness", path: "/admin/bloom-support?view=readiness",
  },
  orphan_segment_memberships: {
    headline: "Deleted customers are still in customer groups", impact: "Group counts and campaign audiences may be wrong.",
    doing: "Nothing is deleted automatically; a person should clean them up.", button: "Check readiness", path: "/admin/bloom-support?view=readiness",
  },
  watchdog_check_failed: {
    headline: "One of Bloom's health checks couldn't run", impact: "A problem in that area would not be noticed until the check runs again.",
    doing: "The other checks are still running.", button: "Check Bloom's health", path: "/admin/bloom-support?view=readiness",
  },
  escalation_unanswered: {
    headline: "An escalated request still has no reply from a person", impact: "A client is waiting on Brands in Blooms staff.",
    doing: "At each missed deadline Bloom moves it to the other owner and reminds you both.", button: "Open Support", path: "/support",
    line: (f) => (typeof f.reason === "string" && f.reason ? reasonSentence(f.reason) : ""),
  },
  possible_incident: {
    headline: "Several clients are reporting the same problem", impact: "This may be an outage.",
    doing: "Bloom grouped the reports into one incident.", button: "Open the incident", path: "/admin/bloom-support?view=queue",
  },
};

function alertCopy(g: AlertGroup): AlertCopy {
  if (g.tools) {
    const tenants = [...new Set(g.tools.map((t) => t.tenant))];
    const top = g.tools[0];
    return {
      headline: g.tools.length === 1
        ? `Bloom couldn't ${toolLabel(top.tool)} for ${top.tenant}`
        : `Bloom is having trouble looking things up for ${tenants.length === 1 ? tenants[0] : `${tenants.length} companies`}`,
      lines: g.tools.slice(0, 8).map(toolSentence),
      impact: `When people at ${tenants.slice(0, 3).join(", ")}${tenants.length > 3 ? " and others" : ""} ask Bloom about this, it can't answer with their data.`,
      doing: "Bloom tells the person it couldn't get the data rather than guessing. The watchdog checks again every five minutes.",
      button: "Check Bloom's health",
      path: "/admin/bloom-support?view=readiness",
    };
  }
  const f = g.finding!;
  const c = ALERT_COPY[f.condition];
  const fallbackLine = cleanStaffText(f.summary, 300);
  if (!c) {
    return {
      headline: asSentence(`Bloom flagged a problem: ${words(f.condition)}`).replace(/\.$/, ""),
      lines: fallbackLine ? [fallbackLine] : [],
      impact: "Bloom couldn't tell who is affected.", doing: "The watchdog checks again every five minutes.",
      button: "Check Bloom's health", path: "/admin/bloom-support?view=readiness",
    };
  }
  const tenantLines = (f.tenants ?? []).slice(0, 6).map((t) => {
    const name = t.tenant_name?.trim() || "an unnamed company";
    if (f.condition === "bloom_request_errors") return `${name}: ${t.errors ?? 0} failed requests${t.access_denied ? `, ${t.access_denied} refused access` : ""} in the last hour`;
    if (f.condition === "bloom_negative_feedback") return `${name}: ${t.answers ?? 0} answers marked unhelpful`;
    return name;
  });
  const lines = [c.line ? c.line(f) : "", ...tenantLines].filter(Boolean);
  if (!lines.length && fallbackLine) lines.push(fallbackLine);
  return { headline: c.headline, lines, impact: c.impact, doing: c.doing, button: c.button, path: c.path };
}

export function renderAlertEmail(group: AlertGroup, opts: { appUrl: string; preview?: boolean }): RenderedEmail {
  const c = alertCopy(group);
  const link = `${opts.appUrl.replace(/\/+$/, "")}${c.path}`;
  const prefix = opts.preview ? "[Preview] " : "";
  const subject = clip(`${prefix}Bloom alert: ${c.headline}`, 200);
  const bodyHtml =
    botanicalEmailSection("What's happening", botanicalEmailList(c.lines.length ? c.lines : [c.headline]), "alert") +
    botanicalEmailFacts([
      { icon: "alert", label: "Who is affected", value: c.impact },
      { icon: "leaf", label: "What Bloom is doing", value: c.doing },
    ]) +
    botanicalEmailButton(c.button, link) +
    botanicalEmailParagraph("You get one email per problem per hour. If it keeps happening you'll hear again next hour.", { muted: true, size: 12, margin: "10px 0 0" });
  const html = renderBotanicalEmail({
    header: "Bloom Support",
    eyebrow: opts.preview ? "Preview · Bloom alert" : "Bloom alert",
    title: c.headline,
    preheader: c.impact,
    icon: "alert",
    bodyHtml,
    footer: "Sent by Bloom's watchdog to Brands in Blooms staff.",
  });
  const text = [c.headline, "", ...c.lines.map((l) => `• ${l}`), "", `Who is affected: ${c.impact}`, `What Bloom is doing: ${c.doing}`, "", `${c.button}: ${link}`].join("\n");
  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Staff: daily digest
// ---------------------------------------------------------------------------
export interface DigestReport {
  needs_you: Array<{ id: string; number: number; subject: string; client: string | null; reason: string; since: string }>;
  resolved: Array<{ number: number; subject: string; client: string | null; by_bloom: boolean; summary: string | null }>;
  said: Array<{ number: number; subject: string; client: string | null; body: string; at: string }>;
  repairs: Array<{ title: string; status: string; client: string | null }>;
  alerts: Array<{ condition: string; detail: AlertFinding; at: string }>;
  counts?: { new?: number; open?: number };
}

export function digestIsEmpty(r: DigestReport): boolean {
  return !r.needs_you.length && !r.resolved.length && !r.said.length && !r.repairs.length && !r.alerts.length;
}

/**
 * One digest line per problem. Groups with the same headline (for example two
 * different unanswered escalations) share a line; repeat firings show as a count.
 */
export function digestAlertLines(groups: AlertGroup[]): string[] {
  const lines = new Map<string, { groups: number; fired: number }>();
  for (const g of groups) {
    const headline = alertCopy(g).headline;
    const cur = lines.get(headline) ?? { groups: 0, fired: 0 };
    cur.groups += 1;
    cur.fired += g.count ?? 1;
    lines.set(headline, cur);
  }
  return [...lines.entries()].map(([headline, { groups: n, fired }]) => {
    const parts = [n > 1 ? `${n} cases` : "", fired > 1 ? `flagged ${fired} times` : ""].filter(Boolean);
    return parts.length ? `${headline} (${parts.join(", ")})` : headline;
  });
}

export function renderDigestEmail(r: DigestReport, opts: { appUrl: string; date: string; timeZone?: string; preview?: boolean; period?: "daily" | "weekly" }): RenderedEmail | null {
  const weekly = opts.period === "weekly";
  if (digestIsEmpty(r)) return null;
  const tz = opts.timeZone ?? "America/Toronto";
  const now = new Date();
  const base = opts.appUrl.replace(/\/+$/, "");
  const prefix = opts.preview ? "[Preview] " : "";
  const needs = r.needs_you.slice(0, 8).map((n) => {
    const step = nextStepForReason(n.reason, null);
    return {
      line: `${n.client ?? "A client"} · #${n.number} ${shortTopic(n.subject, 60)} · ${clip(reasonSentence(n.reason), 140)} (${formatAge(now.getTime() - new Date(n.since).getTime())})`,
      button: step.button,
      url: supportLink(base, n.id, step.action as NextAction),
    };
  });
  const resolvedLines = r.resolved.slice(0, 10).map((x) => `${x.client ?? "A client"} · #${x.number} ${clip(cleanSubject(x.subject), 60)}${x.by_bloom ? " · solved by Bloom" : ""}`);
  const repairLines = r.repairs.slice(0, 8).map((x) => `${x.client ? `${x.client} · ` : ""}${shortTopic(cleanStaffText(x.title, 200), 70)} · ${ENGINEERING_WORDS[x.status] ?? words(x.status)}`);
  // The report row carries the condition; some details (e.g. escalation_unanswered) do not.
  const alertGroups = groupAlertFindings(r.alerts.map((a) => ({ ...(a.detail ?? {}), condition: a.detail?.condition ?? a.condition })));
  const alertLines = digestAlertLines(alertGroups).slice(0, 6);
  const saidByTicket = new Map<number, typeof r.said>();
  for (const s of r.said) saidByTicket.set(s.number, [...(saidByTicket.get(s.number) ?? []), s]);

  const title = needs.length
    ? `${needs.length} request${needs.length === 1 ? "" : "s"} need${needs.length === 1 ? "s" : ""} you today`
    : "Nothing needs you today";
  const intro = `${weekly ? "This week" : "In the last day"} Bloom resolved ${r.resolved.length}, talked to clients on ${saidByTicket.size} request${saidByTicket.size === 1 ? "" : "s"}, and has ${r.repairs.length} repair${r.repairs.length === 1 ? "" : "s"} in progress.`;

  const needsHtml = needs.map((n) =>
    botanicalEmailParagraph(n.line, { size: 14, margin: "8px 0 0" }) + botanicalEmailButton(n.button, n.url).replace("margin:20px 0 8px", "margin:8px 0 14px")
  ).join("");
  const saidHtml = [...saidByTicket.entries()].slice(0, 8).map(([number, list]) => {
    const last = list[list.length - 1];
    return botanicalEmailQuote(clip(last.body.trim(), 280), `${last.client ?? "A client"} · #${number} ${shortTopic(last.subject, 50)} · ${formatWhen(last.at, tz)}`);
  }).join("");

  const bodyHtml =
    (needs.length ? botanicalEmailSection("What needs you", needsHtml, "alert") : "") +
    (resolvedLines.length ? botanicalEmailSection("What Bloom resolved", botanicalEmailList(resolvedLines), "check") : "") +
    (saidHtml ? botanicalEmailSection("What Bloom said to clients", saidHtml, "mail") : "") +
    (repairLines.length ? botanicalEmailSection("Repairs in progress", botanicalEmailList(repairLines), "leaf") : "") +
    (alertLines.length ? botanicalEmailSection("Alerts", botanicalEmailList(alertLines), "alert") : "") +
    botanicalEmailButton("Open Support", `${base}/support`) +
    botanicalEmailParagraph("To stop this email for yourself, add your address to the digest opt-out list in Bloom Support settings.", { muted: true, size: 12, margin: "10px 0 0" });

  const html = renderBotanicalEmail({
    header: "Bloom Support",
    eyebrow: `${opts.preview ? "Preview · " : ""}${weekly ? "Weekly" : "Daily"} summary · ${opts.date}`,
    title,
    intro,
    preheader: intro,
    icon: "calendar",
    bodyHtml,
    footer: `Sent by Bloom to Brands in Blooms staff once a ${weekly ? "week" : "day"}, only when there is something to report.`,
  });
  const text = [
    title, intro, "",
    needs.length ? "What needs you" : "", ...needs.map((n) => `• ${n.line}\n  ${n.button}: ${n.url}`),
    resolvedLines.length ? "\nWhat Bloom resolved" : "", ...resolvedLines.map((l) => `• ${l}`),
    saidByTicket.size ? "\nWhat Bloom said to clients" : "",
    ...[...saidByTicket.entries()].slice(0, 8).map(([n, list]) => `• #${n}: “${clip(list[list.length - 1].body.trim(), 280)}”`),
    repairLines.length ? "\nRepairs in progress" : "", ...repairLines.map((l) => `• ${l}`),
    alertLines.length ? "\nAlerts" : "", ...alertLines.map((l) => `• ${l}`),
    "", `Open Support: ${base}/support`,
  ].filter((l) => l !== "").join("\n");
  return { subject: clip(`${prefix}Bloom ${weekly ? "weekly" : "daily"}: ${title}`, 200), text, html };
}

/** Generic staff notification (settings.notifications.email_staff). */
export function renderStaffNotification(input: { title: string; ticketId?: string | null; appUrl: string; preview?: boolean }): RenderedEmail {
  const title = cleanStaffText(input.title, 200) || "Bloom Support update";
  const link = input.ticketId ? supportLink(input.appUrl, input.ticketId) : `${input.appUrl.replace(/\/+$/, "")}/support`;
  const html = renderBotanicalEmail({
    header: "Bloom Support", eyebrow: "Heads up", title, preheader: title, icon: "leaf",
    bodyHtml: botanicalEmailButton(input.ticketId ? "Open the request" : "Open Support", link),
    footer: "Sent by Bloom to Brands in Blooms staff.",
  });
  return { subject: clip(`${input.preview ? "[Preview] " : ""}Bloom: ${title}`, 200), text: `${title}\n\nOpen: ${link}`, html };
}

export { nextStepFor };
