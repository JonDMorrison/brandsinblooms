import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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

// Production resolves permissions through the AdminProvider; the dashboard
// unit test explicitly supplies owner access so it can isolate KPI rendering.
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ hasPermission: () => true }),
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

vi.mock("@/components/dashboard/BloomWeeklySuggestionsCard", () => ({
  BloomWeeklySuggestionsCard: () => null,
}));

vi.mock("@/hooks/useTenantAudienceHealth", () => ({
  useTenantAudienceHealth: () => ({
    data: { eligible: 1250, total: 1700 },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/analytics/useCampaignDeliveryMetrics", () => ({
  useCampaignDeliveryMetrics: () => ({
    summary: { totalDelivered: 2000, avgClickRate: 3.2, avgOpenRate: 20.5 },
    campaigns: [{
      campaignId: "campaign-1",
      campaignName: "Autumn garden newsletter",
      computedDelivered: 2000,
      clickRate: 3.2,
    }],
    loading: false,
    error: null,
  }),
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

describe("BloomSuite task-first dashboard", () => {
  it("shows reachable customers and campaign engagement without a sales total", async () => {
    renderDashboard();
    expect(await screen.findByText("1,250")).toBeInTheDocument();
    expect(screen.getByText("3.2%")).toBeInTheDocument();
    expect(screen.getByText("20.5%")).toBeInTheDocument();
    expect(screen.getByText("Autumn garden newsletter")).toBeInTheDocument();
    expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
  });

  it("does not automatically open a welcome tour", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: "Take a tour" })).toBeInTheDocument();
  });
});
