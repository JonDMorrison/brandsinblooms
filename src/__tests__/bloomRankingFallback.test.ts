import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";

const mocks = vi.hoisted(() => ({
  reported: vi.fn(),
  purchases: vi.fn(),
  rows: [] as Record<string, unknown>[],
  metricsWithValue: [] as Record<string, unknown>[],
  viewReads: 0,
  savedIds: null as string[] | null,
  population: vi.fn(),
  filters: [] as {table:string;column:string;ids:string[]}[],
}));

vi.mock("../../supabase/functions/bloom-assist/tools/implementations/customer-exploration.ts", () => {
  const client = {
    from: (table: string) => {
      let requested:string[]|undefined;
      const q = {
        select: () => q, eq: () => q, order: () => q, not: () => q,
        in: (column:string,ids:string[]) => {requested=ids;mocks.filters.push({table,column,ids});return q;},
        limit: async () => ({ data: table === "customer_purchase_metrics" ? mocks.metricsWithValue : [], error: null }),
        range: async () => { mocks.viewReads += 1; return { data: mocks.rows.filter(row=>!requested||requested.includes(String(row.customer_id))), error: null }; },
      };
      return q;
    },
  };
  return {
    analysisResult: (data: unknown, count: number, message: string) => ({ success: true, data, count, message, error: null, block_type: "data_table", confirmation_required: false, confirmation_details: null }),
    requireAnalysisAccess: async () => client,
    loadAnalysisPopulation: mocks.population,
    loadCustomerSet: async () => ({id:"saved",included_ids:mocks.savedIds??[]}),
    exploreCustomerReportedSpending: mocks.reported,
    exploreCustomerPurchases: mocks.purchases,
  };
});

import { rankCustomersByIntelligence } from "../../supabase/functions/bloom-assist/tools/implementations/customer-intelligence";

const context = { tenantId: "t", userId: "u", conversationId: "c" } as unknown as ToolExecutionContext;
// Imported period reports fill no receipt metrics, so every customer is unranked.
const reportOnly = ["a", "b"].map((customer_id) => ({ customer_id, lifetime_value: null, purchase_frequency: null, days_since_last_purchase: null, purchase_velocity: null, total_quantity: null, departments_shopped: null, category_spend: null, department_spend: null }));
const ok = (message: string) => ({ success: true, data: { kind: "customer_exploration", rows: [{ customer_id: "a" }] }, count: 1, message, error: null, block_type: "data_table", confirmation_required: false, confirmation_details: null });

describe("ranking when a company only has imported sales reports", () => {
  beforeEach(() => {
    mocks.reported.mockReset();
    mocks.purchases.mockReset();
    mocks.rows = reportOnly;
    mocks.metricsWithValue = [];
    mocks.viewReads = 0;
    mocks.savedIds=null;mocks.filters=[];
    mocks.population.mockReset();
    mocks.population.mockImplementation(async (_context:unknown,_cutoff:unknown,ids?:string[])=>ids??["a","b"]);
  });

  it("does not read every customer's metrics when no customer has a lifetime value", async () => {
    mocks.reported.mockResolvedValue(ok("Selected an exact audience from the reconciled spending report."));
    await rankCustomersByIntelligence({}, context);
    expect(mocks.viewReads).toBe(0);
  });

  it("still reads and ranks receipt metrics when they exist", async () => {
    mocks.metricsWithValue = [{ customer_id: "a" }];
    mocks.rows = ["a", "b"].map((customer_id, i) => ({ ...reportOnly[i], lifetime_value: 100 * (i + 1), purchase_frequency: 1, total_quantity: 1, departments_shopped: 1 }));
    const result = await rankCustomersByIntelligence({}, context);
    expect(mocks.viewReads).toBeGreaterThan(0);
    expect(mocks.reported).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ kind: "customer_ranking", eligible_customers: 2 });
  });

  it("ranks top customers by the spending report instead of returning nobody", async () => {
    mocks.reported.mockResolvedValue(ok("Selected an exact audience from the reconciled spending report."));
    const result = await rankCustomersByIntelligence({}, context);
    expect(mocks.reported).toHaveBeenCalledWith(expect.objectContaining({ scope: "all_customers", currency: "CAD" }), context, undefined);
    expect(result.count).toBe(1);
    expect(result.message).toContain("Ordered by reported spending");
    expect(result.data).toMatchObject({ ranking_basis: "reported_period_spend" });
  });

  it("ranks a department by reported department spending", async () => {
    mocks.purchases.mockResolvedValue(ok("Search succeeded: 6,648 customers bought it."));
    const result = await rankCustomersByIntelligence({ dimension: "department", dimension_value: "Tropical" }, context);
    expect(mocks.purchases).toHaveBeenCalledWith(expect.objectContaining({ criteria: { mode: "purchased", department: "Tropical" } }), context, undefined);
    expect(result.data).toMatchObject({ ranking_basis: "reported_department_spend" });
  });

  it("shows the empty ranking with its reasons when there is no spending report either", async () => {
    mocks.reported.mockRejectedValue(new Error("There is no reconciled customer spending report available."));
    const result = await rankCustomersByIntelligence({}, context);
    expect(result.data).toMatchObject({ kind: "customer_ranking", eligible_customers: 0, unranked_count: 2 });
  });

  it("bounds saved-cohort metric reads and reports absent metrics without silently dropping a member",async()=>{
    mocks.savedIds=["a","b"];
    mocks.rows=[{...reportOnly[0],lifetime_value:100}];
    const result=await rankCustomersByIntelligence({scope:"previous_result",weights:{value:100}},context);
    expect(mocks.population).toHaveBeenCalledWith(context,expect.any(String),["a","b"]);
    expect(mocks.filters).toContainEqual({table:"customer_purchase_intelligence",column:"customer_id",ids:["a","b"]});
    expect(result.data).toMatchObject({set_id:"saved",scanned_customers:2,eligible_customers:1,unranked_count:1});
    expect(mocks.reported).not.toHaveBeenCalled();
  });

  it("pins the resolved saved set and requests read-only fallback instead of selecting a new top-N group",async()=>{
    mocks.savedIds=["a","b"];mocks.reported.mockResolvedValue(ok("Ranked saved group"));
    await rankCustomersByIntelligence({scope:"previous_result",limit:1},context);
    expect(mocks.reported).toHaveBeenCalledWith(expect.objectContaining({scope:"saved_result",set_id:"saved"}),context,{limit:1});
    expect(mocks.reported.mock.calls[0][0]).not.toHaveProperty("top_n");
    expect(mocks.filters).toContainEqual({table:"customer_purchase_metrics",column:"customer_id",ids:["a","b"]});
  });

  it("does not replace explicit weights with spending fallback",async()=>{
    const result=await rankCustomersByIntelligence({weights:{trend:100}},context);
    expect(result.data).toMatchObject({eligible_customers:0,unranked_count:2});
    expect(mocks.reported).not.toHaveBeenCalled();expect(mocks.purchases).not.toHaveBeenCalled();
  });

  it("does not reinterpret category ranking as department ranking",async()=>{
    mocks.savedIds=["a"];mocks.purchases.mockResolvedValue(ok("Ranked saved group"));
    await rankCustomersByIntelligence({scope:"previous_result",dimension:"category",dimension_value:"Pottery"},context);
    expect(mocks.purchases).toHaveBeenCalledWith(expect.objectContaining({criteria:{mode:"purchased",category:"Pottery"}}),context,{limit:100});
  });

  it("returns an empty saved cohort without reading metrics or creating a fallback audience",async()=>{
    mocks.savedIds=[];
    const result=await rankCustomersByIntelligence({scope:"previous_result"},context);
    expect(result.data).toMatchObject({set_id:"saved",scanned_customers:0,eligible_customers:0});
    expect(mocks.viewReads).toBe(0);expect(mocks.reported).not.toHaveBeenCalled();expect(mocks.purchases).not.toHaveBeenCalled();
  });

  it("does not hide other failures", async () => {
    mocks.reported.mockRejectedValue(new Error("canceling statement due to statement timeout"));
    await expect(rankCustomersByIntelligence({}, context)).rejects.toThrow("timeout");
  });
});
