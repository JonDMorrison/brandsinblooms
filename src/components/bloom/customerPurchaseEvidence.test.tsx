import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DataCardBlock } from "./blocks/DataCardBlock";
import { CustomerResultCard } from "./content/cards/CustomerResultCard";
import { BloomToolResultCard } from "./content/BloomToolResultCard";
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

describe("Bloom customer cards show money in the tenant currency", () => {
  it("formats recorded spending with the row currency", () => {
    render(<CustomerResultCard result={resultFor({ id: "c", name: "Sarah Tremblay", total_spent: "CA$3,700.91", currency: "CAD", reported_period_spending: null })} />);
    expect(screen.getByText(/Recorded spending: CA\$3,700\.91/)).toBeVisible();
  });

  it("keeps an amount plain when no currency is known", () => {
    render(<CustomerResultCard result={resultFor({ id: "c", name: "Old Result", total_spent: "3,700.91", reported_period_spending: null })} />);
    expect(screen.getByText("Recorded spending: 3,700.91")).toBeVisible();
    expect(screen.queryByText(/US\$|USD/)).toBeNull();
  });

  it("shows each top customer's spend from a reported-spending ranking", () => {
    // Shape of a logged rank_customers_by_intelligence output for Northfield.
    const output = {
      success: true,
      count: 2,
      message: "Selected an exact audience from the reconciled spending report.",
      block_type: "data_table",
      data: {
        kind: "customer_exploration",
        criteria: { currency: "CAD", minimum_spend: 0, minimum_transactions: 1 },
        rows: [
          { name: "Hannah Wilson", customer_id: "45f80704-0c0f-4f3c-8816-4fbae24e32d3", reported_period_spend: 4834.73, reported_transactions: 8, currency: "CAD" },
          { name: "Sarah Tremblay", customer_id: "8f7319f9-1160-4404-81a2-95228fb8b2fd", reported_period_spend: 4834.46, reported_transactions: 15 },
        ],
      },
    };
    render(<BloomToolResultCard toolName="rank_customers_by_intelligence" data={output} status="success" />);
    expect(screen.getByText("Reported spending: CA$4,834.73 · 8 reported transactions")).toBeVisible();
    // A row without its own currency uses the result's stated currency.
    expect(screen.getByText("Reported spending: CA$4,834.46 · 15 reported transactions")).toBeVisible();
  });

  it("shows matched spending for purchase searches", () => {
    render(<CustomerResultCard result={{ ...resultFor({ name: "Ann", customer_id: "a", matched_reported_spend: 120.5, currency: "CAD" }), toolName: "explore_customer_purchases" }} />);
    expect(screen.getByText("Matched spending: CA$120.50")).toBeVisible();
  });
});
