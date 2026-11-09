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

import { CustomerGrowthDashboardBody } from "./CustomerGrowthDashboard";
vi.mock("@/contexts/AdminContext", () => ({ useAdmin: () => ({isLoading:false,isMasterAdmin:false}) }));

const mocks = vi.hoisted(() => ({ pages: vi.fn(), permission: vi.fn() }));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenant: {
      id: "synthetic-tenant",
      settings: { timezone: "America/Vancouver" },
    },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.permission } }));
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
beforeEach(() => { vi.clearAllMocks(); mocks.permission.mockResolvedValue({data:true,error:null}); });
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
      .mockResolvedValueOnce([{ id: "customer-a", first_name: "Alex", last_name: "Gardener" }])
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
    expect(screen.getByText("Alex Gardener")).toBeVisible();
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

vi.mock("./ReportedPurchaseWorkspace", () => ({ReportedPurchaseWorkspace: () => <div>Reported source comparisons</div>}));


describe("Customer growth dashboard safety and interaction", () => {
  it("loads on demand, displays unknown rather than fabricated cohort totals, and clears stale results", async () => {
    mocks.pages.mockResolvedValueOnce([{id:"customer-a",tenant_id:"synthetic-tenant"}]).mockResolvedValueOnce([]);
    render(<CustomerGrowthDashboardBody tenantId="synthetic-tenant" timezone="UTC" />);
    expect(mocks.pages).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name:"Load customer growth dashboard"}));
    expect(await screen.findByText(/Observed previous-year buyers:/)).toBeInTheDocument();
    expect(screen.getByText(/Coverage is unverified/)).toBeVisible();
    expect(mocks.permission).toHaveBeenCalledWith("has_tenant_permission", {p_tenant_id:"synthetic-tenant",p_permission:"reporting.read",p_location_id:null});
    expect(screen.getAllByText("Not established").length).toBeGreaterThan(5);
    fireEvent.change(screen.getByRole("spinbutton", {name:"Reporting year"}), {target:{value:"2024"}});
    expect(screen.queryByText(/Observed previous-year buyers:/)).not.toBeInTheDocument();
  });
  it("requires written source evidence for a human coverage assertion", () => {
    render(<CustomerGrowthDashboardBody tenantId="synthetic-tenant" timezone="UTC" />);
    fireEvent.click(screen.getByRole("checkbox", {name:/I reviewed complete/}));
    expect(screen.getByRole("button", {name:"Load customer growth dashboard"})).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", {name:"Period coverage evidence"}), {target:{value:"Synthetic annual source reconciled"}});
    expect(screen.getByRole("button", {name:"Load customer growth dashboard"})).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", {name:/I also reviewed/}));
    expect(screen.getByRole("button", {name:"Load customer growth dashboard"})).toBeDisabled();
  });
  it("does not read customer records when company-wide reporting permission is denied", async () => {
    mocks.permission.mockResolvedValue({data:false,error:null});
    render(<CustomerGrowthDashboardBody tenantId="synthetic-tenant" timezone="UTC" />);
    fireEvent.click(screen.getByRole("button", {name:"Load customer growth dashboard"}));
    expect(await screen.findByText("Customer growth requires company-wide customer and reporting access.")).toBeVisible();
    expect(mocks.pages).not.toHaveBeenCalled();
  });
  it("discards an in-flight report after the selected year changes", async () => {
    let finish: (orders: never[]) => void = () => {};
    mocks.pages.mockResolvedValueOnce([{id:"customer-a",tenant_id:"synthetic-tenant"}]).mockReturnValueOnce(new Promise<never[]>(resolve => { finish = resolve; }));
    render(<CustomerGrowthDashboardBody tenantId="synthetic-tenant" timezone="UTC" />);
    fireEvent.click(screen.getByRole("button", {name:"Load customer growth dashboard"}));
    await waitFor(() => expect(mocks.pages).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByRole("spinbutton", {name:"Reporting year"}), {target:{value:"2023"}});
    finish([]);
    await waitFor(() => expect(screen.getByRole("button", {name:"Load customer growth dashboard"})).toBeEnabled());
    expect(screen.queryByText(/Observed previous-year buyers:/)).not.toBeInTheDocument();
  });
  it("labels a partial current year as progress rather than like-for-like annual growth", () => {
    render(<CustomerGrowthDashboardBody tenantId="synthetic-tenant" timezone="UTC" />);
    fireEvent.change(screen.getByRole("spinbutton", {name:"Reporting year"}), {target:{value:String(new Date().getUTCFullYear())}});
    expect(screen.getByText(/Year-to-date progress against the full previous year/)).toBeVisible();
  });
});
