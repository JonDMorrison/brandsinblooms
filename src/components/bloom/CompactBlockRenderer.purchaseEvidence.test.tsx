import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CompactBlockRenderer } from "./CompactBlockRenderer";

const report = {
  start: "2026-01-01", end: "2026-10-14", spend: 2013.85, transactions: 29,
  source: "Customer Spending YTD.xls", currency: "CAD", evidence_basis: "reported_period",
};

function mount(overrides: Record<string, unknown> = {}) {
  render(
    <MemoryRouter>
      <CompactBlockRenderer
        blockType="data_card"
        payload={{ entity_type: "customer", entity: {
          id: "customer", name: "Reported Customer", total_spent: "Unknown",
          reported_period_spending: report, ...overrides,
        } }}
        onContinueInBloom={() => true}
      />
    </MemoryRouter>,
  );
}

describe("compact customer purchase evidence", () => {
  it("shows the report amount, period and transaction count", () => {
    mount();
    expect(screen.getByText(/\$2,013\.85 CAD reported \(Jan 1 – Oct 14, 2026\), 29 reported transactions/)).toBeVisible();
    expect(screen.queryByText(/Unknown spent|0 orders|\$0\.00 spent/)).toBeNull();
  });

  it("does not let a legacy default zero contradict the report", () => {
    mount({ total_spent: 0 });
    expect(screen.getByText(/\$2,013\.85 CAD reported/)).toBeVisible();
    expect(screen.queryByText(/0\.00 recorded spending/)).toBeNull();
  });

  it.each([0, -42.5])("preserves an explicit report total of %s", (spend) => {
    mount({ reported_period_spending: { ...report, spend } });
    expect(screen.getByText(spend === 0 ? /\$0\.00 CAD reported/ : /-\$42\.50 CAD reported/)).toBeVisible();
  });

  it("keeps missing history unknown", () => {
    mount({ total_spent: 0, reported_period_spending: null });
    expect(screen.getByText(/Recorded spending unknown/)).toBeVisible();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });

  it("keeps actual receipt totals separate from report-period spending", () => {
    mount({ total_spent: 410.5 });
    expect(screen.getByText(/29 reported transactions · 410\.50 recorded spending/)).toBeVisible();
  });
});
