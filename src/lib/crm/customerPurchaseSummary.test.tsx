import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  formatCustomerCurrency,
  isNewCustomer,
  resolveCustomerPurchaseSummary,
} from "./customerPurchaseSummary";
import { CustomerListSpendCell } from "@/components/crm/customers/CustomerListPurchaseCells";
import { transformToPurchaseMetrics } from "@/lib/customerDashboardTransformers";
import { buildCustomerFocus } from "@/utils/askBloomContextBuilders";

afterEach(cleanup);

// Northfield customer-2289 (Sarah Tremblay) as stored in production on
// 2026-11-24: the row carries two different value columns and no
// customer_purchase_metrics row, which made the record header say
// "not available" while the list showed $3,700.91.
const northfield2289 = {
  id: "3c2058f8-cb68-481a-b187-9e18d8dcd393",
  first_name: "Sarah",
  last_name: "Tremblay",
  total_spent: "3700.91",
  lifetime_value: "6921.81",
  pos_order_count: 22,
  last_purchase_date: "2026-11-15",
  first_purchase_date: "2025-08-22",
  created_at: "2026-05-06T18:58:48Z",
  custom_fields: {},
};

describe("customer purchase summary: one source of truth", () => {
  it("resolves lifetime value, orders and last purchase from crm_customers", () => {
    const summary = resolveCustomerPurchaseSummary(northfield2289);
    expect(summary.lifetimeValue).toBeCloseTo(3700.91);
    expect(summary.orderCount).toBe(22);
    expect(summary.lastPurchaseDate).toBe("2026-11-15");
    expect(summary.valueSource).toBe("total_spent");
    expect(summary.averageOrderValue).toBeCloseTo(3700.91 / 22);
  });

  it("list, Purchases tab and Bloom show the same lifetime value", () => {
    render(<CustomerListSpendCell customer={northfield2289} />);
    expect(screen.getByText("$3,700.91")).toBeVisible();

    const purchases = transformToPurchaseMetrics(
      null,
      null,
      resolveCustomerPurchaseSummary(northfield2289),
    );
    expect(purchases.ltv).toBeCloseTo(3700.91);
    expect(purchases.totalPurchases).toBe(22);
    expect(purchases.lastPurchaseDate).toBe("2026-11-15");

    // Bloom tool rows carry lifetime_value as a number.
    const bloom = buildCustomerFocus({ ...northfield2289, lifetime_value: 6921.81 }).resourceSummary;
    expect(bloom).toMatch(/Lifetime Value: \$3,?700\.91/);
    expect(bloom).not.toMatch(/6,?921/);
    expect(bloom).toMatch(/Total Orders: 22/);
  });

  it("uses the imported lifetime value only when no spend is recorded", () => {
    const summary = resolveCustomerPurchaseSummary({
      total_spent: 0,
      lifetime_value: 512.4,
    });
    expect(summary.lifetimeValue).toBe(512.4);
    expect(summary.valueSource).toBe("lifetime_value");
  });

  it("keeps a report-period total separate from lifetime value", () => {
    const summary = resolveCustomerPurchaseSummary({
      total_spent: 0,
      custom_fields: {
        ideal_reported_ytd: { start: "2026-01-01", end: "2026-10-14", spend: 2013.85, transactions: 29 },
      },
    });
    expect(summary.lifetimeValue).toBe(0);
    expect(summary.reportedPeriod?.spend).toBe(2013.85);
    expect(summary.valueSource).toBe("reported_period");
  });
});

describe("New badge", () => {
  const now = new Date("2026-11-24T12:00:00Z");

  it("is not shown for a long-standing customer whose record is recent", () => {
    expect(isNewCustomer(northfield2289, now)).toBe(false);
  });

  it("is shown when the first purchase is within 30 days", () => {
    expect(isNewCustomer({ first_purchase_date: "2026-11-10", created_at: "2025-01-01" }, now)).toBe(true);
  });

  it("falls back to creation date when no purchase is on file", () => {
    expect(isNewCustomer({ first_purchase_date: null, created_at: "2026-11-20T00:00:00Z" }, now)).toBe(true);
    expect(isNewCustomer({ first_purchase_date: null, created_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
  });
});

describe("currency format", () => {
  it("formats with grouping and two decimals", () => {
    expect(formatCustomerCurrency(3700.91, "USD", "en-US")).toBe("$3,700.91");
    expect(formatCustomerCurrency(null)).toBe("—");
  });
});
