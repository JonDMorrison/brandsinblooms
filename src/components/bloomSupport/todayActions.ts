export type TodayEscalation = {
  id: unknown;
  status?: unknown;
  ticket_id?: unknown;
  created_at?: unknown;
  [key: string]: unknown;
};

export type TodayTicketOwnership = {
  status: unknown;
  automation?: unknown;
  executor?: unknown;
};

/** Today must never describe a person-owned or Needs You ticket as Bloom's work. */
export function isBloomHandlingTicket(ticket: TodayTicketOwnership): boolean {
  return ticket.status !== "resolved" && ticket.status !== "needs_owner" &&
    ticket.automation === "auto" && ticket.executor === "bloom";
}

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
  getTicket(id: string): Promise<{ status: string; merged_into?: string | null; version?: number }>;
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
  const activeTickets = new Set<string>();
  for (const id of [...new Set(input.ticketIds)]) {
    const ticket = await api.getTicket(id);
    if (ticket.status === "resolved" || ticket.merged_into) continue;
    if (!Number.isSafeInteger(ticket.version)) throw new Error("Refresh the request before recording this decision.");
    activeTickets.add(id);
  }
  // Hold automation first. If a later write fails, no automatic retry or
  // release is enabled; the visible error lets the person retry the recording.
  for (const id of activeTickets) await api.setAutomation(id, "human", decision);
  for (const item of input.escalations) {
    if (item.ticket_id && !activeTickets.has(String(item.ticket_id))) continue;
    if (["open", "acknowledged"].includes(String(item.status))) await api.resolveEscalation(String(item.id), decision);
  }
  for (const id of activeTickets) {
    const ticket = await api.getTicket(id);
    if (ticket.status === "resolved" || ticket.merged_into) continue;
    if (!Number.isSafeInteger(ticket.version)) throw new Error("Refresh the request before recording this decision.");
    await api.updateTicket(id, {
      version: ticket.version, status: "working", owner_id: input.ownerId, next_action: decision,
      next_action_due_at: new Date(Date.now() + 24 * 3600e3).toISOString(),
      reason: decision,
    });
  }
}

export function escalationExplanation(reason: unknown): string {
  if (/engineering|repair/.test(String(reason))) return "The automatic fix cannot continue safely. A person needs to choose the next step.";
  if (/overdue|stalled/.test(String(reason))) return "This request has been waiting too long for its next step.";
  if (/feature/.test(String(reason))) return "A customer has asked for something the product does not offer yet.";
  return "Bloom needs your help to move this request forward.";
}
