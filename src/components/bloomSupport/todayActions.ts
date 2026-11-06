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
