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

function buildLightspeedDetailState() {
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
      canDisconnect: true,
    },
    targetPath: "/integrations/lightspeed/guide",
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
    triggerLightspeedSync: vi.fn(),
    isLightspeedSyncing: false,
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

  it("renders the Lightspeed-specific webhook and store panels", () => {
    renderPage();

    expect(screen.getByText("Store Details")).toBeTruthy();
    expect(screen.getByText("Webhook Configuration")).toBeTruthy();
    expect(
      screen.getByText(/Lightspeed webhook support varies by account/i),
    ).toBeTruthy();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("bloom-store.retail.lightspeed.app")).toBeTruthy();
    expect(screen.getByText("Data Pipeline")).toBeTruthy();
    expect(screen.queryByText(/Retailer ID/i)).toBeNull();
  });

  it("shows Lightspeed actions, opens the store URL, navigates to diagnostics, and renders disconnect copy", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    expect(screen.getByText("Trigger manual sync")).toBeTruthy();
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

    expect(screen.getByText("Disconnect Lightspeed?")).toBeTruthy();
    expect(
      screen.getAllByText(
        /Disconnecting Lightspeed will stop sync and any available webhook processing/i,
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Remove Lightspeed connection")).toBeTruthy();

    windowOpenSpy.mockRestore();
  });
});
