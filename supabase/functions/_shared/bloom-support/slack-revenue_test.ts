import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { bloomSitesBlock, coverage, money, revenueFacts, statesAmount } from "./slack-revenue.ts";
import { composeSlackAgentReply } from "./slack-agent-core.ts";

const range = { from: "2025-11-25", to: "2026-11-25" };
const westCoast = (requested: unknown[]) => ({ garden_centre: "West Coast Gardens", source_system: "IDEAL POS", currency: "CAD",
  period_with_sales: { first: "2025-11-25", last: "2026-11-02" }, all_sales_total: 2408045.29, categories_recorded: true, requested_categories: requested });
const burnetts = (terms: string[]) => ({ garden_centre: "Burnett's Country Gardens", source_system: "VMX POS", currency: "not recorded by this source; do not assume or convert",
  period_with_sales: { first: "2025-11-26", last: "2026-09-20" }, all_sales_total: 2160161.14, categories_recorded: false,
  requested_categories: terms.map(t => ({ requested: t, total: "not recorded by this source", matched_labels: [] })) });
const patio = (requested: unknown[]) => ({ garden_centre: "Patio Gardens", source_system: "Lightspeed", currency: "not recorded by this source; do not assume or convert",
  period_with_sales: { first: "2025-12-04", last: "2026-11-24" }, all_sales_total: 762042.12, categories_recorded: true, requested_categories: requested });

Deno.test("money formats finite numbers only", () => {
  assertEquals(money(2408045.29), "2,408,045.29");
  assertEquals(money(0), "0.00");
  assertEquals(money(-12.5), "-12.50");
  assertEquals(money("12"), null);
  assertEquals(money(Number.NaN), null);
});

Deno.test("statesAmount catches money-like figures, not dates", () => {
  assert(statesAmount("Events were CAD 188.80"));
  assert(statesAmount("about 2,408,045 in sales"));
  assertEquals(statesAmount("Sales from 2025-11-25 to 2026-11-25 are below."), false);
  assertEquals(statesAmount("Two stores record no category."), false);
});

Deno.test("separate per-term calls merge into one block per store, keeping zero distinct from not recorded", () => {
  const event = { requested_range: range, clients: [
    westCoast([{ requested: "event", total: 188.8, matched_labels: [{ label: "2,503 Workshops / Events", total: 188.8 }], matched_label_count: 1 }]),
    burnetts(["event"]),
    patio([{ requested: "event", total: 0, matched_labels: [], matched_label_count: 0 }]),
  ] };
  const plant = { requested_range: range, clients: [
    westCoast([{ requested: "plant", total: 62408.12, matched_label_count: 16, matched_labels: [
      { label: "1,503 Poinsettias", total: 22758.1 }, { label: "1,501 Tropicals", total: 10090.4 }] }]),
    burnetts(["plant"]),
    patio([{ requested: "plant", total: 24676.33, matched_labels: [{ label: "Plants", total: 24676.33 }], matched_label_count: 1 }]),
  ] };
  const facts = revenueFacts([event, plant])!;
  assertEquals(facts.match(/\*West Coast Gardens\*/g)?.length, 1);
  assertStringIncludes(facts, "Recorded POS sales, 2025-11-25 to 2026-11-25:");
  assertStringIncludes(facts, "• All sales: 2,408,045.29 CAD");
  assertStringIncludes(facts, '• "event": 188.80 CAD (2,503 Workshops / Events 188.80)');
  assertStringIncludes(facts, '• "plant": 62,408.12 CAD (1,503 Poinsettias 22,758.10; 1,501 Tropicals 10,090.40; +14 more labels)');
  // Lightspeed stores no currency: amounts carry none, and zero is a recorded zero.
  assertStringIncludes(facts, "*Patio Gardens* (Lightspeed; currency not recorded;");
  assertStringIncludes(facts, '• "event": 0.00 (no recorded category matched)');
  assertStringIncludes(facts, '• "plant": 24,676.33 (Plants 24,676.33)');
  assertEquals(/Patio[\s\S]*?CAD/.test(facts.split("*Patio Gardens*")[1].split("*Burnett")[0] ?? ""), false);
  assertStringIncludes(facts, '• "event", "plant": not recorded; VMX POS keeps no category');
  assertStringIncludes(facts, "• All sales: 2,160,161.14\n");
  assertStringIncludes(facts, "Not covered: BloomSites online orders, event tickets and fundraising");
});

Deno.test("the figures fit a Slack reply for four stores and three categories", () => {
  const terms = ["event", "fundraising", "plant"];
  const hit = (t: string) => ({ requested: t, total: 1234567.89, matched_label_count: 18, matched_labels: [
    { label: "2,801 Studio Indoor Planters Long Label", total: 16612.62 }, { label: "2,703 Studio Greens Planters Long", total: 13741.64 }] });
  const facts = revenueFacts([{ requested_range: range, clients: [
    westCoast(terms.map(hit)), burnetts(terms), patio(terms.map(hit)),
    { ...burnetts(terms), garden_centre: "Down to Earth Garden Center", source_system: "Square", currency: "USD" },
  ] }])!;
  const reply = composeSlackAgentReply("Here is the recorded revenue by garden centre.", [facts, "Checked sources: x"]);
  assertStringIncludes(reply, "Down to Earth Garden Center");
  assertStringIncludes(reply, "Not covered:");
  assert(reply.length <= 2400, String(reply.length));
});

Deno.test("no revenue results means no figures block", () => {
  assertEquals(revenueFacts([]), null);
});

Deno.test("uncategorised sales are shown as a share so category figures are not read as complete", () => {
  assertEquals(coverage(2099965.0, 2408045.29), 87);
  assertEquals(coverage(0, 2408045.29), null);
  assertEquals(coverage(null, 2408045.29), null);
  const facts = revenueFacts([{ requested_range: range, clients: [
    { ...westCoast([{ requested: "plant", total: 62408.12, matched_labels: [], matched_label_count: 16 }]), uncategorised_total: 2099965.0 },
    burnetts(["plant"]),
  ] }])!;
  assertStringIncludes(facts, "• No category recorded: 2,099,965.00 CAD (87% of all sales). Category figures below cover only the rest.");
  // Sources that keep no category at all say so instead; no share line.
  assertEquals(facts.split("*Burnett")[1].includes("No category recorded"), false);
});

const bloomSites = { sites: [
  { site_id: "s1", site_name: "Lacoste Garden Centre", event_tickets_paid_in_store: 11,
    event_tickets: [{ currency: "CAD", orders: 881, gross_minor: 4712775, refunded_minor: 29250, net_minor: 4683525 }],
    fundraising: [{ currency: "CAD", orders: 31, sales_minor: 157400, refunded_minor: 0, net_sales_minor: 157400, net_fundraiser_earnings_minor: 52800, campaigns: 1 }] },
  { site_id: "s2", site_name: "Baltimore Valley Garden Centre", event_tickets_paid_in_store: 0,
    event_tickets: [{ currency: "CAD", orders: 109, gross_minor: 906941, refunded_minor: 15594, net_minor: 891347 }],
    fundraising: [{ currency: "CAD", orders: 57, sales_minor: 499000, refunded_minor: 0, net_sales_minor: 499000, net_fundraiser_earnings_minor: 136750, campaigns: 2 }] },
  { site_id: "s3", site_name: "The Flowerhouse", event_tickets_paid_in_store: 1,
    event_tickets: [{ currency: "CAD", orders: 41, gross_minor: 340000, refunded_minor: 5000, net_minor: 335000 }],
    fundraising: [{ currency: "CAD", orders: 96, sales_minor: 609600, refunded_minor: 0, net_sales_minor: 609600, net_fundraiser_earnings_minor: 152380, campaigns: 1 }] },
] };

Deno.test("BloomSites ticket and fundraising figures convert minor units and count in-store tickets without an amount", () => {
  const facts = revenueFacts([{ requested_range: range, clients: [westCoast([])], bloomsites: bloomSites }])!;
  assertStringIncludes(facts, "BloomSites event tickets and fundraising, 2025-11-25 to 2026-11-25:");
  assertStringIncludes(facts, "• *Lacoste Garden Centre*: tickets 46,835.25 CAD net, 881 orders (refunds 292.50; 11 orders paid in store, amount not recorded) · fundraising 1,574.00 CAD net sales, groups' share 528.00, 31 orders");
  assertStringIncludes(facts, "• *Baltimore Valley Garden Centre*: tickets 8,913.47 CAD net, 109 orders (refunds 155.94) · fundraising 4,990.00 CAD net sales, groups' share 1,367.50, 57 orders");
  assertStringIncludes(facts, "Not covered: BloomSites online store orders outside fundraising.");
  assertEquals(facts.includes("separate database"), false);
});

Deno.test("an unreachable BloomSites bridge is said plainly and never shown as zero", () => {
  const facts = revenueFacts([{ requested_range: range, clients: [westCoast([])], bloomsites: { unavailable: true } }])!;
  assertStringIncludes(facts, "BloomSites event tickets and fundraising could not be retrieved this time");
  assertEquals(facts.includes("groups' share"), false);
});

Deno.test("sites with nothing sold are left out, and an empty BloomSites result says so", () => {
  const block = bloomSitesBlock("2025-11-25 to 2026-11-25", new Map([["x", { site_id: "x", site_name: "Quiet", event_tickets: [], fundraising: [], event_tickets_paid_in_store: 0 }]]));
  assertEquals(block, "BloomSites event tickets and fundraising, 2025-11-25 to 2026-11-25:\nNo event-ticket or fundraising sales recorded.");
});

Deno.test("POS and BloomSites figures for Jeff's question fit one Slack reply", () => {
  const terms = ["event", "fundraising", "plant"];
  const hit = (t: string) => ({ requested: t, total: 1234567.89, matched_label_count: 18, matched_labels: [
    { label: "2,801 Studio Indoor Planters Long Label", total: 16612.62 }, { label: "2,703 Studio Greens Planters Long", total: 13741.64 }] });
  const facts = revenueFacts([{ requested_range: range, clients: [
    { ...westCoast(terms.map(hit)), uncategorised_total: 2099965.16 }, burnetts(terms), patio(terms.map(hit)),
    { ...burnetts(terms), garden_centre: "Down to Earth Garden Center", source_system: "Square", currency: "USD" },
  ], bloomsites: bloomSites }])!;
  const compact = revenueFacts([{ requested_range: range, clients: [
    { ...westCoast(terms.map(hit)), uncategorised_total: 2099965.16 }, burnetts(terms), patio(terms.map(hit)),
    { ...burnetts(terms), garden_centre: "Down to Earth Garden Center", source_system: "Square", currency: "USD" },
  ], bloomsites: bloomSites }], { compact: true })!;
  assert(compact.length < facts.length);
  const reply = composeSlackAgentReply("Here is the recorded revenue by garden centre.", [compact, "Checked sources: x"]);
  assertStringIncludes(reply, "The Flowerhouse");
  assertStringIncludes(reply, "Not covered: BloomSites online store orders outside fundraising.");
  assert(reply.length <= 2400, String(reply.length));
});
