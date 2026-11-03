import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BloomPageContext } from "./types";
import { useBloomEntitySummary } from "./useBloomEntitySummary";

const mocks = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select: (columns: string) => { mocks.select(columns); return query; },
        eq: (key: string, value: string) => { mocks.eq(key, value); return query; },
        is: (key: string, value: null) => { mocks.is(key, value); return query; },
        maybeSingle: async () => ({ data: mocks.row, error: null }),
      };
      return query;
    },
  },
}));

const report = {
  start: "2026-01-01",
  end: "2026-10-14",
  spend: 2013.85,
  transactions: 29,
  source: "Customer Spending YTD.xls",
};
const pageContext = {
  entityType: "customer",
  entityId: "customer",
  pageTitle: "Customer",
  route: "/crm/customers/customer",
} as BloomPageContext;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.row = {
    id: "customer", tenant_id: "tenant", first_name: "Reported", last_name: "Customer",
    email: null, deleted_at: null, total_spent: 0, pos_order_count: 0,
    first_purchase_date: null, last_purchase_date: null,
    custom_fields: { ideal_reported_ytd: report },
  };
});

async function summary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useBloomEntitySummary(pageContext, "tenant"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result.current.data!;
}

describe("Bloom customer header purchase evidence", () => {
  it("loads tenant-scoped reported evidence and never repeats the receipt-only zero", async () => {
    const result = await summary();
    expect(mocks.select).toHaveBeenCalledWith(expect.stringContaining("custom_fields"));
    expect(mocks.eq).toHaveBeenCalledWith("tenant_id", "tenant");
    expect(mocks.eq).toHaveBeenCalledWith("id", "customer");
    expect(mocks.is).toHaveBeenCalledWith("deleted_at", null);
    expect(result.summaryText).toContain("$2,013.85 CAD reported spending (Jan 1 – Oct 14, 2026)");
    expect(result.summaryText).toContain("29 reported transactions");
    expect(result.summaryText).not.toMatch(/0 (?:orders|total spent)|\$0/);
    expect(result.detailItems).toContainEqual({ label: "Recorded spending", value: "Unknown" });
    expect(result.detailItems).toContainEqual({ label: "Report period", value: "Jan 1 – Oct 14, 2026" });
  });

  it.each([0, -42.5])("preserves an explicit report total of %s", async (spend) => {
    mocks.row.custom_fields = { ideal_reported_ytd: { ...report, spend, transactions: 0 } };
    const result = await summary();
    expect(result.detailItems).toContainEqual({ label: "Reported spending", value: spend === 0 ? "$0.00 CAD" : "-$42.50 CAD" });
    expect(result.detailItems).toContainEqual({ label: "Reported transactions", value: "0" });
  });

  it("keeps absent receipt and report data unknown", async () => {
    mocks.row.custom_fields = {};
    const result = await summary();
    expect(result.summaryText).toBe("Recorded spending unknown");
    expect(result.detailItems).toContainEqual({ label: "Recorded spending", value: "Unknown" });
    expect(result.detailItems?.some(item => item.label === "Reported spending")).toBe(false);
  });

  it("shows recorded and reported amounts separately", async () => {
    mocks.row.total_spent = 410.5;
    mocks.row.pos_order_count = 3;
    const result = await summary();
    expect(result.summaryText).toContain("410.50 recorded spending");
    expect(result.summaryText).toContain("$2,013.85 CAD reported spending");
    expect(result.summaryText).not.toContain("lifetime");
  });

  it("preserves recorded net zero when dated receipt evidence exists", async () => {
    mocks.row.custom_fields = {};
    mocks.row.last_purchase_date = "2026-09-03T12:00:00Z";
    const result = await summary();
    expect(result.detailItems).toContainEqual({ label: "Recorded spending", value: "0.00" });
  });
});
