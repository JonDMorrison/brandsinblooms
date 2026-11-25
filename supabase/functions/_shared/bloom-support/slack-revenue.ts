// Recorded revenue figures for a Slack reply, composed from revenue_by_client
// results in code. The model summarises; it never transcribes these amounts.
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(row) : [];
const text = (v: unknown): string => typeof v === "string" ? v.replace(/[*_~`<>|]/g, "").slice(0, 80) : "";

/** 1234567.8 -> "1,234,567.80". Only finite numbers; anything else is not a figure. */
export function money(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const [whole, cents] = Math.abs(v).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

/** Uncategorised share of all sales as a whole percent, or null when there is none to report. */
export function coverage(uncategorised: unknown, all: unknown): number | null {
  if (typeof uncategorised !== "number" || typeof all !== "number" || !(uncategorised > 0) || !(all > 0)) return null;
  return Math.round((uncategorised / all) * 100);
}

/** True when model prose states a money-like amount (1,234 or 12.34). Dates do not match. */
export function statesAmount(value: string): boolean {
  return /\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d+\.\d{2}\b/.test(value);
}

interface Client {
  name: string; source: string; currency: string | null; first: string; last: string;
  allSales: unknown; uncategorised: unknown; requested: Map<string, Row>; largest: unknown;
}

/**
 * Merge every revenue_by_client result for one range into one block per garden
 * centre and source. Amounts carry the stored currency code, or none when the
 * source records no currency; "not recorded" is kept distinct from zero.
 */
export function revenueFacts(results: unknown[]): string | null {
  const ranges = new Map<string, Map<string, Client>>();
  for (const raw of results) {
    const r = row(raw), range = row(r.requested_range);
    const key = `${text(range.from)} to ${text(range.to)}`;
    if (!ranges.has(key)) ranges.set(key, new Map());
    const clients = ranges.get(key)!;
    for (const c of rows(r.clients)) {
      const id = `${text(c.garden_centre)}|${text(c.source_system)}`;
      const period = row(c.period_with_sales);
      const currency = typeof c.currency === "string" && /^[A-Z]{3}$/.test(c.currency) ? c.currency : null;
      const client = clients.get(id) ?? {
        name: text(c.garden_centre) || "Unnamed client", source: text(c.source_system), currency,
        first: text(period.first), last: text(period.last), allSales: c.all_sales_total,
        uncategorised: c.uncategorised_total,
        requested: new Map<string, Row>(), largest: c.largest_categories,
      };
      for (const q of rows(c.requested_categories)) client.requested.set(text(q.requested), q);
      clients.set(id, client);
    }
  }
  const blocks: string[] = [];
  for (const [range, clients] of ranges) {
    if (!clients.size) { blocks.push(`No recorded POS sales from ${range}.`); continue; }
    const lines = [`Recorded POS sales, ${range}:`];
    for (const c of clients.values()) {
      const amount = (v: unknown) => { const m = money(v); return m === null ? null : c.currency ? `${m} ${c.currency}` : m; };
      lines.push(`*${c.name}* (${c.source}; ${c.currency ?? "currency not recorded"}; sales ${c.first} to ${c.last})`);
      lines.push(`• All sales: ${amount(c.allSales) ?? "not returned"}`);
      const share = coverage(c.uncategorised, c.allSales);
      if (share !== null) lines.push(`• No category recorded: ${amount(c.uncategorised)} (${share}% of all sales). Category figures below cover only the rest.`);
      const notRecorded: string[] = [];
      for (const [term, q] of c.requested) {
        if (typeof q.total === "string") { notRecorded.push(term); continue; }
        const labels = rows(q.matched_labels);
        const count = typeof q.matched_label_count === "number" ? q.matched_label_count : labels.length;
        const shown = labels.slice(0, 2).map(l => `${text(l.label)} ${money(l.total) ?? ""}`.trim());
        const detail = count === 0 ? "no recorded category matched"
          : `${shown.join("; ")}${count > shown.length ? `; +${count - shown.length} more labels` : ""}`;
        lines.push(`• "${term}": ${amount(q.total) ?? "not returned"} (${detail})`);
      }
      if (notRecorded.length) lines.push(`• ${notRecorded.map(t => `"${t}"`).join(", ")}: not recorded; ${c.source} keeps no category`);
      if (!c.requested.size) {
        const largest = row(c.largest);
        const top = rows(largest.largest).slice(0, 3).map(l => `${text(l.category)} ${amount(l.total) ?? ""}`.trim());
        lines.push(top.length ? `• Largest recorded categories: ${top.join("; ")}` : `• Categories: not recorded by ${c.source}`);
      }
    }
    blocks.push(lines.join("\n"));
  }
  if (!blocks.length) return null;
  blocks.push("Not covered: BloomSites online orders, event tickets and fundraising (separate database).");
  return blocks.join("\n\n");
}
