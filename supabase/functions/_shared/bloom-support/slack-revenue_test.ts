import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { coverage, money, revenueFacts, statesAmount } from "./slack-revenue.ts";
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
