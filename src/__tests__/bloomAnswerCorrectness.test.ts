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
        "order", "limit", "range", "ilike",
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
