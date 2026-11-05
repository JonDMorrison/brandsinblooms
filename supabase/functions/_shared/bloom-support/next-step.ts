// Bloom Support — the one thing a ticket needs from a person, in plain words.
// Pure: no I/O and no Deno globals. The staff emails use it to pick the button
// and the deep link; the CRM Support page uses the same function on the LIVE
// ticket to show "Bloom recommends" with a single confirm button. The link only
// opens BloomSuite: the person signs in normally, the action runs through the
// existing endpoints, and the database checks their permissions.

export type NextAction = "approve-fix" | "start-repair" | "confirm-change" | "review-reply" | "decide-feature" | "send-and-solve" | "take-over" | "reply";

export const NEXT_ACTIONS: readonly NextAction[] = ["approve-fix", "start-repair", "confirm-change", "review-reply", "decide-feature", "send-and-solve", "take-over", "reply"];

/** Actions that are a decision only a person can make; they are never held back for the digest. */
export const DECISION_ACTIONS: readonly NextAction[] = ["approve-fix", "start-repair", "confirm-change", "decide-feature"];

export function isNextAction(value: unknown): value is NextAction {
  return typeof value === "string" && (NEXT_ACTIONS as readonly string[]).includes(value);
}

export interface NextStep {
  action: NextAction;
  /** Primary button text in the email and on the Support page. */
  button: string;
  /** "Bloom recommends …" sentence. */
  recommendation: string;
  /** Permission the database will check when the button is used. */
  permission: string;
}

const STEPS: Record<NextAction, Omit<NextStep, "action">> = {
  "approve-fix": {
    button: "Review and approve the fix",
    recommendation: "Approve the tested fix so Bloom can release it, check it on the live site and tell the client.",
    permission: "engineering.approve",
  },
  "start-repair": {
    button: "Review and start the repair",
    recommendation: "Read the evidence. If it is a contained bug with clear expected behaviour, let Bloom start an automatic repair. Nothing is released without approval.",
    permission: "engineering.dispatch",
  },
  "confirm-change": {
    button: "Review and confirm the change",
    recommendation: "Check the change Bloom prepared and confirm it. Bloom will make it and report back to the client.",
    permission: "tickets.write",
  },
  "review-reply": {
    button: "See the client's reply",
    recommendation: "The client wrote again after this was solved. Decide whether to reopen it, open a new request, or keep it solved.",
    permission: "tickets.write",
  },
  "decide-feature": {
    button: "Decide on the request",
    recommendation: "A client asked for something new. Accept it, plan it or decline it so Bloom can tell them.",
    permission: "features.decide",
  },
  "send-and-solve": {
    button: "Send this reply and mark solved",
    recommendation: "Bloom has what it needs to close this. Check the drafted reply, change anything you like, then send it and mark the request solved.",
    permission: "tickets.write",
  },
  "take-over": {
    button: "Take over this request",
    recommendation: "Take this over and reply to the client yourself. Bloom will stop messaging them.",
    permission: "tickets.write",
  },
  reply: {
    button: "Reply to the client",
    recommendation: "Send the client a reply so they know where things stand.",
    permission: "tickets.write",
  },
};

export function nextStepFor(action: NextAction): NextStep {
  return { action, ...STEPS[action] };
}

/** Escalation reason → the action that resolves it. */
export function nextStepForReason(reason: string, ticket?: { automation?: string | null } | null): NextStep {
  switch (reason) {
    case "engineering_awaiting_approval": return nextStepFor("approve-fix");
    case "engineering_start_requested": return nextStepFor("start-repair");
    case "feature_decision": return nextStepFor("decide-feature");
    case "ticket_overdue":
      return nextStepFor(ticket?.automation && ticket.automation !== "auto" ? "reply" : "take-over");
    default:
      return nextStepFor(ticket?.automation && ticket.automation !== "auto" ? "reply" : "take-over");
  }
}

export interface EngineeringFacts {
  id?: unknown;
  status?: unknown;
  repair_started_at?: unknown;
  /** What the investigation found, e.g. { result: "not_reproduced", checked_at }. */
  reproduction?: unknown;
  /** Investigation notes, keyed by source. Free text for staff; never shown to a client. */
  evidence?: unknown;
  verification?: unknown;
  deployment?: unknown;
  updated_at?: unknown;
}

export interface LiveTicketState {
  status: string;
  automation?: string | null;
  pending_review?: string | null;
  merged_into?: string | null;
  engineering?: EngineeringFacts | null;
  operations?: Array<Record<string, unknown>> | null;
  feature_request?: { id?: unknown; status?: unknown } | null;
  escalations?: Array<{ reason?: unknown; status?: unknown }> | null;
}

/**
 * What the live ticket needs now, or null when nothing is waiting on a person.
 * A link's action hint is only honoured when it is still valid for the live
 * ticket, so a stale email can never trigger the wrong thing.
 */
export function liveNextStep(t: LiveTicketState, hint?: NextAction | null): NextStep | null {
  if (t.merged_into) return null;
  const valid = new Set<NextAction>();
  const eng = t.engineering ?? null;
  const engStatus = typeof eng?.status === "string" ? eng.status : null;
  if (t.pending_review === "reply_after_resolution") valid.add("review-reply");
  if (eng?.id && engStatus === "awaiting_approval") valid.add("approve-fix");
  const startRequested = (t.escalations ?? []).some((e) => e.reason === "engineering_start_requested" && e.status !== "resolved");
  const outcome = resolutionOutcome(eng);
  // A repair is pointless once the investigation could not reproduce the problem.
  if (eng?.id && engStatus === "open" && !eng.repair_started_at && startRequested && outcome !== "not_reproduced") valid.add("start-repair");
  if ((t.operations ?? []).some((o) => o.status === "previewed")) valid.add("confirm-change");
  if (t.feature_request?.id && String(t.feature_request.status ?? "awaiting_decision") === "awaiting_decision") valid.add("decide-feature");
  if (t.status !== "resolved" && outcome) valid.add("send-and-solve");
  if (t.status !== "resolved") {
    if (t.automation === "auto" || t.automation === "paused") valid.add("take-over");
    else valid.add("reply");
  }
  if (hint && valid.has(hint)) return nextStepFor(hint);
  for (const a of ["review-reply", "approve-fix", "start-repair", "confirm-change", "decide-feature", "send-and-solve"] as const) {
    if (valid.has(a)) return nextStepFor(a);
  }
  // A ticket waiting on a person, or one a person opened from a "needs you" email,
  // falls back to the human step that is valid right now.
  if (t.status === "needs_owner" || hint) {
    if (valid.has("take-over")) return nextStepFor("take-over");
    if (valid.has("reply")) return nextStepFor("reply");
  }
  return null;
}

/** The Support page deep link for a ticket. Opening it does nothing by itself. */
export function supportLink(appUrl: string, ticketId: string, action?: NextAction | null): string {
  const base = appUrl.replace(/\/+$/, "");
  const q = new URLSearchParams({ ticket: ticketId });
  if (action) q.set("action", action);
  return `${base}/support?${q.toString()}`;
}

// ---------------------------------------------------------------------------
// "Send this reply and mark solved": when Bloom already knows the answer
// ---------------------------------------------------------------------------
export type ResolutionOutcome = "not_reproduced" | "fixed";

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null);

/**
 * Whether the investigation already settled the request, from stored facts only:
 * "not_reproduced" when Bloom investigated and could not reproduce it, "fixed"
 * when the linked fix is live and its check passed. Otherwise null.
 */
export function resolutionOutcome(eng: EngineeringFacts | null | undefined): ResolutionOutcome | null {
  if (!eng) return null;
  const status = typeof eng.status === "string" ? eng.status : "";
  const repro = obj(eng.reproduction);
  if (status === "not_reproduced" || repro?.result === "not_reproduced") {
    // A repair that is already under way or released wins over an old reproduction note.
    if (["fixing", "awaiting_approval", "approved", "merging", "deploying", "verifying", "verified"].includes(status)) return status === "verified" ? "fixed" : null;
    return "not_reproduced";
  }
  if (status === "verified" && obj(eng.verification)?.passed === true) return "fixed";
  return null;
}

/** Things people save in BloomSites and the CRM, named in the investigation notes. */
const SAVED_THING = /\b(logo|banner|image|photo|picture|page|product|menu|form|post|campaign|segment|order|setting)s?\b/i;

function shortDate(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, month: "short", day: "numeric" }).format(d).replace(/\.$/, "");
  } catch {
    return iso.slice(0, 10);
  }
}

/** The first "YYYY-MM-DD hh:mm" (UTC) in a note, as an ISO time. */
function firstTimestamp(text: string): string | null {
  const m = text.match(/\b(20\d\d-[01]\d-[0-3]\d)(?:[ T]([0-2]\d:[0-5]\d)(?::[0-5]\d)?)?/);
  return m ? `${m[1]}T${m[2] ?? "12:00"}:00Z` : null;
}

export interface ResolutionPlan {
  outcome: ResolutionOutcome;
  /** Plain sentences for staff: what Bloom found. Never raw codes or IDs. */
  findings: string[];
  /** The reply to the client. Deterministic: built from stored facts, never invented. */
  draft: string;
  /** One client-facing sentence recorded as the resolution summary. */
  summary: string;
  /** How the outcome was checked; recorded as the resolution's verification note. */
  checked: string;
  /** Why no code change shipped, when none did. */
  noDeployReason: string | null;
}

/**
 * The ready reply and the facts behind it. Built only from stored data (the
 * engineering issue's reproduction, evidence and verification) with a fixed
 * template, so it is the same every time and never claims more than the
 * records show. Returns null when the request is not settled.
 */
export function resolutionPlan(input: {
  engineering: EngineeringFacts | null | undefined;
  requesterName?: string | null;
  timeZone?: string;
}): ResolutionPlan | null {
  const outcome = resolutionOutcome(input.engineering);
  if (!outcome) return null;
  const tz = input.timeZone ?? "America/Toronto";
  const first = String(input.requesterName ?? "").trim().split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, "") ?? "";
  const hello = first && !/@/.test(String(input.requesterName)) ? `Hi ${first},` : "Hi there,";
  if (outcome === "fixed") {
    return {
      outcome,
      findings: ["Bloom's fix is live and its check on the live site passed."],
      draft: `${hello}\n\nGood news: we released a fix for this and checked it on the live site, and it's working now.\n\nIf anything still isn't right, just reply to this email and we'll pick it straight back up.`,
      summary: "We released a fix and checked it on the live site.",
      checked: "The released fix passed its check on the live site.",
      noDeployReason: null,
    };
  }
  const evidence = obj(input.engineering?.evidence) ?? {};
  const repro = obj(input.engineering?.reproduction) ?? {};
  const success = typeof evidence.later_success === "string" ? evidence.later_success : "";
  const at = success ? firstTimestamp(success) : null;
  const when = at ? shortDate(at, tz) : "";
  const thing = success.match(SAVED_THING)?.[1]?.toLowerCase() ?? null;
  const findings = ["Bloom investigated and couldn't reproduce the problem."];
  if (when) findings.push(`The client saved ${thing ? `the ${thing}` : "it"} successfully on ${when}.`);
  if (typeof repro.server_path_test === "string" && /\b200\b/.test(repro.server_path_test)) findings.push("The same save, replayed on our side, worked.");
  const saw = when ? `, and we can see your ${thing ?? "change"} saved successfully on ${when}` : "";
  return {
    outcome,
    findings,
    draft: `${hello}\n\nThanks for your patience. We looked into this and couldn't reproduce the problem on our side${saw}.\n\n` +
      "If it still isn't working, reply to this email with what you're trying to save (a screenshot or the file helps) and we'll take another look. Otherwise there's nothing more you need to do.",
    summary: `We looked into this and couldn't reproduce the problem${saw}.`,
    checked: when ? `Not reproduced; the client's own save succeeded on ${when}.` : "Investigated and not reproduced.",
    noDeployReason: "Not reproduced: no code defect was found, so no fix was needed.",
  };
}
