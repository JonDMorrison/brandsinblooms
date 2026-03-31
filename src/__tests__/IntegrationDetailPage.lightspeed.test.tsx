import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
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

function buildLightspeedDetailState({
  canAccessLightspeedAdminFeatures = false,
  canDisconnect = false,
}: {
  canAccessLightspeedAdminFeatures?: boolean;
  canDisconnect?: boolean;
} = {}) {
  const seed = getIntegrationSeed("lightspeed");

  if (!seed) {
    throw new Error("Expected Lightspeed integration seed to exist.");
  }

  const item = {
    ...seed,
    status: "connected" as const,
    connectedSince: "2026-03-20T10:00:00.000Z",
    metaLabel: "bloom-store.retail.lightspeed.app",
    targetPath: "/integrations/lightspeed/guide",
  };

  const model = buildIntegrationDetailModel({
    item,
    status: "connected",
    contextLabel: "Bloom Flowers",
    connectedAt: "2026-03-20T10:00:00.000Z",
    verificationAt: null,
    lastSyncAt: "2026-03-22T12:00:00.000Z",
    lastActivityAt: "2026-03-22T12:00:00.000Z",
    lastWebhookReceivedAt: null,
    hasWebhookMonitoring: true,
    webhooksSubscribed: false,
    webhookRetryCount: 0,
    webhookNextRetryAt: null,
    lastError:
      "Lightspeed webhook API not available for this account. Sync-only mode.",
    syncSummary: "Customers 120 • Products 42 • Sales 18",
    serviceStateLabel: "connected",
    canDisconnect: true,
  });

  return {
    isValidSlug: true,
    item,
    model,
    comingSoonDetail: null,
    squareDetail: null,
    cloverDetail: null,
    lightspeedDetail: {
      connectionId: "lightspeed-1",
      retailerName: "Bloom Flowers",
      domainPrefix: "bloom-store",
      storeUrl: "https://bloom-store.retail.lightspeed.app",
      connectionStatus: "connected",
      connectedAt: "2026-03-20T10:00:00.000Z",
      lastSyncedAt: "2026-03-22T12:00:00.000Z",
      lastCustomerSync: "2026-03-22T11:00:00.000Z",
      lastSalesSync: "2026-03-22T11:30:00.000Z",
      lastProductSync: null,
      customersSynced: 120,
      salesSynced: 18,
      productsSynced: 42,
      lastWebhookReceivedAt: null,
      webhooksLastCheckedAt: "2026-03-22T14:00:00.000Z",
      webhookLastError:
        "Lightspeed webhook API not available for this account. Sync-only mode.",
      webhookRetryCount: 0,
      webhookNextRetryAt: null,
      webhooksSubscribed: false,
      webhookRegistered: false,
      webhookSubscriptionId: null,
      webhookMode: "unavailable" as const,
      syncLogsPath: "/activity?source=lightspeed&type=sync",
      diagnosticsPath: "/integrations/lightspeed/debug",
      canDisconnect,
    },
    targetPath: "/integrations/lightspeed/guide",
    requestPath: undefined,
    canUseActions: true,
    canAccessLightspeedAdminFeatures,
    lightspeedDashboard: {
      customers: {
        rows: [
          {
            id: "customer-1",
            tenant_id: "tenant-1",
            contact_id: "crm-1",
            created_at: "2026-03-20T10:00:00.000Z",
            customer_group_id: "vip",
            email: "alice@example.com",
            first_name: "Alice",
            first_purchase_date: "2026-03-01T10:00:00.000Z",
            last_name: "Example",
            last_purchase_date: "2026-03-22T10:00:00.000Z",
            lightspeed_customer_id: "CUST-1",
            loyalty_balance: 250,
            phone: "15551234567",
            purchase_count: 3,
            raw_data: { tier: "gold" },
            synced_at: "2026-03-22T11:00:00.000Z",
            tags: ["vip"],
            total_spend: 420.5,
            updated_at: "2026-03-22T11:00:00.000Z",
            displayName: "Alice Example",
            quality: {
              missingEmail: false,
              missingPhone: false,
              zeroPurchaseCount: false,
              staleSync: false,
              missingCrmLink: false,
            },
          },
        ],
        pagination: { page: 1, pageSize: 50, totalCount: 1, totalPages: 1 },
        isLoading: false,
        isFetching: false,
      },
      sales: {
        rows: [
          {
            id: "sale-1",
            tenant_id: "tenant-1",
            contact_id: "crm-1",
            created_at: "2026-03-22T11:30:00.000Z",
            lightspeed_customer_id: "CUST-1",
            lightspeed_sale_id: "LS-1001",
            line_items: [
              { name: "Peony Stem", quantity: 2, unitPrice: 12.5 },
              { productID: "SKU-2", quantity: 1, unitPrice: 8 },
            ],
            note: "Birthday order",
            payment_method: "Card",
            raw_data: { register: 2 },
            sale_date: "2026-03-22T11:30:00.000Z",
            status: "completed",
            synced_at: "2026-03-22T11:35:00.000Z",
            total_amount: 33,
            customerDisplayName: "Alice Example",
            lineItemCount: 2,
          },
        ],
        pagination: { page: 1, pageSize: 50, totalCount: 1, totalPages: 1 },
        summary: { revenue: 33, averageOrderValue: 33, saleCount: 1 },
        isLoading: false,
        isFetching: false,
      },
      products: {
        rows: [
          {
            id: "product-1",
            tenant_id: "tenant-1",
            category: "Bouquets",
            created_at: "2026-03-20T10:00:00.000Z",
            description: "Spring bundle",
            inventory_count: 5,
            lightspeed_product_id: "PROD-1",
            name: "Low Soil Mix",
            price: 24,
            raw_data: { bundle: true },
            sku: "SKU-LOW",
            synced_at: "2026-03-22T11:40:00.000Z",
            tags: ["spring", "gift", "popular"],
            updated_at: "2026-03-22T11:40:00.000Z",
            stockState: "low",
            normalizedTags: ["spring", "gift", "popular"],
          },
        ],
        pagination: { page: 1, pageSize: 50, totalCount: 1, totalPages: 1 },
        categories: ["Bouquets"],
        isLoading: false,
        isFetching: false,
      },
      syncLogs: {
        rows: [
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
            customers_synced: 0,
            error_count: 0,
            estimated_rows: 100,
            failed_rows: 0,
            fetched_rows: 25,
            inserted_rows: 25,
            is_delta: false,
            last_error: null,
            last_failure_at: null,
            last_progress_at: "2026-03-22T12:05:00.000Z",
            last_sync_cursor: null,
            max_retries: 3,
            metadata: { source: "manual" },
            next_retry_at: null,
            orders_synced: 0,
            processed_rows: 25,
            progress_message: "Importing customers",
            products_synced: 0,
            provider: "lightspeed",
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
            updated_at: "2026-03-22T12:05:00.000Z",
            normalizedSyncType: "customers",
            progressPercent: 25,
            isStale: false,
            isTerminal: false,
          },
          {
            id: "job-2",
            attempts: 2,
            batch_size: 50,
            circuit_open_until: null,
            completed_at: "2026-03-22T12:10:00.000Z",
            consecutive_failures: 1,
            created_at: "2026-03-22T12:06:00.000Z",
            current_page: 1,
            current_batch: 1,
            current_cursor: null,
            customers_synced: 0,
            error_count: 1,
            estimated_rows: 20,
            failed_rows: 5,
            fetched_rows: 20,
            inserted_rows: 15,
            is_delta: false,
            last_error: "Temporary API failure",
            last_failure_at: "2026-03-22T12:10:00.000Z",
            last_progress_at: "2026-03-22T12:09:00.000Z",
            last_sync_cursor: null,
            max_retries: 3,
            metadata: { source: "manual" },
            next_retry_at: null,
            orders_synced: 0,
            processed_rows: 20,
            progress_message: "Sales sync failed",
            products_synced: 0,
            provider: "lightspeed",
            provider_job_id: null,
            scheduled_at: "2026-03-22T12:06:00.000Z",
            skipped_rows: 0,
            started_at: "2026-03-22T12:06:05.000Z",
            status: "failed",
            sync_type: "sales",
            tenant_id: "tenant-1",
            total_batches: null,
            total_pages_est: 1,
            triggered_by: "manual",
            updated_at: "2026-03-22T12:10:00.000Z",
            normalizedSyncType: "sales",
            progressPercent: 75,
            isStale: false,
            isTerminal: true,
          },
        ],
        pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
        isLoading: false,
        isFetching: false,
      },
    },
    emailInfrastructureDetail: null,
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
    triggerSquareSync: vi.fn(),
    isSquareSyncing: false,
    verifySquareWebhooks: vi.fn(),
    isVerifyingSquareWebhooks: false,
    triggerCloverSync: vi.fn(),
    isCloverSyncing: false,
    runCloverConnectionTest: vi.fn(),
    isCloverConnectionTesting: false,
    lightspeedSyncJobs: [],
    lightspeedActiveJobIds: ["job-1"],
    lightspeedTrackedJobIds: ["job-1"],
    lightspeedRealtimeActive: true,
    lightspeedSyncState: "idle",
    lightspeedHasStaleJobs: false,
    triggerLightspeedSync: vi.fn().mockResolvedValue(undefined),
    isLightspeedSyncing: false,
    resetLightspeedData: vi.fn().mockResolvedValue(undefined),
    isResettingLightspeedData: false,
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
    <MemoryRouter initialEntries={["/integrations/lightspeed"]}>
      <Routes>
        <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
        <Route
          path="/integrations/lightspeed/debug"
          element={<div>Diagnostics Route</div>}
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("IntegrationDetailPage Lightspeed branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseIntegrationDetailData.mockReturnValue(
      buildLightspeedDetailState(),
    );
  });

  it("renders the loading shell during the initial page load", () => {
    mockedUseIntegrationDetailData.mockReturnValue({
      ...buildLightspeedDetailState(),
      item: null,
      model: null,
      isLoading: true,
    });

    renderPage();

    expect(screen.getByTestId("integration-detail-loading-shell")).toBeTruthy();
    expect(screen.queryByText("Lightspeed X-Series")).toBeNull();
  });

  it("renders the Lightspeed-specific webhook and store panels", () => {
    renderPage();

    expect(screen.getByText("Store Details")).toBeTruthy();
    expect(screen.getByText("Webhook Configuration")).toBeTruthy();
    expect(
      screen.getByText(
        /This Lightspeed account does not expose the webhook APIs BloomSuite expects/i,
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("bloom-store.retail.lightspeed.app").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Data Feeds")).toBeTruthy();
    expect(screen.queryByText(/Retailer ID/i)).toBeNull();
  });

  it("hides super-admin-only Lightspeed controls for non-admin users", () => {
    renderPage();

    expect(screen.queryByText("Danger Zone")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /disconnect lightspeed/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /diagnostics/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    expect(screen.queryByText("Run diagnostics")).toBeNull();
    expect(screen.queryByText("Disconnect Lightspeed")).toBeNull();
    expect(screen.getByText("View sync logs")).toBeTruthy();
    expect(screen.getByText("Open store URL")).toBeTruthy();
  });

  it("shows admin-only Lightspeed actions for super admins", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildLightspeedDetailState({
        canAccessLightspeedAdminFeatures: true,
        canDisconnect: true,
      }),
    );

    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderPage();

    expect(
      screen.getAllByRole("button", { name: /sync now/i }).length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    expect(screen.getByText("Run diagnostics")).toBeTruthy();
    expect(screen.getByText("View sync logs")).toBeTruthy();
    expect(screen.getByText("Open store URL")).toBeTruthy();
    expect(
      screen.getAllByText("Disconnect Lightspeed").length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByText("Open store URL"));

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://bloom-store.retail.lightspeed.app",
      "_blank",
      "noopener,noreferrer",
    );

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Run diagnostics"));

    await waitFor(() => {
      expect(screen.getByText("Diagnostics Route")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/lightspeed/debug",
      );
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getAllByText("Disconnect Lightspeed")[0]);

    expect(screen.getByText("Disconnect Lightspeed X-Series?")).toBeTruthy();
    expect(
      screen.getByText(
        /This removes the current Lightspeed X-Series connection from BloomSuite and immediately stops its active integration workflows/i,
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Disconnect Lightspeed/i).length,
    ).toBeGreaterThanOrEqual(1);

    windowOpenSpy.mockRestore();
  });

  it("shows a super-admin-only reset control for tenant-scoped Lightspeed test resets", async () => {
    const state = buildLightspeedDetailState({
      canAccessLightspeedAdminFeatures: true,
    });

    mockedUseIntegrationDetailData.mockReturnValue({
      ...state,
      lightspeedSyncJobs: [],
      lightspeedActiveJobIds: [],
      lightspeedTrackedJobIds: [],
      lightspeedRealtimeActive: false,
      lightspeedSyncState: "idle",
      isLightspeedSyncing: false,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /reset synced data/i }));

    expect(screen.getByText("Reset Lightspeed synced data?")).toBeTruthy();
    expect(
      screen.getByText(
        /This action is scoped to the current super admin tenant only/i,
      ),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /reset lightspeed data/i }),
    );

    await waitFor(() => {
      expect(state.resetLightspeedData).toHaveBeenCalledTimes(1);
    });
  });

  it("falls back to idle queue messaging when no Lightspeed jobs are actively fetching", () => {
    const state = buildLightspeedDetailState();
    const queuedJobs = state.lightspeedDashboard.syncLogs.rows.map(
      (job, index) => ({
        ...job,
        id: `queued-job-${index + 1}`,
        status: index === 0 ? "pending" : "delayed",
        progress_message:
          index === 0
            ? "Queued - waiting to start"
            : "Waiting for retry window after repeated failures",
        completed_at: null,
        isStale: false,
        isTerminal: false,
      }),
    );

    mockedUseIntegrationDetailData.mockReturnValue({
      ...state,
      lightspeedDashboard: {
        ...state.lightspeedDashboard,
        syncLogs: {
          ...state.lightspeedDashboard.syncLogs,
          rows: queuedJobs,
        },
      },
      lightspeedSyncJobs: queuedJobs,
      lightspeedActiveJobIds: [],
      lightspeedTrackedJobIds: queuedJobs.map((job) => job.id),
      lightspeedRealtimeActive: true,
      lightspeedSyncState: "idle",
      lightspeedHasStaleJobs: false,
      isLightspeedSyncing: false,
    });

    renderPage();

    expect(
      screen.getAllByText(
        "2 queued jobs waiting to start or retry. No records are currently being fetched.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("2 active jobs currently fetching records."),
    ).toBeNull();
    expect(
      screen
        .getAllByRole("button", { name: /sync now/i })[0]
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("uses provider totals when Lightspeed connection counters are still zero", () => {
    const state = buildLightspeedDetailState();

    mockedUseIntegrationDetailData.mockReturnValue({
      ...state,
      lightspeedDetail: {
        ...state.lightspeedDetail,
        customersSynced: 0,
        salesSynced: 0,
        productsSynced: 0,
      },
      lightspeedDashboard: {
        ...state.lightspeedDashboard,
        customers: {
          ...state.lightspeedDashboard.customers,
          pagination: {
            ...state.lightspeedDashboard.customers.pagination,
            totalCount: 7,
          },
        },
        sales: {
          ...state.lightspeedDashboard.sales,
          pagination: {
            ...state.lightspeedDashboard.sales.pagination,
            totalCount: 8,
          },
        },
        products: {
          ...state.lightspeedDashboard.products,
          pagination: {
            ...state.lightspeedDashboard.products.pagination,
            totalCount: 9,
          },
        },
      },
    });

    renderPage();

    expect(
      screen.getByRole("button", { name: /customers/i }).textContent,
    ).toContain("7");
    expect(
      screen.getByRole("button", { name: /sales/i }).textContent,
    ).toContain("8");
    expect(
      screen.getByRole("button", { name: /products/i }).textContent,
    ).toContain("9");
    expect(
      screen.getAllByText(
        (_, node) => node?.textContent?.includes("7 records") ?? false,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        (_, node) => node?.textContent?.includes("8 records") ?? false,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        (_, node) => node?.textContent?.includes("9 records") ?? false,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("renders the extracted data tabs and preserves core interactions", async () => {
    const state = buildLightspeedDetailState();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /customers/i }));

    expect(screen.getByText("Alice Example")).toBeTruthy();
    fireEvent.click(screen.getByText("Alice Example"));
    expect(screen.getByText("Lightspeed ID: CUST-1")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /View in CRM/i }).getAttribute("href"),
    ).toBe("/crm/customers?email=alice%40example.com");
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    fireEvent.click(screen.getByRole("button", { name: /sales/i }));
    expect(screen.getByText("Total revenue")).toBeTruthy();
    fireEvent.click(screen.getByText("LS-1001"));
    expect(screen.getByText("Peony Stem")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    fireEvent.click(screen.getByRole("button", { name: /products/i }));
    expect(screen.getByText("Low Soil Mix")).toBeTruthy();
    expect(screen.getByText("+1 more")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /sync logs/i }));
    expect(screen.getByText("Sync history")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Failed$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));

    await waitFor(() => {
      expect(state.triggerLightspeedSync).toHaveBeenCalledTimes(1);
    });
  });
});
