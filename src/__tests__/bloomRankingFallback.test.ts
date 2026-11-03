import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";

const mocks = vi.hoisted(() => ({
  reported: vi.fn(),
  purchases: vi.fn(),
  rows: [] as Record<string, unknown>[],
}));

vi.mock("../../supabase/functions/bloom-assist/tools/implementations/customer-exploration.ts", () => {
  const client = {
    from: () => {
      const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: mocks.rows, error: null }) };
      return q;
    },
  };
  return {
    analysisResult: (data: unknown, count: number, message: string) => ({ success: true, data, count, message, error: null, block_type: "data_table", confirmation_required: false, confirmation_details: null }),
    requireAnalysisAccess: async () => client,
    loadAnalysisPopulation: async () => ["a", "b"],
    loadCustomerSet: async () => { throw new Error("not used"); },
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
  });

  it("ranks top customers by the spending report instead of returning nobody", async () => {
    mocks.reported.mockResolvedValue(ok("Selected an exact audience from the reconciled spending report."));
    const result = await rankCustomersByIntelligence({}, context);
    expect(mocks.reported).toHaveBeenCalledWith(expect.objectContaining({ scope: "all_customers", currency: "CAD" }), context);
    expect(result.count).toBe(1);
    expect(result.message).toContain("Ordered by reported spending");
    expect(result.data).toMatchObject({ ranking_basis: "reported_period_spend" });
  });

  it("ranks a department by reported department spending", async () => {
    mocks.purchases.mockResolvedValue(ok("Search succeeded: 6,648 customers bought it."));
    const result = await rankCustomersByIntelligence({ dimension: "department", dimension_value: "Tropical" }, context);
    expect(mocks.purchases).toHaveBeenCalledWith(expect.objectContaining({ criteria: { mode: "purchased", department: "Tropical" } }), context);
    expect(result.data).toMatchObject({ ranking_basis: "reported_department_spend" });
  });

  it("shows the empty ranking with its reasons when there is no spending report either", async () => {
    mocks.reported.mockRejectedValue(new Error("There is no reconciled customer spending report available."));
    const result = await rankCustomersByIntelligence({}, context);
    expect(result.data).toMatchObject({ kind: "customer_ranking", eligible_customers: 0, unranked_count: 2 });
  });

  it("does not hide other failures", async () => {
    mocks.reported.mockRejectedValue(new Error("canceling statement due to statement timeout"));
    await expect(rankCustomersByIntelligence({}, context)).rejects.toThrow("timeout");
  });
});
