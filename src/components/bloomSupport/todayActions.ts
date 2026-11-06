export type TodayEscalation = {
  id: unknown;
  status?: unknown;
  ticket_id?: unknown;
  created_at?: unknown;
  [key: string]: unknown;
};

/** One client problem gets one Today card, even when several watchdog reasons are open. */
export function groupOpenEscalations(rows: TodayEscalation[]): TodayEscalation[][] {
  const groups = new Map<string, TodayEscalation[]>();
  for (const row of rows) {
    if (String(row.status) !== "open") continue;
    const ticket = typeof row.ticket_id === "string" && row.ticket_id ? row.ticket_id : null;
    const key = ticket ? `ticket:${ticket}` : `escalation:${String(row.id)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((group) => group.sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  ));
}

export type DecisionChoice = "do" | "reject" | "other";
export type ReviewDecision = {
  ticketIds: string[];
  escalations: TodayEscalation[];
  recommendation: string;
  ownerId: string;
};
export interface DecisionApi {
  setAutomation(id: string, mode: "human", reason: string): Promise<unknown>;
  resolveEscalation(id: string, decision: string): Promise<unknown>;
  updateTicket(id: string, patch: Record<string, unknown>): Promise<unknown>;
}

/** A review decision assigns work; it never approves a release or executes a payment. */
export async function recordReviewDecision(
  api: DecisionApi, input: ReviewDecision, choice: DecisionChoice, alternative = "",
): Promise<void> {
  if (choice === "other" && !alternative.trim()) throw new Error("Tell us what you would like instead.");
  const decision = choice === "do" ? `Accepted: ${input.recommendation}`
    : choice === "reject" ? `Rejected: ${input.recommendation}. Do not repeat this recommendation; an alternative needs review.`
    : `Alternative requested: ${alternative.trim()}`;
  // Hold automation first. If a later write fails, no automatic retry or
  // release is enabled; the visible error lets the person retry the recording.
  for (const id of [...new Set(input.ticketIds)]) await api.setAutomation(id, "human", decision);
  for (const item of input.escalations) {
    if (["open", "acknowledged"].includes(String(item.status))) await api.resolveEscalation(String(item.id), decision);
  }
  for (const id of [...new Set(input.ticketIds)]) await api.updateTicket(id, {
    status: "working", owner_id: input.ownerId, next_action: decision,
    next_action_due_at: new Date(Date.now() + 24 * 3600e3).toISOString(),
    reason: decision,
  });
}

export function escalationExplanation(reason: unknown): string {
  if (/engineering|repair/.test(String(reason))) return "The automatic fix cannot continue safely. A person needs to choose the next step.";
  if (/overdue|stalled/.test(String(reason))) return "This request has been waiting too long for its next step.";
  if (/feature/.test(String(reason))) return "A customer has asked for something the product does not offer yet.";
  return "Bloom needs your help to move this request forward.";
}
