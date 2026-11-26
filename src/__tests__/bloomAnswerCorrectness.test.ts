import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatCurrency } from "../../supabase/functions/bloom-assist/tools/implementations/shared";
import { queryCustomers } from "../../supabase/functions/bloom-assist/tools/implementations/query-customers";
import {
  getDashboardSummary,
  getRevenueAnalytics,
} from "../../supabase/functions/bloom-assist/tools/implementations/analytics-tools";
import { getCustomerTimeline } from "../../supabase/functions/bloom-assist/tools/implementations/entity-analytics";
import {
  findCustomerOpportunities,
  opportunityMessage,
} from "../../supabase/functions/bloom-assist/tools/implementations/customer-intelligence";
import { navigateTo } from "../../supabase/functions/bloom-assist/tools/implementations/navigate-to";
import { getToolCategoriesForRouting } from "../../supabase/functions/bloom-assist/tools/tool-routing";
import {
  buildPurchaseDataLine,
  formatPurchaseDataLine,
} from "../../supabase/functions/bloom-assist/purchase-data-summary";
import { BASE_SYSTEM_PROMPT } from "../../supabase/functions/bloom-assist/prompts/base-system-prompt";
import { buildPurchaseBehaviorLines } from "../../supabase/functions/generate-customer-insights/purchase-lines";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";
import type { JsonObject } from "../../supabase/functions/bloom-assist/types";

// Executor schema tests never invoke mutations or location checks.
vi.mock("../../supabase/functions/_shared/locationGuard.ts", () => ({}));

type Call = { table: string; method: string; args: unknown[] };
type TableData = Record<string, unknown[]>;

/** A chainable Supabase-like client. Every query resolves to the table's rows. */
function fakeClient(tables: TableData, rpcData: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const client = {
    calls,
    rpc: vi.fn(async (name: string) => ({
      data: name in rpcData ? rpcData[name] : true,
      error: null,
    })),
    from(table: string) {
      const rows = tables[table] ?? [];
      const result = { data: rows, error: null, count: rows.length };
      const builder: Record<string, unknown> = {};
      const chain = (method: string) =>
        (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      for (const method of [
        "select", "eq", "neq", "is", "in", "gte", "lt", "lte", "or", "not",
        "order", "limit", "range", "ilike", "insert",
      ]) {
        builder[method] = chain(method);
      }
      builder.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
      builder.then = (resolve: (value: typeof result) => unknown) =>
        Promise.resolve(result).then(resolve);
      return builder;
    },
  };
  return client;
}

function contextFor(client: ReturnType<typeof fakeClient>): ToolExecutionContext {
  return {
    tenantId: "tenant",
    authenticatedTenantId: "tenant",
    userId: "user",
    conversationId: "conversation",
    messageId: "message",
    timezone: "America/Vancouver",
    dataClient: client,
    serviceClient: client,
  } as unknown as ToolExecutionContext;
}

describe("1. unknown spend is never shown as $0.00 USD", () => {
  it("formats missing amounts as Unknown and never assumes USD", () => {
    expect(formatCurrency(null)).toBe("Unknown");
    expect(formatCurrency(undefined)).toBe("Unknown");
    expect(formatCurrency(1234.5)).toBe("1,234.50");
    expect(formatCurrency(0)).toBe("0.00");
    expect(formatCurrency(10, "CAD")).toBe("CA$10.00");
    expect(formatCurrency(10, null)).not.toContain("$");
  });

  it("query_customers shows Unknown spend and sorts unknowns last", async () => {
    const client = fakeClient({
      crm_customers: [
        { id: "a", first_name: "Ann", last_name: null, email: "a@x.test", phone: null, total_spent: null, last_purchase_date: null, created_at: "2026-01-01", persona: null, persona_id: null },
        { id: "b", first_name: "Bo", last_name: null, email: "b@x.test", phone: null, total_spent: 250, last_purchase_date: null, created_at: "2026-01-01", persona: null, persona_id: null },
      ],
    });
    const result = await queryCustomers(
      { sort_by: "total_spent", sort_order: "desc" },
      contextFor(client),
    );
    const rows = result.data as Array<Record<string, unknown>>;
    expect(rows[0].total_spent).toBe("Unknown");
    expect(rows[1].total_spent).toBe("250.00");
    expect(JSON.stringify(rows)).not.toContain("USD");
    const order = client.calls.find((call) => call.table === "crm_customers" && call.method === "order");
    expect(order?.args).toEqual(["total_spent", { ascending: false, nullsFirst: false }]);
  });

  it("steers top-customer questions to spend and ranking tools", () => {
    expect(BASE_SYSTEM_PROMPT).not.toContain("call query_customers (sorted by spend");
    expect(BASE_SYSTEM_PROMPT).toContain("explore_customer_reported_spending or rank_customers_by_intelligence");
  });
});

describe("2. order tools say when no dated sales records exist", () => {
  const westCoast = () =>
    fakeClient(
      {
        crm_customers: [{ id: "c1", tenant_id: "tenant", first_name: "Pat", last_name: null, email: "p@x.test", created_at: "2026-01-01", total_spent: null, last_purchase_date: null }],
        pos_orders: [],
        shopify_orders: [],
        lightspeed_sales: [],
      },
      {
        get_customer_purchase_timeline: [{ period_date: "2026-10-01", order_count: 0, total_revenue: 0 }],
        get_customer_engagement_timeline: [],
        get_customer_unified_timeline: [],
      },
    );

  it("revenue analytics returns a plain no-data result instead of zero cards", async () => {
    const result = await getRevenueAnalytics({ period: "this_month" }, contextFor(westCoast()));
    expect(result.success).toBe(false);
    expect(result.error).toBe("no_dated_sales_records");
    expect(result.message).toContain("No dated sales records are connected for this company");
    expect(result.message).not.toContain("—");
  });

  it("dashboard keeps real counts but marks revenue and orders Unknown", async () => {
    const result = await getDashboardSummary({}, contextFor(westCoast()));
    const data = result.data as { metrics: Array<Record<string, unknown>>; sales_data_status: string };
    const revenue = data.metrics.find((metric) => metric.key === "revenue_this_month");
    const orders = data.metrics.find((metric) => metric.key === "recent_orders");
    expect(revenue).toMatchObject({ value: "Unknown", raw_value: null, change_label: null });
    expect(orders).toMatchObject({ value: "Unknown", raw_value: null });
    expect(data.sales_data_status).toBe("no_dated_sales_records");
    expect(result.message).toContain("Revenue and recent orders are Unknown");
  });

  it("dashboard still reports revenue when dated orders exist", async () => {
    const client = westCoast();
    const withOrders = fakeClient({ shopify_orders: [{ id: "o1" }] });
    const context = { ...contextFor(client), dataClient: withOrders } as unknown as ToolExecutionContext;
    const result = await getDashboardSummary({}, context);
    const data = result.data as { metrics: Array<Record<string, unknown>>; sales_data_status: string };
    expect(data.sales_data_status).toBe("dated_sales_records");
    expect(data.metrics.find((metric) => metric.key === "revenue_this_month")?.value).not.toBe("Unknown");
  });

  it("customer timeline drops zero-filled purchase months", async () => {
    const result = await getCustomerTimeline({ customer_id: "c1" }, contextFor(westCoast()));
    const data = result.data as { rollups: { purchases: unknown[] }; purchase_history_status: string };
    expect(data.rollups.purchases).toEqual([]);
    expect(data.purchase_history_status).toBe("no_dated_sales_records");
    expect(result.message).toContain("Purchases are not shown");
  });

  it("insights prompt says Unknown instead of 0 orders", () => {
    const lines = buildPurchaseBehaviorLines(null).join("\n");
    expect(lines).toContain("Total orders: Unknown");
    expect(lines).not.toContain("$");
    expect(buildPurchaseBehaviorLines({ total_purchases: 3, lifetime_value: 42 }).join("\n")).toContain("Total orders: 3");
    const source = fs.readFileSync(path.join(process.cwd(), "supabase/functions/generate-customer-insights/index.ts"), "utf8");
    expect(source).not.toContain("total_purchases || 0");
  });
});

describe("3. Bloom knows which purchase data the company has", () => {
  it("describes IdealPOS periods and missing dated sales", async () => {
    const client = fakeClient({
      customer_intelligence_imports: [
        { report_type: "customer_sales_summary", source_period_start: "2025-01-01", source_period_end: "2025-12-31" },
        { report_type: "customer_spending", source_period_start: "2026-01-01", source_period_end: "2026-10-14" },
      ],
    });
    const line = await buildPurchaseDataLine(client as never, "tenant");
    expect(line).toContain("Purchase data available: no dated sales records are connected");
    expect(line).toContain("customer spending 2026-01-01 to 2026-10-14");
    const imports = client.calls.filter((call) => call.table === "customer_intelligence_imports");
    expect(imports).toContainEqual({ table: "customer_intelligence_imports", method: "eq", args: ["source", "ideal"] });
    expect(imports).toContainEqual({ table: "customer_intelligence_imports", method: "eq", args: ["status", "completed"] });
    expect(client.calls.filter((call) => call.method === "eq" && call.args[0] === "tenant_id").every((call) => call.args[1] === "tenant")).toBe(true);
  });

  it("lists every retained year, even when newer imports finished later", () => {
    const years = [2021, 2022, 2023, 2024, 2025];
    const line = formatPurchaseDataLine({
      hasDatedOrders: false,
      idealPeriods: [
        ...years.map((y) => ({ report_type: "journal", source_period_start: `${y}-01-01`, source_period_end: `${y}-12-31` })),
        ...years.map((y) => ({ report_type: "customer_sales_summary", source_period_start: `${y}-01-01`, source_period_end: `${y}-12-31` })),
        { report_type: "customer_sales_summary", source_period_start: "2025-01-01", source_period_end: "2025-12-31" },
      ],
    });
    expect(line).toContain(
      "customer sales summary 2021-01-01 to 2021-12-31, 2022-01-01 to 2022-12-31, 2023-01-01 to 2023-12-31, 2024-01-01 to 2024-12-31, 2025-01-01 to 2025-12-31",
    );
    expect(line).not.toContain("journal");
    expect(line).toContain("Do not say a listed period is unavailable");
  });

  it("never blocks: a hanging lookup resolves to not checked within the budget", async () => {
    const hanging = { from: () => { const b: Record<string, unknown> = {}; for (const m of ["select", "eq", "not", "order"]) b[m] = () => b; b.limit = () => new Promise(() => undefined); return b; } };
    const started = Date.now();
    const line = await buildPurchaseDataLine(hanging as never, "tenant", 30);
    expect(Date.now() - started).toBeLessThan(500);
    expect(line).toContain("not checked");
  });

  it("never fails: a broken lookup resolves to not checked", async () => {
    const broken = { from: () => { throw new Error("boom"); } };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(buildPurchaseDataLine(broken as never, "tenant")).resolves.toContain("not checked");
    expect(formatPurchaseDataLine({ hasDatedOrders: true, idealPeriods: [] })).toContain("dated sales records are connected");
  });
});

describe("4. export and audience tools are routed", () => {
  it("adds utility to query, analytics and mutation, and content to mutation", () => {
    for (const [category, complexity] of [["query", "simple"], ["query", "complex"], ["analytics", "simple"], ["mutation", "simple"]] as const) {
      expect(getToolCategoriesForRouting("standard", { category, complexity })?.has("utility")).toBe(true);
    }
    expect(getToolCategoriesForRouting("standard", { category: "mutation", complexity: "simple" })?.has("content")).toBe(true);
    expect(getToolCategoriesForRouting("standard", { category: "general", complexity: "simple" })).toBeNull();
    expect(getToolCategoriesForRouting("image", { category: "query", complexity: "simple" })?.has("utility")).toBe(false);
  });
});

describe("5. how-to answers stay honest and links are real", () => {
  const app = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");
  const run = (params: Record<string, string>) => navigateTo(params, contextFor(fakeClient({})));

  it.each([
    [{ target: "customer_import" }, "/crm/customers?import=1", 'path="/crm/customers"'],
    [{ target: "team_settings" }, "/settings?tab=organization", 'path="/settings"'],
    [{ target: "billing" }, "/settings?tab=account", 'path="/settings"'],
    [{ target: "customer_intelligence" }, "/crm/intelligence", 'path="/crm/intelligence"'],
    [{ target: "customer_intelligence", view: "data" }, "/crm/intelligence?view=data", 'path="/crm/intelligence"'],
    [{ target: "customer_intelligence", view: "nonsense" }, "/crm/intelligence", 'path="/crm/intelligence"'],
    [{ target: "segments" }, "/crm/segments", 'path="/crm/segments"'],
  ])("%o opens a route that exists in App.tsx", async (params, expected, route) => {
    const result = await run(params);
    expect(result.success).toBe(true);
    expect((result.data as { path: string }).path).toBe(expected);
    expect(app).toContain(route);
  });

  it("uses query parameters the pages really read", () => {
    const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
    expect(read("src/pages/crm/CRMCustomersPage.tsx")).toContain('searchParams.get("import") === "1"');
    const settings = read("src/components/settings/SettingsHub.tsx");
    expect(settings).toContain('{ id: "organization", label: "Locations & Team" }');
    expect(settings).toContain('{ id: "account", label: "Account & Billing" }');
    expect(read("src/lib/customer-intelligence/intelligenceExperience.ts")).toMatch(/"overview",\s*"explore",\s*"growth",\s*"rewards",\s*"data"/);
  });

  it("tells Bloom not to invent steps or claim fixes", () => {
    expect(BASE_SYSTEM_PROMPT).toContain("Never invent menu names, buttons or steps");
    expect(BASE_SYSTEM_PROMPT).toContain("Never say something is fixed, working, saved or verified unless a tool result");
    expect(BASE_SYSTEM_PROMPT).toContain("offer to report the problem to the Brands in Blooms team");
  });
});

describe("6. find_customer_opportunities is plain about zero results", () => {
  it("explains why nobody could be scored when momentum is missing", async () => {
    const client = fakeClient({
      customer_purchase_intelligence: [
        { customer_id: "a", purchase_velocity: null, lifetime_value: null },
        { customer_id: "b", purchase_velocity: null, lifetime_value: 10 },
      ],
    });
    const result = await findCustomerOpportunities({}, contextFor(client));
    expect(result.count).toBe(0);
    expect(result.message).toContain("No customer could be scored");
    expect(result.message).not.toContain("Found customers with declining");
  });

  it("covers the other zero and non-zero cases", () => {
    expect(opportunityMessage(0, 0, 0, 25)).toContain("no recorded buying history");
    expect(opportunityMessage(0, 10, 4, 25)).toBe("No customer matched. 6 customers were checked and none slowed by 25% or more. 4 more customers have no buying trend on file, so they could not be checked.");
    expect(opportunityMessage(2, 10, 0, 25)).toContain("Found 2 customers");
    for (const message of [opportunityMessage(0, 0, 0, 25), opportunityMessage(0, 5, 5, 25), opportunityMessage(1, 5, 0, 25)]) {
      expect(message).not.toContain("—");
    }
  });
});

it("routes repeat buyers to scoped purchases and refuses unknown-as-zero answers", () => {
  expect(BASE_SYSTEM_PROMPT).toContain('Do not use spending growth to calculate repeat-buyer retention');
  expect(BASE_SYSTEM_PROMPT).toContain('scope=previous_result');
  expect(BASE_SYSTEM_PROMPT).toContain('never "0 customers bought"');
  expect(BASE_SYSTEM_PROMPT).toContain('status=unavailable has no measured spending or growth result');
});

// Northfield: "haven't bought in over 12 months" said 600 (transaction records
// only) while the "Lapsed (12+ months)" segment said 950, and only one surface
// mentioned the 3,500 customers with no purchase records.
describe("lapsed and recency questions use the Lapsed segment definition", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `c${String(i + 1).padStart(2, "0")}`);
  const lastPurchase = (i: number) => i < 2 ? "2025-06-01" : i < 12 ? "2026-09-01" : i === 12 ? "2025-01-15" : "2026-10-01";
  const customers = ids.map((id, i) => ({ id, first_name: "Synthetic", last_name: id, email: null, created_at: "2024-01-01T00:00:00Z", last_purchase_date: lastPurchase(i) }));
  // Only the first 12 customers have transaction records.
  const facts = ids.slice(0, 12).map((id, i) => ({ id: `line-${id}`, tenant_id: "tenant", customer_id: id, product_code: "P1", product_name: "Plant", sales_category: null, department: null,
    quantity: 1, net_amount: 10, currency: "CAD", purchased_at: `${lastPurchase(i)}T18:00:00Z`, created_at: "2026-10-01T00:00:00Z", source: "pos" }));
  const segments = [
    { id: "lapsed-90", name: "Lapsed Customers", conditions: { logic: "AND", rules: [{ field: "last_purchase_date", operator: "older_than_days", value: 90 }] }, customer_count: 9 },
    // Stored with `op`, exactly as the Northfield segment is.
    { id: "lapsed-365", name: "Lapsed (12+ months)", conditions: { rules: [{ op: "older_than_days", field: "last_purchase_date", value: 365 }] }, customer_count: 3 },
  ];

  async function explore(criteria: JsonObject) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T20:00:00Z"));
    vi.resetModules();
    vi.doMock("../../supabase/functions/_shared/customer-intelligence/bounded-search.ts", () => ({ readLiveCustomerIds: async () => ids, readProductSearchPages: async () => [] }));
    vi.doMock("../../supabase/functions/_shared/customer-intelligence/load-product-search-facts.ts", () => ({ loadProductSearchFacts: async () => null }));
    vi.doMock("../../supabase/functions/_shared/customer-intelligence/load-analysis-facts.ts", () => ({ loadCompanyAnalysisFacts: async () => facts, loadEligibleDatedFacts: async () => facts }));
    try {
      const { exploreCustomerPurchases } = await import("../../supabase/functions/bloom-assist/tools/implementations/customer-exploration");
      const client = fakeClient({ crm_customers: customers, crm_segments: segments, bloom_conversations: [{ id: "conversation" }], bloom_customer_sets: [] });
      const result = await exploreCustomerPurchases({ scope: "all_customers", label: "Lapsed customers", criteria }, contextFor(client));
      return { result, client };
    } finally {
      vi.doUnmock("../../supabase/functions/_shared/customer-intelligence/bounded-search.ts");
      vi.doUnmock("../../supabase/functions/_shared/customer-intelligence/load-product-search-facts.ts");
      vi.doUnmock("../../supabase/functions/_shared/customer-intelligence/load-analysis-facts.ts");
      vi.resetModules();
      vi.useRealTimers();
    }
  }

  it("the segment evaluator reads the `op` operator the Lapsed segment stores", async () => {
    const { evaluateSegmentRule } = await import("../../supabase/functions/_shared/segmentEvaluator");
    const rule = { rules: [{ op: "older_than_days", field: "last_purchase_date", value: 365 }] };
    expect(evaluateSegmentRule(rule, { last_purchase_date: "2020-01-01" })).toBe(true);
    expect(evaluateSegmentRule(rule, { last_purchase_date: new Date().toISOString() })).toBe(false);
  });

  it("recognises open-ended recency rules but not period or product questions", async () => {
    const { recencyRule } = await import("../../supabase/functions/bloom-assist/tools/implementations/customer-exploration");
    expect(recencyRule({ mode: "not_purchased", start_date: "2025-11-26" }, "2026-11-26")).toEqual({ mode: "not_purchased", start_date: "2025-11-26", days: 365 });
    expect(recencyRule({ mode: "not_purchased", start_date: "2025-11-26", end_date: "2026-11-26" }, "2026-11-26")).toMatchObject({ days: 365 });
    expect(recencyRule({ mode: "purchased", start_date: "2026-08-28" }, "2026-11-26")).toEqual({ mode: "purchased", start_date: "2026-08-28", days: 90 });
    expect(recencyRule({ mode: "not_purchased", start_date: "2025-01-01", end_date: "2025-12-31" }, "2026-11-26")).toBeNull();
    // "Bought in 2026" names a calendar period, not "since a date".
    expect(recencyRule({ mode: "purchased", start_date: "2026-01-01", end_date: "2026-12-31" }, "2026-11-26")).toBeNull();
    expect(recencyRule({ mode: "not_purchased", product: "sea soil", start_date: "2025-11-26" }, "2026-11-26")).toBeNull();
    expect(recencyRule({ mode: "not_purchased" }, "2026-11-26")).toBeNull();
  });

  it("leads with the segment's customer-record count, shows the transaction count and puts the coverage note in the tool output", async () => {
    const { result, client } = await explore({ mode: "not_purchased", start_date: "2025-11-26" });
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.recency).toMatchObject({
      days: 365,
      segment: { id: "lapsed-365", name: "Lapsed (12+ months)", stored_count: 3 },
      by_customer_record: { count: 3, label: "Last purchase date on customer records (the same rule as the “Lapsed (12+ months)” segment)" },
      by_transaction_records: { count: 2, customers_with_records: 12, label: "Individual transaction records on file" },
      no_purchase_records: { count: 8, matching_by_customer_record: 1 },
    });
    const coverage = "8 of 20 customers have no purchase records on file, so the transaction-record count cannot include them; 1 of them are lapsed by the date on their customer record.";
    expect(data.coverage_note).toContain(coverage);
    expect(data.coverage_note).toContain("actual report end date");
    // The rendered card shows notes, so every surface sees both numbers and the coverage.
    expect((data.notes as string[]).slice(0, 3)).toEqual([
      "Last purchase date on customer records (the same rule as the “Lapsed (12+ months)” segment): 3.",
      "Individual transaction records on file: 2 of 12 customers with records.",
      coverage,
    ]);
    expect(result.message).toMatch(/^Customers with no purchase since 2025-11-26 \(more than 365 days\): 3 by the last purchase date on customer records/);
    expect(result.message).toContain("Individual transaction records on file show 2 of the 12 customers who have them.");
    expect(result.message).toContain("8 of 20 customers have no purchase records on file");
    // The saved follow-up group is unchanged: the transaction-record matches.
    expect(data.included_count).toBe(2);
    expect(client.calls).toContainEqual({ table: "crm_customers", method: "eq", args: ["tenant_id", "tenant"] });
    expect(client.calls).toContainEqual({ table: "crm_segments", method: "eq", args: ["tenant_id", "tenant"] });
    expect(client.calls).toContainEqual({ table: "crm_segments", method: "is", args: ["deleted_at", null] });
  });

  it("leaves product searches unchanged", async () => {
    const { result, client } = await explore({ mode: "not_purchased", product: "Plant", start_date: "2025-11-26" });
    expect((result.data as Record<string, unknown>).recency).toBeUndefined();
    expect(result.message).toContain("Search succeeded: 2 customers have purchase records and none match.");
    expect(client.calls.some(call => call.table === "crm_segments")).toBe(false);
  });

  it("tells Bloom to lead with the customer-record count and always give the coverage note", () => {
    expect(BASE_SYSTEM_PROMPT).toContain("same last-purchase-date rule as the Lapsed segments");
    expect(BASE_SYSTEM_PROMPT).toContain("Never answer with the transaction-record number alone.");
  });
});

// Actual Nov 11 follow-ups confused a cohort reference with a literal UUID and
// supplied its 810-member count as top_n. Preserve intent without weakening validation.
describe('saved audience argument contracts', () => {
  it.each(['previous_result', 'previous_result_id'])('resolves the explicit %s alias only for latest-result reads', async alias => {
    const {normalizeCustomerExplorationParams} = await import('../../supabase/functions/bloom-assist/tools/customer-exploration-registry');
    expect(normalizeCustomerExplorationParams('inspect_customer_set', {set_id:alias,page:1})).toEqual({page:1});
    expect(normalizeCustomerExplorationParams('analyze_customer_basket', {set_id:alias})).toEqual({});
    expect(normalizeCustomerExplorationParams('explore_customer_reported_spending', {scope:'previous_result',set_id:alias,calendar_year:2025})).toEqual({scope:'previous_result',calendar_year:2025});
    expect(normalizeCustomerExplorationParams('explore_customer_purchases', {scope:'saved_result',set_id:alias})).toEqual({scope:'saved_result',set_id:alias});
    expect(normalizeCustomerExplorationParams('save_customer_set_segment', {set_id:alias})).toEqual({set_id:alias});
  });
  it('never silently substitutes a different group or invents missing criteria', async () => {
    const {normalizeCustomerExplorationParams} = await import('../../supabase/functions/bloom-assist/tools/customer-exploration-registry');
    const id='d7f3b8c4-7f12-4d3f-8a3b-5d3e8e5f9e1a';
    const params={scope:'previous_result',set_id:id,top_n:810,criteria:{start_date:'2026-01-01',end_date:'2026-11-02'}};
    expect(normalizeCustomerExplorationParams('explore_customer_purchases',params)).toEqual(params);
    expect(normalizeCustomerExplorationParams('analyze_customer_basket',{set_id:id})).toEqual({set_id:id});
  });
  it('rejects the malformed original call and accepts the corrected full-cohort call', async () => {
    const {getRegisteredTool} = await import('../../supabase/functions/bloom-assist/tools/registry');
    const {normalizeToolParams,validateToolParams} = await import('../../supabase/functions/bloom-assist/tools/executor');
    const tool=getRegisteredTool('explore_customer_purchases')!;
    const failed=validateToolParams(tool,{scope:'previous_result',label:'Non-shoppers',top_n:810,criteria:{start_date:'2026-01-01',end_date:'2026-11-02'}});
    expect(failed).toMatchObject({ok:false,issues:expect.arrayContaining([expect.objectContaining({path:'$.criteria.mode'}),expect.objectContaining({path:'$.top_n'})])});
    expect(validateToolParams(tool,{scope:'previous_result',label:'Non-shoppers',criteria:{mode:'not_purchased',start_date:'2026-01-01',end_date:'2026-11-02'}})).toMatchObject({ok:true});
    const inspect=getRegisteredTool('inspect_customer_set')!;
    expect(validateToolParams(inspect,normalizeToolParams(inspect,{set_id:'previous_result',page:1}))).toMatchObject({ok:true,value:{page:1}});
    expect(validateToolParams(inspect,{set_id:'not-a-uuid'})).toMatchObject({ok:false,issues:[{path:'$.set_id'}]});
  });
  it('keeps inspection product filters explicit and directs the model to the original purchase step', async () => {
    const {getRegisteredTool} = await import('../../supabase/functions/bloom-assist/tools/registry');
    const {validateToolParams} = await import('../../supabase/functions/bloom-assist/tools/executor');
    const basket=getRegisteredTool('analyze_customer_basket')!;
    expect(validateToolParams(basket,{criteria:{mode:'purchased',product:'wreath',start_date:'2025-01-01',end_date:'2025-12-31'}})).toMatchObject({ok:true});
    expect(validateToolParams(basket,{criteria:{mode:'not_purchased'}})).toMatchObject({ok:false});
    expect(BASE_SYSTEM_PROMPT).toContain('top_n is only for an explicitly requested top-N buyer subset');
    expect(BASE_SYSTEM_PROMPT).toContain('inspect_customer_set with no set_id retrieves the latest result');
  });
});
