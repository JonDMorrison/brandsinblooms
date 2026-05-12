import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  if (typeof window.localStorage?.getItem !== "function") {
    const store = new Map<string, string>();
    const localStorageStub: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
      key: (index) => Array.from(store.keys())[index] ?? null,
      removeItem: (key) => {
        store.delete(key);
      },
      setItem: (key, value) => {
        store.set(key, String(value));
      },
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
  }
});

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "owner@example.com",
      user_metadata: { full_name: "Test Owner" },
    },
  }),
}));

vi.mock("@/contexts/OnboardingStatusContext", () => ({
  useOnboardingStatus: () => ({
    isCompleted: true,
    hasEverCompleted: true,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "tenant-1" } }),
}));

vi.mock("@/hooks/useCRMDashboardMetrics", () => ({
  useCRMDashboardMetrics: () => ({
    data: {
      totalCustomers: 0,
      totalCustomersGrowth: 0,
      activeCampaigns: 3,
      activeCampaignsGrowth: 0,
      conversionRate: 0,
      conversionRateGrowth: 0,
      totalRevenue: 0,
      totalRevenueGrowth: 0,
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/usePOSAnalytics", () => ({
  usePOSAnalytics: () => ({
    data: { totalOrders: 0, hasIntegration: false },
    isLoading: false,
  }),
}));

vi.mock("@/components/dashboard/ConnectedAccountChecker", () => ({
  useConnectedAccounts: () => ({ data: [], isLoading: false }),
  getConnectionStatus: () => ({
    status: "disconnected",
    statusMessage: "No accounts connected",
  }),
}));

vi.mock("@/components/dashboard/TwilioSetupChecker", () => ({
  useTwilioSetup: () => ({ data: { isSetup: false }, isLoading: false }),
  getTwilioStatus: () => ({
    status: "disconnected",
    statusMessage: "SMS not set up",
  }),
}));

vi.mock("@/components/dashboard/LaunchpadModal", () => ({
  LaunchpadModal: () => null,
}));

vi.mock("@/components/dashboard/QuickStartTour", () => ({
  QuickStartTour: () => null,
}));

vi.mock("@/components/dashboard/PostComposerModal", () => ({
  PostComposerModal: () => null,
}));

vi.mock("@/components/dashboard/DashboardSetupWizard", () => ({
  DashboardSetupWizard: () => null,
}));

vi.mock("@/components/dashboard/SetupNextStepsBanner", () => ({
  SetupNextStepsBanner: () => null,
}));

vi.mock("@/components/dashboard/POSInsightsCard", () => ({
  POSInsightsCard: () => null,
}));

vi.mock("@/components/create-flow/CreateFlowDialog", () => ({
  CreateFlowDialog: () => null,
}));

import { BloomSuiteDashboard } from "@/pages/BloomSuiteDashboard";

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BloomSuiteDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BloomSuiteDashboard tenant tiles", () => {
  it("renders server-side totals from get_tenant_customer_summary", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        total_customers: 5014,
        active_customers: 4200,
        total_revenue: 23815.67,
        lifetime_revenue: 50000,
        new_customers_30d: 120,
        revenue_30d: 1500.5,
      },
      error: null,
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("5,014")).toBeInTheDocument();
    });
    expect(screen.getByText("$23,815.67")).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith("get_tenant_customer_summary", {
      target_tenant_id: "tenant-1",
    });
  });
});
