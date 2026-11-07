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
