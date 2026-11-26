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
export function revenueFacts(results: unknown[], options: { compact?: boolean } = {}): string | null {
  const keep = options.compact ? 1 : 2;
  const ranges = new Map<string, Map<string, Client>>();
  const sitesByRange = new Map<string, Map<string, Row>>();
  let bloomSites: "covered" | "unavailable" | "absent" = "absent";
  for (const raw of results) {
    const r = row(raw), range = row(r.requested_range);
    const key = `${text(range.from)} to ${text(range.to)}`;
    if (!ranges.has(key)) ranges.set(key, new Map());
    const clients = ranges.get(key)!;
    const bs = row(r.bloomsites);
    if (Array.isArray(bs.sites)) {
      bloomSites = "covered";
      const sites = sitesByRange.get(key) ?? new Map<string, Row>();
      for (const site of rows(bs.sites)) sites.set(text(site.site_id) || text(site.site_name), site);
      sitesByRange.set(key, sites);
    } else if (bs.unavailable === true && bloomSites === "absent") bloomSites = "unavailable";
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
        const shown = labels.slice(0, keep).map(l => `${text(l.label)} ${money(l.total) ?? ""}`.trim());
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
    const sites = sitesByRange.get(range);
    if (sites) blocks.push(bloomSitesBlock(range, sites));
  }
  if (!blocks.length) return null;
  blocks.push(bloomSites === "covered" ? "Not covered: BloomSites online store orders outside fundraising."
    : bloomSites === "unavailable" ? "BloomSites event tickets and fundraising could not be retrieved this time; online store orders are not covered."
    : "Not covered: BloomSites online orders, event tickets and fundraising (separate database).");
  return blocks.join("\n\n");
}

/**
 * BloomSites event-ticket and fundraising revenue (the CMS revenue.by_site op),
 * one block per site. Amounts arrive in minor units in a stored currency code;
 * tickets paid in store carry no recorded amount and are only counted.
 */
export function bloomSitesBlock(range: string, sites: Map<string, Row>): string {
  const lines = [`BloomSites event tickets and fundraising, ${range}:`];
  const major = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? money(v / 100) : null;
  const plural = (n: unknown, word: string) => { const k = typeof n === "number" ? n : 0; return `${k} ${word}${k === 1 ? "" : "s"}`; };
  for (const site of sites.values()) {
    const tickets = rows(site.event_tickets), fundraising = rows(site.fundraising);
    const inStore = typeof site.event_tickets_paid_in_store === "number" ? site.event_tickets_paid_in_store : 0;
    if (!tickets.length && !fundraising.length && !inStore) continue;
    const inStoreNote = inStore ? `; ${plural(inStore, "order")} paid in store, amount not recorded` : "";
    const ticketText = tickets.length
      ? tickets.map(t => `tickets ${major(t.net_minor) ?? "not returned"} ${text(t.currency)} net, ${plural(t.orders, "order")} (refunds ${major(t.refunded_minor) ?? "0.00"}${inStoreNote})`).join("; ")
      : inStore ? `tickets: ${plural(inStore, "order")} paid in store, amount not recorded` : "tickets: none sold";
    const fundText = fundraising.length
      ? fundraising.map(f => `fundraising ${major(f.net_sales_minor) ?? "not returned"} ${text(f.currency)} net sales, groups' share ${major(f.net_fundraiser_earnings_minor) ?? "not returned"}, ${plural(f.orders, "order")}`).join("; ")
      : "fundraising: none recorded";
    lines.push(`• *${text(site.site_name) || "Unnamed site"}*: ${ticketText} · ${fundText}`);
  }
  if (lines.length === 1) lines.push("No event-ticket or fundraising sales recorded.");
  return lines.join("\n");
}

/**
 * A request for revenue by garden centre (as opposed to a product question
 * about where to find sales reports). Both a money word and a cross-client
 * or totals cue must appear.
 */
export function revenueByClientQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return /\b(?:revenue|sales|fundrais\w*|ticket sales|turnover|income)\b/.test(q)
    && /\b(?:garden cent(?:re|er)s?|by (?:client|store|centre|center|location|garden)|per (?:client|store|centre|center)|each (?:client|store|centre|center)|all (?:clients|stores)|we(?:'ve| have)? (?:generated|made|earned)|how much)\b/.test(q);
}

/** Fixed reply where revenue_by_client is not offered: where to ask, never a claimed restriction on Bloom. */
export const REVENUE_ELSEWHERE_REPLY =
  "Revenue by garden centre is client financial data, so I answer it in the private Bloom finance channel for owner-level staff, not in this channel. " +
  "Ask there and I'll reply with recorded POS sales plus BloomSites event-ticket and fundraising totals for the period you name (default: the last 12 months).";
