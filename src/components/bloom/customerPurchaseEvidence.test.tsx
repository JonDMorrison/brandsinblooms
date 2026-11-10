import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DataCardBlock } from "./blocks/DataCardBlock";
import { CustomerResultCard } from "./content/cards/CustomerResultCard";
import {
  formatCurrencyValue,
  formatNumberValue,
  readNumber as readBlockNumber,
} from "./blocks/blockUtils";
import {
  formatCurrency,
  readNumber as readCardNumber,
  type NormalizedToolResult,
} from "./content/cards/cardUtils";

vi.mock("@/hooks/bloom/useBloomProfile", () => ({
  useBloomProfile: () => ({ data: null }),
}));
vi.mock("@/hooks/bloom/useBloomProfileMutations", () => ({
  useBloomProfileMutations: () => ({
    isPinningEntity: false,
    isUnpinningEntity: false,
    pinEntity: vi.fn(),
    unpinEntity: vi.fn(),
  }),
}));

afterEach(cleanup);

const report = {
  start: "2026-01-01",
  end: "2026-10-14",
  spend: 2013.85,
  transactions: 29,
  currency: "CAD",
  evidence_basis: "reported_period",
  source: "Customer Spending YTD.xls",
};
const customer = {
  id: "reported-customer",
  name: "Reported Customer",
  total_spent: "Unknown",
  last_purchase_date: null,
  purchase_metrics: { total_spent: null, lifetime_value: null, order_count: null },
  reported_period_spending: report,
};

function resultFor(row: Record<string, unknown>): NormalizedToolResult {
  return {
    toolName: "query_customers",
    blockType: "customer_list",
    status: "success",
    data: [row],
    count: 1,
    message: null,
    error: null,
    raw: null,
  };
}

describe("Bloom purchase evidence rendering", () => {
  it("does not assume a currency when the source did not provide one", () => {
    expect(formatCurrencyValue(410.5)).toBe("410.50");
    expect(formatCurrency(410.5)).toBe("410.50");
    expect(formatCurrencyValue("CA$410.50")).toBe("CA$410.50");
    expect(formatCurrency("CA$410.50")).toBe("CA$410.50");
    expect(formatCurrencyValue(410.5, "CAD")).toBe("CA$410.50");
  });
  it.each([null, undefined, "", " ", "Unknown", "Not available", "$"])(
    "does not convert unavailable text into numeric zero (%s)",
    (value) => {
      expect(readBlockNumber(value)).toBeNull();
      expect(readCardNumber(value)).toBeNull();
      expect(formatCurrency(value)).toBeNull();
      expect(formatCurrencyValue(value)).not.toContain("0.00");
      expect(formatNumberValue(value)).not.toBe("0");
    },
  );

  it.each([[0, 0], ["0.00", 0], ["CA$2,013.85", 2013.85], ["-$42.50", -42.5]])(
    "keeps valid amounts, including zero and returns (%s)",
    (value, expected) => {
      expect(readBlockNumber(value)).toBe(expected);
      expect(readCardNumber(value)).toBe(expected);
    },
  );

  it("shows report amount, period and transactions on customer search results", () => {
    render(<CustomerResultCard result={resultFor(customer)} />);
    expect(screen.getByText(/Reported spending: \$2,013\.85 CAD/)).toBeVisible();
    expect(screen.getByText(/Jan 1 – Oct 14, 2026/)).toBeVisible();
    expect(screen.getByText(/29 reported transactions/)).toBeVisible();
    expect(screen.queryByText(/(?:Total spent|Recorded spending): \$0/)).toBeNull();
  });

  it("shows report evidence on the detailed customer card without inventing orders", () => {
    render(<DataCardBlock entityType="customer" entity={customer} actions={[]} onAction={vi.fn()} />);
    expect(screen.getByText("$2,013.85 CAD reported")).toBeVisible();
    expect(screen.getByText("Jan 1 – Oct 14, 2026")).toBeVisible();
    expect(screen.getByText("29 reported transactions")).toBeVisible();
    expect(screen.queryByText(/0 (?:recorded )?orders/)).toBeNull();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });

  it.each([0, -42.5])("preserves explicit report zero or return (%s)", (spend) => {
    render(<DataCardBlock entityType="customer" entity={{ ...customer, reported_period_spending: { ...report, spend } }} actions={[]} onAction={vi.fn()} />);
    expect(screen.getByText(spend === 0 ? "$0.00 CAD reported" : "-$42.50 CAD reported")).toBeVisible();
    expect(screen.getByText("29 reported transactions")).toBeVisible();
  });

  it("keeps unknown history unknown when neither receipt nor report data exists", () => {
    render(<DataCardBlock entityType="customer" entity={{ ...customer, reported_period_spending: null }} actions={[]} onAction={vi.fn()} />);
    expect(screen.getByText("Unknown recorded spending")).toBeVisible();
    expect(screen.getByText("Order history unknown")).toBeVisible();
    expect(screen.queryByText(/\$0\.00|0 orders/)).toBeNull();
  });

  it("keeps dated amounts separate when report evidence also exists", () => {
    render(<DataCardBlock entityType="customer" entity={{ ...customer, total_spent: 410.5, currency: "CAD", purchase_metrics: { order_count: 3 } }} actions={[]} onAction={vi.fn()} />);
    expect(screen.getByText("CA$410.50 recorded spending")).toBeVisible();
    expect(screen.getByText(/\$2,013\.85 CAD reported · Jan 1/)).toBeVisible();
    expect(screen.getByText("3 recorded orders")).toBeVisible();
  });
});
