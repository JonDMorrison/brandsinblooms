import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CustomerGrowthWorkspace } from "./CustomerGrowthWorkspace";

const mocks = vi.hoisted(() => ({ pages: vi.fn() }));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenant: {
      id: "synthetic-tenant",
      settings: { timezone: "America/Vancouver" },
    },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock(
  "../../../../supabase/functions/_shared/customer-intelligence/query-pages",
  () => ({ readAllPages: mocks.pages }),
);
vi.mock("./LoyaltyProgrammeWorkspace", () => ({
  LoyaltyProgrammeWorkspace: () => <div>Existing rewards module</div>,
}));
vi.mock("./IdealCustomerTypeExportPanel", () => ({
  IdealCustomerTypeExportPanel: () => <div>Existing Ideal module</div>,
}));

function BloomRoute() {
  const location = useLocation();
  return (
    <div data-testid="bloom-route">{location.pathname + location.search}</div>
  );
}
function mount(section: "explore" | "growth" | "all") {
  render(
    <MemoryRouter initialEntries={["/crm/intelligence"]}>
      <Routes>
        <Route
          path="/crm/intelligence"
          element={<CustomerGrowthWorkspace section={section} />}
        />
        <Route path="/bloom" element={<BloomRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("Customer Intelligence workbenches", () => {
  it("explore stays focused and hands a precise product query to Bloom", () => {
    mount("explore");
    expect(
      screen.getByText("Start with something a customer bought"),
    ).toBeVisible();
    expect(screen.queryByText("Customer Growth Index")).not.toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Product to explore" }),
      { target: { value: "Hydrangea 'Annabelle'" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Find buyers with Bloom/ }),
    );
    const url = new URL(
      screen.getByTestId("bloom-route").textContent || "",
      "https://test.invalid",
    );
    expect(url.searchParams.get("origin")).toBe("intelligence");
    expect(url.searchParams.get("returnView")).toBe("explore");
    expect(url.searchParams.get("prompt")).toContain("Hydrangea");
    expect(url.searchParams.get("prompt")).toContain("excluded");
  });
  it("growth calculates on demand and makes comparable/unscored denominators obvious", async () => {
    const baseline = "2025-10-07T16:00:00Z",
      current = "2026-10-07T16:00:00Z";
    mocks.pages
      .mockResolvedValueOnce([{ id: "customer-a" }])
      .mockResolvedValueOnce([
        {
          id: "order-a",
          tenant_id: "synthetic-tenant",
          crm_customer_id: "customer-a",
          order_date: baseline,
          created_at: "2025-10-08T16:00:00Z",
          total_amount: "100.00",
          refund_amount: null,
          currency: "CAD",
          status: "completed",
        },
        {
          id: "order-b",
          tenant_id: "synthetic-tenant",
          crm_customer_id: "customer-a",
          order_date: current,
          created_at: "2026-10-08T16:00:00Z",
          total_amount: "150.00",
          refund_amount: null,
          currency: "CAD",
          status: "completed",
        },
      ]);
    mount("growth");
    expect(screen.getByText("Customer Growth Index")).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: "Product to explore" }),
    ).not.toBeInTheDocument();
    expect(mocks.pages).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Compare customer growth" }),
    );
    expect(await screen.findByText("Your comparison")).toBeVisible();
    expect(screen.getByText("Average customer growth")).toBeVisible();
    expect(screen.getByText("Comparable customers")).toBeVisible();
    expect(screen.getByText("Missing a comparison")).toBeVisible();
    expect(mocks.pages).toHaveBeenCalledTimes(2);
    fireEvent.click(
      screen.getByRole("button", { name: /Investigate results with Bloom/ }),
    );
    expect(screen.getByTestId("bloom-route")).toHaveTextContent(
      "returnView=growth",
    );
  });
  it("the legacy all mode still exposes loyalty and Ideal export modules", () => {
    mount("all");
    expect(screen.getByText("Existing rewards module")).toBeVisible();
    expect(screen.getByText("Existing Ideal module")).toBeVisible();
  });
});
