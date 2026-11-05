// Bloom Support — the one thing a ticket needs from a person, in plain words.
// Pure: no I/O and no Deno globals. The staff emails use it to pick the button
// and the deep link; the CRM Support page uses the same function on the LIVE
// ticket to show "Bloom recommends" with a single confirm button. The link only
// opens BloomSuite: the person signs in normally, the action runs through the
// existing endpoints, and the database checks their permissions.

export type NextAction = "approve-fix" | "start-repair" | "confirm-change" | "review-reply" | "decide-feature" | "take-over" | "reply";

export const NEXT_ACTIONS: readonly NextAction[] = ["approve-fix", "start-repair", "confirm-change", "review-reply", "decide-feature", "take-over", "reply"];

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

export interface LiveTicketState {
  status: string;
  automation?: string | null;
  pending_review?: string | null;
  merged_into?: string | null;
  engineering?: { id?: unknown; status?: unknown; repair_started_at?: unknown } | null;
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
  if (eng?.id && engStatus === "open" && !eng.repair_started_at && startRequested) valid.add("start-repair");
  if ((t.operations ?? []).some((o) => o.status === "previewed")) valid.add("confirm-change");
  if (t.feature_request?.id && String(t.feature_request.status ?? "awaiting_decision") === "awaiting_decision") valid.add("decide-feature");
  if (t.status !== "resolved") {
    if (t.automation === "auto" || t.automation === "paused") valid.add("take-over");
    else valid.add("reply");
  }
  if (hint && valid.has(hint)) return nextStepFor(hint);
  for (const a of ["review-reply", "approve-fix", "start-repair", "confirm-change", "decide-feature"] as const) {
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
