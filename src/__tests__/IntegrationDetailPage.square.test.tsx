import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

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

const mockedUseIntegrationDetailData = vi.mocked(useIntegrationDetailData);

function buildSquareDetailState({
  emptyDashboard = false,
  canDisconnect = true,
}: {
  emptyDashboard?: boolean;
  canDisconnect?: boolean;
} = {}) {
  const seed = getIntegrationSeed("square");

  if (!seed) {
    throw new Error("Expected Square integration seed to exist.");
  }

  const item = {
    ...seed,
    status: "connected" as const,
    connectedSince: "2026-03-20T10:00:00.000Z",
    metaLabel: "Bloom Square Merchant",
    targetPath: "/integrations/square/guide",
  };

  const model = buildIntegrationDetailModel({
    item,
    status: "connected",
    contextLabel: "Bloom Square Merchant",
    connectedAt: "2026-03-20T10:00:00.000Z",
    verificationAt: "2026-03-20T11:00:00.000Z",
    lastSyncAt: "2026-03-22T12:00:00.000Z",
    lastActivityAt: "2026-03-22T12:00:00.000Z",
    lastWebhookReceivedAt: "2026-03-22T12:05:00.000Z",
    hasWebhookMonitoring: true,
    webhooksSubscribed: false,
    webhookRetryCount: 1,
    webhookNextRetryAt: null,
    lastError: "Square webhook verification pending.",
    syncSummary: "Customers 85 • Products 24 • Sales 31",
    serviceStateLabel: "connected",
    canDisconnect,
  });

  return {
    isValidSlug: true,
    item,
    model,
    comingSoonDetail: null,
    squareDetail: {
      connectionId: "square-1",
      merchantName: "Bloom Square Merchant",
      merchantId: "MERCHANT-123",
      locationId: "LOCATION-456",
      environment: "production",
      tokenType: "bearer",
      connectionStatus: "connected",
      connectedAt: "2026-03-20T10:00:00.000Z",
      lastSyncedAt: "2026-03-22T12:00:00.000Z",
      lastCustomerSync: emptyDashboard ? null : "2026-03-22T11:00:00.000Z",
      lastSalesSync: emptyDashboard ? null : "2026-03-22T11:30:00.000Z",
      lastProductSync: emptyDashboard ? null : "2026-03-22T11:40:00.000Z",
      customersSynced: emptyDashboard ? 0 : 85,
      salesSynced: emptyDashboard ? 0 : 31,
      productsSynced: emptyDashboard ? 0 : 24,
      lastWebhookReceivedAt: "2026-03-22T12:05:00.000Z",
      webhookSubscriptionId: "WEBHOOK-789",
      webhooksLastCheckedAt: "2026-03-22T12:06:00.000Z",
      webhookLastError: "Square webhook verification pending.",
      webhookRetryCount: 1,
      webhookNextRetryAt: null,
      webhooksSubscribed: false,
      requiredWebhookEvents: ["payment.completed", "order.updated"],
      syncLogsPath: "/activity?source=square&type=sync",
      automationLogsPath: "/activity?source=square&type=automation",
      automationPath: "/crm/automations",
      canDisconnect,
    },
    squareDashboard: {
      customers: {
        rows: emptyDashboard
          ? []
          : [
              {
                id: "customer-1",
                pos_connection_id: "square-1",
                pos_source: "square",
                external_id: "SQ-CUST-1",
                name: "Avery Bloom",
                email: "avery@example.com",
                phone: "15551234567",
                address: null,
                raw_data: { tier: "vip" },
                tags: ["vip", "retail"],
                created_at: "2026-03-20T10:00:00.000Z",
                updated_at: "2026-03-22T10:00:00.000Z",
                displayName: "Avery Bloom",
                normalizedTags: ["vip", "retail"],
              },
            ],
        pagination: {
          page: 1,
          pageSize: 50,
          totalCount: emptyDashboard ? 0 : 1,
          totalPages: 1,
        },
        isLoading: false,
        isFetching: false,
      },
      sales: {
        rows: emptyDashboard
          ? []
          : [
              {
                id: "order-1",
                pos_connection_id: "square-1",
                pos_customer_id: "customer-1",
                external_id: "SQ-ORDER-1",
                external_customer_id: "SQ-CUST-1",
                currency: "USD",
                fulfillment_state: "proposed",
                fulfillment_type: "pickup",
                items: [{ name: "Peony Stem", quantity: 2, unitPrice: 12.5 }],
                order_date: "2026-03-22T11:30:00.000Z",
                raw_data: { triggers_fired: ["purchase_completed"] },
                refund_amount: null,
                refund_reason: null,
                refunded_at: null,
                status: "completed",
                total_amount: 25,
                created_at: "2026-03-22T11:30:00.000Z",
                updated_at: "2026-03-22T11:35:00.000Z",
                customerDisplayName: "Avery Bloom",
                lineItemCount: 1,
                orderType: "pickup",
                automationFired: true,
              },
            ],
        pagination: {
          page: 1,
          pageSize: 50,
          totalCount: emptyDashboard ? 0 : 1,
          totalPages: 1,
        },
        summary: {
          revenue: emptyDashboard ? 0 : 25,
          averageOrderValue: emptyDashboard ? 0 : 25,
          saleCount: emptyDashboard ? 0 : 1,
        },
        isLoading: false,
        isFetching: false,
      },
      products: {
        rows: emptyDashboard
          ? []
          : [
              {
                id: "product-1",
                tenant_id: "tenant-1",
                barcode: null,
                category: "Bouquets",
                compare_at_price: null,
                cost_price: null,
                created_at: "2026-03-20T10:00:00.000Z",
                created_by_user_id: null,
                currency: "USD",
                description: "Spring arrangement",
                external_data: { square: true },
                external_id: "SQ-PROD-1",
                inventory_count: 8,
                is_visible: true,
                last_synced_at: "2026-03-22T11:40:00.000Z",
                low_stock_threshold: 2,
                meta_description: null,
                meta_title: null,
                name: "Spring Bouquet",
                price: 48,
                sku: "SQ-SKU-1",
                slug: "spring-bouquet",
                source: "square",
                status: "active",
                subcategory: null,
                tags: ["spring", "gift"],
                track_inventory: true,
                updated_at: "2026-03-22T11:40:00.000Z",
                stockState: "healthy",
                normalizedTags: ["spring", "gift"],
              },
            ],
        pagination: {
          page: 1,
          pageSize: 50,
          totalCount: emptyDashboard ? 0 : 1,
          totalPages: 1,
        },
        categories: emptyDashboard ? [] : ["Bouquets"],
        isLoading: false,
        isFetching: false,
      },
      syncLogs: {
        rows: emptyDashboard
          ? []
          : [
              {
                id: "job-1",
                attempts: 1,
                batch_size: 50,
                circuit_open_until: null,
                completed_at: null,
                consecutive_failures: null,
                created_at: "2026-03-22T12:00:00.000Z",
                current_page: 1,
                current_batch: 1,
                current_cursor: null,
                customers_synced: 10,
                error_count: 0,
                estimated_rows: 40,
                failed_rows: 0,
                fetched_rows: 10,
                inserted_rows: 10,
                is_delta: false,
                last_error: null,
                last_failure_at: null,
                last_progress_at: "2026-03-22T12:03:00.000Z",
                last_sync_cursor: null,
                max_retries: 3,
                metadata: { source: "manual" },
                next_retry_at: null,
                orders_synced: 0,
                processed_rows: 10,
                progress_message: "Importing customers",
                products_synced: 0,
                provider: "square",
                provider_job_id: null,
                scheduled_at: "2026-03-22T12:00:00.000Z",
                skipped_rows: 0,
                started_at: "2026-03-22T12:00:05.000Z",
                status: "in_progress",
                sync_type: "customers",
                tenant_id: "tenant-1",
                total_batches: null,
                total_pages_est: 4,
                triggered_by: "manual",
                updated_at: "2026-03-22T12:03:00.000Z",
                normalizedSyncType: "customers",
                progressPercent: 25,
                isStale: false,
                isTerminal: false,
              },
            ],
        pagination: {
          page: 1,
          pageSize: 50,
          totalCount: emptyDashboard ? 0 : 1,
          totalPages: 1,
        },
        isLoading: false,
        isFetching: false,
      },
    },
    cloverDetail: null,
    lightspeedDetail: null,
    lightspeedDashboard: null,
    metaDetail: null,
    ga4Detail: null,
    marketingImportDetail: null,
    emailInfrastructureDetail: null,
    targetPath: "/integrations/square/guide",
    requestPath: undefined,
    canUseActions: true,
    canAccessLightspeedAdminFeatures: false,
    canDisconnect,
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
    verifySquareWebhooks: vi.fn().mockResolvedValue(undefined),
    isVerifyingSquareWebhooks: false,
    triggerCloverSync: vi.fn(),
    isCloverSyncing: false,
    runCloverConnectionTest: vi.fn(),
    isCloverConnectionTesting: false,
    lightspeedSyncJobs: [],
    lightspeedActiveJobIds: [],
    lightspeedTrackedJobIds: [],
    lightspeedRealtimeActive: false,
    lightspeedSyncState: "idle",
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
    disconnect: vi.fn().mockResolvedValue(undefined),
    isDisconnecting: false,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/integrations/square"]}>
      <Routes>
        <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
        <Route path="/crm/automations" element={<div>Automations Route</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("IntegrationDetailPage Square branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseIntegrationDetailData.mockReturnValue(buildSquareDetailState());
  });

  it("renders the Square parity header and webhook attention banner", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Square" })).toBeTruthy();
    expect(screen.getByText("Verify Square webhook coverage")).toBeTruthy();
    expect(screen.getByText("Bloom Square Merchant")).toBeTruthy();
  });

  it("triggers Square webhook verification from the header actions", async () => {
    const state = buildSquareDetailState();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByText("Verify webhooks"));

    await waitFor(() => {
      expect(state.verifySquareWebhooks).toHaveBeenCalledTimes(1);
    });
  });

  it("shows Square-specific customer and sales columns", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Customers/ }));
    expect(await screen.findByText("Customer ID")).toBeTruthy();
    expect(screen.getByText("SQ-CUST-1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Sales/ }));
    expect(await screen.findByText("Order Type")).toBeTruthy();
    expect(screen.getByText("Automation Fired")).toBeTruthy();
    expect(screen.getByText("Triggered")).toBeTruthy();
  });

  it("navigates to CRM automations from the automation integration panel", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Open automations" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/crm/automations",
      );
    });
  });

  it("renders Square-specific empty states and disconnect bullets", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildSquareDetailState({ emptyDashboard: true }),
    );

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Customers/ }));
    expect(
      await screen.findByText("No Square customers synced yet"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByText("Disconnect Square"));

    expect(
      await screen.findByRole("heading", { name: "Disconnect Square?" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Webhook-driven automation intake will pause, and any new Square events will be ignored until the connection is restored.",
      ),
    ).toBeTruthy();
  });
});
