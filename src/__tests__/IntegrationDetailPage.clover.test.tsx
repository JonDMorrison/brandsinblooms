import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
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

  return {
    isValidSlug: true,
    item,
    model,
    comingSoonDetail: null,
    squareDetail: null,
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
    targetPath: "/integrations/clover/guide",
    requestPath: undefined,
    canUseActions: true,
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
    triggerCloverSync: vi.fn(),
    isCloverSyncing: false,
    runCloverConnectionTest: vi.fn(),
    isCloverConnectionTesting: false,
    disconnect: vi.fn().mockResolvedValue(undefined),
    isDisconnecting: false,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/integrations/clover"]}>
      <Routes>
        <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("IntegrationDetailPage Clover branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseIntegrationDetailData.mockReturnValue(buildCloverDetailState());
  });

  it("renders the Clover-specific webhook and automation panels", () => {
    renderPage();

    expect(screen.getByText("Webhook Configuration")).toBeTruthy();
    expect(
      screen.getByText(
        /Clover webhooks are configured at the app level, not per merchant/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Sync only")).toBeTruthy();
    expect(screen.getByText("Setup Wizard Completed")).toBeTruthy();
    expect(screen.getByText("Not completed")).toBeTruthy();
    expect(screen.getByText("Order Pipeline")).toBeTruthy();
    expect(screen.getAllByText("Partial").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Loyalty Events")).toBeTruthy();
    expect(screen.getByText("Not available")).toBeTruthy();
    expect(
      screen.getByText(
        /Some Clover automation behaviors are provisionally implemented/i,
      ),
    ).toBeTruthy();
  });

  it("shows the Clover-specific dropdown actions and disconnect confirmation", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    expect(screen.getByText("Trigger manual sync")).toBeTruthy();
    expect(screen.getByText("Run connection test")).toBeTruthy();
    expect(screen.getByText("View sync logs")).toBeTruthy();
    expect(screen.getByText("Copy merchant ID")).toBeTruthy();
    expect(
      screen.getAllByText("Disconnect Clover").length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByText("Disconnect Clover")[0]);

    expect(screen.getByText("Disconnect Clover?")).toBeTruthy();
    expect(
      screen.getAllByText(
        /Disconnecting Clover will stop all sync and real-time event processing/i,
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Remove Clover connection")).toBeTruthy();
  });
});
