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

const mockedUseIntegrationDetailData = vi.mocked(useIntegrationDetailData);

function buildCloverDetailState() {
  const seed = getIntegrationSeed("clover");

  if (!seed) {
    throw new Error("Expected Clover integration seed to exist.");
  }

  const item = {
    ...seed,
    status: "connected" as const,
    connectedSince: "2026-03-20T10:00:00.000Z",
    metaLabel: "Bloom Flowers",
    targetPath: "/integrations/clover/guide",
  };

  const model = buildIntegrationDetailModel({
    item,
    status: "connected",
    contextLabel: item.metaLabel,
    connectedAt: "2026-03-20T10:00:00.000Z",
    verificationAt: null,
    lastSyncAt: "2026-03-22T12:00:00.000Z",
    lastActivityAt: "2026-03-22T12:00:00.000Z",
    lastWebhookReceivedAt: null,
    hasWebhookMonitoring: true,
    webhooksSubscribed: false,
    webhookRetryCount: 2,
    webhookNextRetryAt: "2026-03-24T08:00:00.000Z",
    lastError: "Awaiting first webhook delivery",
    syncSummary: "Customers 120 • Products 42 • Sales 18",
    serviceStateLabel: "connected",
    canDisconnect: true,
  });

  const connectionTestReport = {
    status: "partial" as const,
    summary: "4/6 endpoints succeeded. Some data may be unavailable.",
    duration_ms: 842,
    results: {
      merchant: {
        success: true,
        timing_ms: 55,
        data: { id: "merchant-123", name: "Bloom Flowers" },
      },
      employees: { success: true, timing_ms: 61, count: 3, samples: [] },
      customers: { success: true, timing_ms: 88, count: 12, samples: [] },
      inventory: { success: true, timing_ms: 104, count: 24, samples: [] },
      orders: {
        success: false,
        timing_ms: 205,
        error: "HTTP 403: permissions",
        status_code: 403,
      },
      payments: {
        success: false,
        timing_ms: 190,
        error: "HTTP 403: permissions",
        status_code: 403,
      },
    },
    counts: {
      employees: 3,
      customers: 12,
      items: 24,
      orders_last_30d: 0,
      payments_last_30d: 0,
    },
    errors: [
      { endpoint: "orders", code: "403", message: "HTTP 403: permissions" },
      { endpoint: "payments", code: "403", message: "HTTP 403: permissions" },
    ],
  };

  return {
    isValidSlug: true,
    item,
    model,
    comingSoonDetail: null,
    squareDetail: null,
    squareDashboard: null,
    cloverDetail: {
      connectionId: "clover-1",
      merchantName: "Bloom Flowers",
      merchantId: "merchant-123",
      employeeId: "employee-456",
      region: "us",
      environment: "production",
      connectionStatus: "connected",
      connectedAt: "2026-03-20T10:00:00.000Z",
      setupWizardCompletedAt: null,
      lastSyncedAt: "2026-03-22T12:00:00.000Z",
      lastCustomerSync: "2026-03-22T11:00:00.000Z",
      lastSalesSync: null,
      lastProductSync: "2026-03-22T10:00:00.000Z",
      customersSynced: 120,
      salesSynced: 18,
      productsSynced: 42,
      lastWebhookReceivedAt: null,
      webhooksLastCheckedAt: "2026-03-22T14:00:00.000Z",
      webhookLastError: "Awaiting first webhook delivery",
      webhookRetryCount: 2,
      webhookNextRetryAt: "2026-03-24T08:00:00.000Z",
      webhooksSubscribed: false,
      appIdConfigured: false,
      lastTestedAt: "2026-03-22T15:00:00.000Z",
      lastTestStatus: "partial",
      syncLogsPath: "/activity?source=clover&type=sync",
      automationLogsPath: "/activity?source=clover&type=automation",
      automationPath: "/crm/automations",
      canDisconnect: true,
    },
    cloverDashboard: {
      customers: {
        rows: [
          {
            id: "customer-1",
            pos_connection_id: "clover-1",
            pos_source: "clover",
            external_id: "CL-CUST-1",
            name: "Avery Bloom",
            email: "avery@example.com",
            phone: "15551234567",
            address: null,
            raw_data: { vip: true },
            tags: ["vip"],
            created_at: "2026-03-20T10:00:00.000Z",
            updated_at: "2026-03-22T10:00:00.000Z",
            displayName: "Avery Bloom",
            normalizedTags: ["vip"],
          },
        ],
        pagination: { page: 1, pageSize: 50, totalCount: 1, totalPages: 1 },
        isLoading: false,
        isFetching: false,
      },
      sales: {
        rows: [
          {
            id: "order-1",
            pos_connection_id: "clover-1",
            pos_customer_id: "customer-1",
            external_id: "CL-ORDER-1",
            external_customer_id: "CL-CUST-1",
            currency: "USD",
            fulfillment_state: "fulfilled",
            fulfillment_type: "pickup",
            items: [{ name: "Peony Stem", quantity: 2, unitPrice: 12.5 }],
            order_date: "2026-03-22T11:30:00.000Z",
            raw_data: { source: "clover" },
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
          },
        ],
        pagination: { page: 1, pageSize: 50, totalCount: 1, totalPages: 1 },
        summary: { revenue: 25, averageOrderValue: 25, saleCount: 1 },
        isLoading: false,
        isFetching: false,
      },
      products: {
        rows: [
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
            external_data: { clover: true },
            external_id: "CL-PROD-1",
            inventory_count: 8,
            is_visible: true,
            last_synced_at: "2026-03-22T11:40:00.000Z",
            low_stock_threshold: 2,
            meta_description: null,
            meta_title: null,
            name: "Spring Bouquet",
            price: 48,
            sku: "CL-SKU-1",
            slug: "spring-bouquet",
            source: "clover",
            status: "active",
            subcategory: null,
            tags: ["spring", "gift"],
            track_inventory: true,
            updated_at: "2026-03-22T11:40:00.000Z",
            stockState: "healthy",
            normalizedTags: ["spring", "gift"],
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
            provider: "clover",
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
        pagination: { page: 1, pageSize: 50, totalCount: 1, totalPages: 1 },
        isLoading: false,
        isFetching: false,
      },
      connectionTests: {
        rows: [
          {
            id: "test-1",
            tenant_id: "tenant-1",
            connection_id: "clover-1",
            merchant_id: "merchant-123",
            created_at: "2026-03-22T15:00:00.000Z",
            status: "partial",
            summary: connectionTestReport.summary,
            raw_results: connectionTestReport.results,
            counts: connectionTestReport.counts,
            errors: connectionTestReport.errors,
            duration_ms: connectionTestReport.duration_ms,
            tested_by: "user-1",
            report: connectionTestReport,
          },
        ],
        latestReport: connectionTestReport,
        latestTestedAt: "2026-03-22T15:00:00.000Z",
        pagination: { page: 1, pageSize: 50, totalCount: 1, totalPages: 1 },
        isLoading: false,
        isFetching: false,
      },
    },
    lightspeedDetail: null,
    lightspeedDashboard: null,
    metaDetail: null,
    ga4Detail: null,
    marketingImportDetail: null,
    targetPath: "/integrations/clover/guide",
    requestPath: undefined,
    canUseActions: true,
    canAccessLightspeedAdminFeatures: false,
    emailInfrastructureDetail: null,
    canDisconnect: true,
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
    triggerCloverSync: vi.fn().mockResolvedValue(undefined),
    isCloverSyncing: false,
    runCloverConnectionTest: vi.fn().mockResolvedValue(undefined),
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

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/integrations/clover"]}>
      <Routes>
        <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
        <Route path="/crm/automations" element={<div>Automations Route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("IntegrationDetailPage Clover parity branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseIntegrationDetailData.mockReturnValue(buildCloverDetailState());
  });

  it("renders the Clover parity header, sync-only state, and app-level webhook copy", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Clover" })).toBeTruthy();
    expect(screen.getAllByText("Sync only").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(
        /Clover webhook delivery is configured at the app level, not per merchant/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Bloom Flowers")).toBeTruthy();
  });

  it("renders merchant details, region badge, and setup wizard fallback", () => {
    renderPage();

    expect(screen.getByText("Merchant Details")).toBeTruthy();
    expect(screen.getByText("US")).toBeTruthy();
    expect(screen.getByText("Not completed")).toBeTruthy();
  });

  it("renders Clover automation maturity rows", () => {
    renderPage();

    expect(screen.getByText("Automation Pipeline")).toBeTruthy();
    expect(screen.getAllByText("Partial").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Not available")).toBeTruthy();
    expect(
      screen.getByText(
        /Some Clover automation behaviors are provisionally implemented/i,
      ),
    ).toBeTruthy();
  });

  it("renders the Connection Test tab and reruns the Clover diagnostics harness", async () => {
    const state = buildCloverDetailState();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Connection Test" }));

    expect(screen.getByText("Connection Test Results")).toBeTruthy();
    expect(
      screen.getAllByText(/4\/6 endpoints succeeded/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Recent test runs")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /re-run test/i }));

    await waitFor(() => {
      expect(state.runCloverConnectionTest).toHaveBeenCalledTimes(1);
    });
  });

  it("shows Clover-specific disconnect warnings", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getAllByText("Disconnect Clover")[0]);

    expect(screen.getByText("Disconnect Clover?")).toBeTruthy();
    expect(
      screen.getByText(
        /Customer, sales, and product sync will stop until Clover is connected again/i,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Stored Clover merchant credentials and app-level webhook health references will be removed/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Remove Clover connection")).toBeTruthy();
  });
});
