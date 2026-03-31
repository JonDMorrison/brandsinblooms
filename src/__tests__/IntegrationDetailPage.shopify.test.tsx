import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { buildIntegrationDetailModel } from "@/components/integrations/integrationDetailModel";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { useIntegrationDetailData } from "@/hooks/useIntegrationDetailData";
import IntegrationDetailPage from "@/pages/integrations/IntegrationDetailPage";

vi.mock("@/hooks/useIntegrationDetailData", () => ({
  useIntegrationDetailData: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/integrations/shopify/ConnectShopifyDialog", () => ({
  ConnectShopifyDialog: () => null,
  ConnectShopifyHint: () => null,
  getShopifyAdminUrl: (shopDomain: string | null) =>
    shopDomain ? `https://${shopDomain}/admin` : null,
}));

const mockedUseIntegrationDetailData: any = useIntegrationDetailData;

function buildShopifyDetailState() {
  const seed = getIntegrationSeed("shopify");

  if (!seed) {
    throw new Error("Expected Shopify integration seed to exist.");
  }

  const item = {
    ...seed,
    status: "connected" as const,
    connectedSince: "2026-03-25T10:00:00.000Z",
    metaLabel: "Bloom Flowers Store",
    targetPath: "/integrations/shopify",
  };

  const model = buildIntegrationDetailModel({
    item,
    status: "connected",
    contextLabel: "Bloom Flowers Store",
    connectedAt: "2026-03-25T10:00:00.000Z",
    lastSyncAt: "2026-03-25T11:00:00.000Z",
    lastActivityAt: "2026-03-25T11:05:00.000Z",
    lastWebhookReceivedAt: "2026-03-25T11:05:00.000Z",
    hasWebhookMonitoring: true,
    webhooksSubscribed: false,
    webhookRetryCount: 1,
    webhookNextRetryAt: null,
    lastError: "One or more required webhook topics could not be verified",
    syncSummary: "Customers 12 • Products 8 • Orders 5",
    serviceStateLabel: "connected",
    canDisconnect: true,
  });

  return {
    isValidSlug: true,
    item,
    model,
    comingSoonDetail: null,
    shopifyConnection: {
      id: "shopify-1",
      shop_domain: "bloom-flowers.myshopify.com",
      shop_name: "Bloom Flowers Store",
      shop_owner: "Jon Morrison",
      shop_email: "owner@example.com",
      scope: "read_customers,read_orders,read_products",
      status: "connected",
      connected_at: "2026-03-25T10:00:00.000Z",
      last_synced_at: "2026-03-25T11:00:00.000Z",
      last_customer_sync: "2026-03-25T10:20:00.000Z",
      last_sales_sync: "2026-03-25T10:40:00.000Z",
      last_product_sync: "2026-03-25T10:50:00.000Z",
      last_webhook_received_at: "2026-03-25T11:05:00.000Z",
      customers_synced: 12,
      sales_synced: 5,
      products_synced: 8,
      webhooks_subscribed: true,
      webhook_subscription_ids: ["101", "102"],
      webhooks_last_checked_at: "2026-03-25T11:06:00.000Z",
      webhook_retry_count: 0,
      webhook_next_retry_at: null,
      webhook_last_error: null,
      updated_at: "2026-03-25T11:06:00.000Z",
    },
    shopifyDashboard: {
      customers: {
        rows: [],
        pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
        isLoading: false,
        isFetching: false,
      },
      orders: {
        rows: [],
        pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
        summary: { revenue: 0, averageOrderValue: 0, saleCount: 0 },
        isLoading: false,
        isFetching: false,
      },
      products: {
        rows: [],
        pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
        categories: [],
        isLoading: false,
        isFetching: false,
      },
      syncLogs: {
        rows: [],
        pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
        isLoading: false,
        isFetching: false,
      },
    },
    squareDetail: null,
    squareDashboard: null,
    cloverDetail: null,
    cloverDashboard: null,
    lightspeedDetail: null,
    lightspeedDashboard: null,
    metaDetail: null,
    ga4Detail: null,
    marketingImportDetail: null,
    emailInfrastructureDetail: null,
    targetPath: "/integrations/shopify",
    requestPath: undefined,
    canUseActions: true,
    canAccessLightspeedAdminFeatures: false,
    canDisconnect: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    submitComingSoonInterest: vi.fn().mockResolvedValue(undefined),
    isSubmittingComingSoonInterest: false,
    runEmailInfrastructureHealthCheck: vi.fn().mockResolvedValue(undefined),
    isRunningEmailInfrastructureHealthCheck: false,
    triggerSquareSync: vi.fn().mockResolvedValue(undefined),
    isSquareSyncing: false,
    triggerShopifySync: vi.fn().mockResolvedValue(undefined),
    isShopifySyncing: false,
    verifySquareWebhooks: vi.fn().mockResolvedValue(undefined),
    isVerifyingSquareWebhooks: false,
    verifyShopifyWebhooks: vi.fn().mockResolvedValue(undefined),
    isVerifyingShopifyWebhooks: false,
    triggerCloverSync: vi.fn(),
    isCloverSyncing: false,
    runCloverConnectionTest: vi.fn(),
    isCloverConnectionTesting: false,
    shopifySyncJobs: [],
    shopifyActiveJobIds: [],
    shopifySyncState: "idle" as const,
    lightspeedSyncJobs: [],
    lightspeedActiveJobIds: [],
    lightspeedTrackedJobIds: [],
    lightspeedRealtimeActive: false,
    lightspeedSyncState: "idle" as const,
    lightspeedHasStaleJobs: false,
    triggerLightspeedSync: vi.fn(),
    isLightspeedSyncing: false,
    triggerMetaReauthorization: vi.fn(),
    isMetaReauthorizing: false,
    refreshMetaAssets: vi.fn(),
    isRefreshingMetaAssets: false,
    triggerGa4ConnectionTest: vi.fn(),
    isGa4ConnectionTesting: false,
    triggerGa4Reauthorization: vi.fn(),
    isGa4Reauthorizing: false,
    validateMarketingImportConnection: vi.fn(),
    isValidatingMarketingImportConnection: false,
    disconnect: vi.fn().mockResolvedValue(undefined),
    isDisconnecting: false,
  } as any;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/integrations/shopify"]}>
      <Routes>
        <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
        <Route
          path="/integrations/shopify/debug"
          element={<div>Shopify Diagnostics</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("IntegrationDetailPage Shopify branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseIntegrationDetailData.mockReturnValue(buildShopifyDetailState());
  });

  it("uses manual sync as the primary action for connected Shopify stores", async () => {
    const state = buildShopifyDetailState();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sync Now" }));

    await waitFor(() => {
      expect(state.triggerShopifySync).toHaveBeenCalledTimes(1);
    });
  });

  it("triggers Shopify webhook verification from the actions menu", async () => {
    const state = buildShopifyDetailState();
    state.shopifyConnection = {
      ...state.shopifyConnection,
      webhooks_subscribed: false,
      webhook_last_error:
        "One or more required webhook topics could not be verified",
      webhook_retry_count: 1,
    };
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByText("Verify webhooks"));

    await waitFor(() => {
      expect(state.verifyShopifyWebhooks).toHaveBeenCalledTimes(1);
    });
  });

  it("shows reinstall app when Shopify was uninstalled", () => {
    const state = buildShopifyDetailState();
    state.item = { ...state.item, status: "available" };
    state.shopifyConnection = {
      ...state.shopifyConnection,
      status: "revoked",
      webhooks_subscribed: false,
      webhook_last_error:
        "App was uninstalled from Shopify. Reconnect to restore sync.",
    };
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    expect(
      screen.getAllByRole("button", { name: "Reinstall App" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows admin-only diagnostics in the actions menu", async () => {
    const state = buildShopifyDetailState();
    state.canAccessLightspeedAdminFeatures = true;
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByText("Run diagnostics"));

    await waitFor(() => {
      expect(screen.getByText("Shopify Diagnostics")).toBeTruthy();
    });
  });
});
