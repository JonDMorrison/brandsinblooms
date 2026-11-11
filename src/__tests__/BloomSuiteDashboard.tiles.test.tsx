import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dashboardAccess = vi.hoisted(() => ({
  permissions: new Set<string>([
    "customers.read",
    "reports.read",
    "campaigns.write",
  ]),
  loading: false,
  error: false,
  refresh: vi.fn(),
  masterAdmin: false,
  hydrated: true,
  activeTenantId: "tenant-1" as string | null,
  companies: [{ id: "tenant-1", name: "Synthetic Garden Centre" }],
  selectTenant: vi.fn(async (_id: string) => undefined),
  refreshTenants: vi.fn(async () => undefined),
}));
const dashboardResults = vi.hoisted(() => ({ empty: false, error: false }));
beforeEach(() => {
  dashboardResults.empty = false;
  dashboardResults.error = false;
  dashboardAccess.permissions = new Set([
    "customers.read",
    "reports.read",
    "campaigns.write",
  ]);
  dashboardAccess.loading = false;
  dashboardAccess.error = false;
  dashboardAccess.masterAdmin = false;
  dashboardAccess.hydrated = true;
  dashboardAccess.activeTenantId = "tenant-1";
  dashboardAccess.refresh.mockClear();
  dashboardAccess.selectTenant.mockClear();
  dashboardAccess.refreshTenants.mockClear();
});

vi.mock("@/contexts/AdminContext", () => ({
  useAdmin: () => ({
    isMasterAdmin: dashboardAccess.masterAdmin,
    isLoading: false,
    activeTenantId: dashboardAccess.activeTenantId,
    hasHydratedTenantContext: dashboardAccess.hydrated,
    availableTenants: dashboardAccess.companies,
    setActiveTenantId: dashboardAccess.selectTenant,
    refreshTenants: dashboardAccess.refreshTenants,
  }),
}));

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
  useUserRole: () => ({
    hasPermission: (permission: string) =>
      dashboardAccess.permissions.has(permission),
    isLoading: dashboardAccess.loading,
    isError: dashboardAccess.error,
    refetch: dashboardAccess.refresh,
  }),
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
    summary: { totalDelivered: dashboardResults.empty ? 0 : 2000, avgClickRate: 3.2, avgOpenRate: 20.5 },
    campaigns: dashboardResults.empty ? [] : [
      {
        campaignId: "campaign-1",
        campaignName: "Autumn garden newsletter",
        computedDelivered: 2000,
        clickRate: 3.2,
      },
    ],
    loading: false,
    error: dashboardResults.error ? "Unavailable" : null,
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
  it("explains missing recent results and offers campaign creation", () => {
    dashboardResults.empty = true;
    renderDashboard();
    expect(screen.getAllByText("No recent results")).toHaveLength(2);
    expect(screen.getByText(/No campaigns sent in the last 30 days/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create a campaign/ })).toBeInTheDocument();
  });

  it("does not mistake an analytics error for an empty campaign history", () => {
    dashboardResults.empty = true;
    dashboardResults.error = true;
    renderDashboard();
    expect(screen.getAllByText("Results unavailable")).toHaveLength(2);
    expect(screen.getByText("Campaign results aren't available right now.")).toBeInTheDocument();
    expect(screen.queryByText(/No campaigns sent in the last 30 days/)).not.toBeInTheDocument();
  });
  it("shows reachable customers and campaign engagement without a sales total", async () => {
    renderDashboard();
    expect(await screen.findByText("1,250")).toBeInTheDocument();
    expect(screen.getByText("3.2%")).toBeInTheDocument();
    expect(screen.getByText("20.5%")).toBeInTheDocument();
    expect(screen.getByText("Autumn garden newsletter")).toBeInTheDocument();
    expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
  });

  it("uses inset icon zones and balanced action/metric/card surfaces", () => {
    const { container } = renderDashboard();
    const actionCards = container.querySelectorAll("[data-dashboard-action-card]");
    const metricCards = container.querySelectorAll("[data-dashboard-metric-card]");
    const latestCard = container.querySelector("[data-dashboard-latest-campaign]");

    expect(actionCards).toHaveLength(3);
    expect(metricCards).toHaveLength(3);
    for (const card of actionCards) {
      expect(card.querySelector("[data-dashboard-action-icon]")).not.toBeNull();
      expect(card.querySelector("[data-dashboard-action-content]")).not.toBeNull();
      expect(card.querySelector("[data-dashboard-action-arrow]")).not.toBeNull();
    }
    for (const card of metricCards) {
      expect(card.querySelector("[data-dashboard-metric-icon]")).not.toBeNull();
    }
    expect(latestCard?.querySelector("[data-dashboard-latest-icon]")).not.toBeNull();
    expect(screen.getByText("Your latest email campaign")).toBeVisible();
  });

  it("shows large, accessible mobile actions when rights are resolved", () => {
    renderDashboard();
    expect(
      screen.getByRole("button", { name: /Create an email/ }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Send a text/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Customers/ })).toBeVisible();
    expect(screen.getByText("Recent performance")).toBeVisible();
  });

  it("never leaves an empty page if all permissions are absent", () => {
    dashboardAccess.permissions.clear();
    renderDashboard();
    expect(screen.getByText("What would you like to do?")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your dashboard tools aren't available yet",
    );
    expect(
      screen.getByRole("button", { name: /Retry dashboard access/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Create an email/ }),
    ).toBeNull();
    expect(screen.queryByText("Recent performance")).toBeNull();
  });

  it("shows visible loading placeholders while company rights resolve", () => {
    dashboardAccess.permissions.clear();
    dashboardAccess.loading = true;
    renderDashboard();
    expect(
      screen.getByRole("status", { name: "Loading dashboard actions" }),
    ).toBeVisible();
    expect(screen.getByText("Loading your company tools…")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retries a failed rights lookup instead of presenting a blank dashboard", () => {
    dashboardAccess.permissions.clear();
    dashboardAccess.error = true;
    renderDashboard();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load your dashboard access",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Retry dashboard access/ }),
    );
    expect(dashboardAccess.refresh).toHaveBeenCalledTimes(1);
  });

  it("requires a master admin to choose the intended company instead of showing an empty dashboard", () => {
    dashboardAccess.masterAdmin = true;
    dashboardAccess.activeTenantId = null;
    dashboardAccess.permissions.clear();
    renderDashboard();
    expect(screen.getByText("Choose a company to get started")).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Company to manage" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Create an email/ }),
    ).toBeNull();
  });

  it("keeps reporting-only accounts useful without exposing send permissions", () => {
    dashboardAccess.permissions = new Set(["reports.read"]);
    renderDashboard();
    expect(
      screen.getByRole("button", { name: /View analytics/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Create an email/ }),
    ).toBeNull();
    expect(screen.getByText("Recent performance")).toBeVisible();
  });

  it("does not automatically open a welcome tour", () => {
    renderDashboard();
    expect(
      screen.getByRole("button", { name: "Take a tour" }),
    ).toBeInTheDocument();
  });
});
