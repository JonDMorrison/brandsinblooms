import "@testing-library/jest-dom/vitest";
import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomerIntelligencePage from "./CustomerIntelligencePage";

const mocks = vi.hoisted(() => ({
  source: vi.fn(),
  selected: {
    id: "synthetic-tenant",
    settings: { timezone: "America/Vancouver" },
  } as { id: string; settings: { timezone: string } } | null,
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: mocks.selected }),
}));
vi.mock("@/lib/customer-intelligence/intelligenceHome", () => ({
  loadIntelligenceHome: mocks.source,
}));
vi.mock("@/components/joy/PageContainer", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock(
  "@/components/crm/customer-intelligence/CustomerGrowthWorkspace",
  () => ({
    CustomerGrowthWorkspace: ({ section }: { section: string }) => (
      <div data-testid={"workspace-" + section}>
        Customer workbench: {section}
      </div>
    ),
  }),
);
vi.mock(
  "@/components/crm/customer-intelligence/LoyaltyProgrammeWorkspace",
  () => ({
    LoyaltyProgrammeWorkspace: () => (
      <div data-testid="reward-workspace">
        Reward programme editor and measurements
      </div>
    ),
  }),
);
vi.mock(
  "@/components/crm/customer-intelligence/IdealCustomerTypeExportPanel",
  () => ({
    IdealCustomerTypeExportPanel: () => (
      <div data-testid="ideal-export">Reviewed Ideal Customer Type export</div>
    ),
  }),
);
vi.mock("@/components/crm/customer-intelligence/PushReadinessPanel", () => ({
  PushReadinessPanel: () => (
    <div data-testid="push-readiness">Channel readiness</div>
  ),
}));
vi.mock("@/components/crm/customer-intelligence/PushPilotPanel", () => ({
  PushPilotPanel: () => (
    <div data-testid="push-advanced">Advanced push controls</div>
  ),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      throw Error("The source loader is mocked in these tests.");
    }),
  },
}));
const example = [
  {
    customer_id: "test-customer-a",
    first_name: "Sample",
    last_name: "Customer",
    email: null,
    lifetime_value: 400,
    purchase_velocity: -14,
    days_since_last_purchase: 155,
    customer_tier: "vip",
    top_product_categories: ["Perennials", "Pottery"],
    total_quantity: 6,
    departments_shopped: 2,
    categories_shopped: 2,
  },
  {
    customer_id: "test-customer-b",
    first_name: "Another",
    last_name: "Customer",
    email: null,
    lifetime_value: null,
    purchase_velocity: null,
    days_since_last_purchase: null,
    customer_tier: null,
    top_product_categories: ["Perennials"],
    total_quantity: null,
    departments_shopped: null,
    categories_shopped: null,
  },
];
function LocationEcho() {
  const location = useLocation();
  return (
    <>
      <h1>Bloom conversation</h1>
      <pre data-testid="target-url">{location.pathname + location.search}</pre>
    </>
  );
}
function mount(path = "/crm/intelligence") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/crm/intelligence"
            element={<CustomerIntelligencePage />}
          />
          <Route path="/bloom" element={<LocationEcho />} />
          <Route path="/crm/segments" element={<div>Segment builder</div>} />
          <Route path="/crm/pos" element={<div>POS integration hub</div>} />
          <Route
            path="/crm/customers/:id"
            element={<div>Customer purchase history</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.selected = {
    id: "synthetic-tenant",
    settings: { timezone: "America/Vancouver" },
  };
  mocks.source.mockResolvedValue(example);
});
afterEach(cleanup);

describe("the redesigned Intelligence journey", () => {
  it("does not offer Bloom actions or invent customer metrics without a selected company", () => {
    mocks.selected = null;
    mount();
    expect(
      screen.getByText(/Select a company to load customer intelligence/),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Ask Bloom about your customers" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Continue in Bloom/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Find my best opportunities/ }),
    ).toBeDisabled();
    expect(mocks.source).not.toHaveBeenCalled();
  });
  it("shows a clear home with three goals and only the overview content initially", async () => {
    mount();
    expect(
      screen.getByRole("heading", {
        name: /Know your customers. Know what to do next/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Intelligence sections" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Find the right customers/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /See what is changing/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Give them a reason to return/ }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("reward-workspace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ideal-export")).not.toBeInTheDocument();
    expect(
      await screen.findByText("A snapshot of your customer records"),
    ).toBeVisible();
    await screen.findByText("120+ day purchase gaps");
    expect(
      screen.getByText(/not proof that these customers are lapsed/),
    ).toBeInTheDocument();
  });

  it("preserves every feature behind exactly one intentional section", async () => {
    mount();
    const navigation = screen.getByRole("navigation", {
      name: "Intelligence sections",
    });
    fireEvent.click(
      within(navigation).getByRole("button", { name: /Find customers/ }),
    );
    expect(await screen.findByTestId("workspace-explore")).toBeVisible();
    expect(screen.queryByTestId("reward-workspace")).not.toBeInTheDocument();
    fireEvent.click(
      within(navigation).getByRole("button", { name: /^Growth/ }),
    );
    expect(screen.getByTestId("workspace-growth")).toBeVisible();
    fireEvent.click(
      within(navigation).getByRole("button", { name: /^Rewards/ }),
    );
    expect(screen.getByTestId("reward-workspace")).toBeVisible();
    fireEvent.click(
      within(navigation).getByRole("button", { name: /^Data & channels/ }),
    );
    expect(screen.getByTestId("ideal-export")).toBeVisible();
    expect(screen.getByTestId("push-readiness")).toBeVisible();
    expect(screen.queryByTestId("push-advanced")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Show advanced channel setup/ }),
    );
    expect(screen.getByTestId("push-advanced")).toBeVisible();
  });

  it("opens Bloom with a prefilled verified question and a safe return view", async () => {
    mount("/crm/intelligence?view=explore");
    const navigation = screen.getByRole("navigation", {
      name: "Intelligence sections",
    });
    expect(
      within(navigation).getByRole("button", { name: /Find customers/ }),
    ).toHaveAttribute("aria-current", "page");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Ask Bloom about your customers" }),
      {
        target: { value: "Find people who bought a hydrangea" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /Continue in Bloom/ }));
    expect(
      await screen.findByRole("heading", { name: "Bloom conversation" }),
    ).toBeVisible();
    const target = new URL(
      screen.getByTestId("target-url").textContent || "",
      "https://test.example",
    );
    expect(target.pathname).toBe("/bloom");
    expect(target.searchParams.get("origin")).toBe("intelligence");
    expect(target.searchParams.get("returnView")).toBe("explore");
    expect(target.searchParams.get("prompt")).toContain(
      "Find people who bought a hydrangea",
    );
    expect(target.searchParams.get("prompt")).toContain("Do not send");
  });

  it("does not pre-load the expensive overview or unrelated features on the Data tab", async () => {
    mount("/crm/intelligence?view=data");
    expect(screen.getByTestId("ideal-export")).toBeVisible();
    expect(mocks.source).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reward-workspace")).not.toBeInTheDocument();
  });

  it("keeps navigation and Bloom working if the overview fetch fails", async () => {
    mocks.source.mockRejectedValue(new Error("Data unavailable."));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load");
    fireEvent.click(
      screen.getByRole("button", { name: /Find my best opportunities/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Bloom conversation" }),
    ).toBeVisible();
  });

  it("opens the actual customer profile rather than only a generic audience", async () => {
    mount();
    const link = await screen.findByRole("button", { name: /Sample Customer/ });
    fireEvent.click(link);
    expect(await screen.findByText("Customer purchase history")).toBeVisible();
  });
});
