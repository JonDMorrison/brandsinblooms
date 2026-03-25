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

function buildMetaDetailState(options?: {
  authorizationStatus?: "authorized" | "expired" | "not-connected";
  canDisconnect?: boolean;
}) {
  const seed = getIntegrationSeed("meta");

  if (!seed) {
    throw new Error("Expected Meta integration seed to exist.");
  }

  const authorizationStatus = options?.authorizationStatus ?? "authorized";
  const isAuthorized = authorizationStatus === "authorized";
  const hasAssets = authorizationStatus !== "not-connected";
  const connectedAt = hasAssets ? "2026-03-20T10:00:00.000Z" : null;
  const lastActivityAt = hasAssets ? "2026-03-22T12:00:00.000Z" : null;
  const expiresAt =
    authorizationStatus === "not-connected"
      ? null
      : authorizationStatus === "expired"
        ? "2026-03-21T10:00:00.000Z"
        : "2026-04-20T10:00:00.000Z";

  const item = {
    ...seed,
    status: isAuthorized ? ("connected" as const) : ("available" as const),
    connectedSince: connectedAt,
    metaLabel: hasAssets
      ? "Bloom Main Page • bloomflowers"
      : "Authorize Meta to connect Facebook and Instagram",
    targetPath: "/social-accounts",
  };

  const model = buildIntegrationDetailModel({
    item,
    status: item.status,
    contextLabel: hasAssets
      ? "Bloom Main Page • bloomflowers"
      : "Facebook and Instagram access",
    connectedAt,
    verificationAt: null,
    lastSyncAt: lastActivityAt,
    lastActivityAt,
    lastWebhookReceivedAt: null,
    hasWebhookMonitoring: false,
    syncSummary: hasAssets
      ? "1 Facebook page • 1 Instagram account"
      : "No Facebook Pages or Instagram Business accounts connected",
    serviceStateLabel:
      authorizationStatus === "authorized"
        ? "Authorized"
        : authorizationStatus === "expired"
          ? "Expired"
          : "Not connected",
    canDisconnect: options?.canDisconnect ?? hasAssets,
  });

  return {
    isValidSlug: true,
    item,
    model,
    comingSoonDetail: null,
    squareDetail: null,
    cloverDetail: null,
    lightspeedDetail: null,
    metaDetail: {
      authorizationStatus,
      authorizationLabel:
        authorizationStatus === "authorized"
          ? "Authorized"
          : authorizationStatus === "expired"
            ? "Expired"
            : "Not connected",
      providerLabel: "Meta OAuth",
      connectedAt,
      lastActivityAt,
      expiresAt,
      facebookPages: hasAssets
        ? [
            {
              id: "facebook-1",
              platform: "facebook" as const,
              active: true,
              name: "Bloom Main Page",
              externalId: "1234567890",
              secondaryLabel: "Facebook Page",
              connectedAt: "2026-03-20T10:00:00.000Z",
              lastActivityAt: "2026-03-22T12:00:00.000Z",
            },
          ]
        : [],
      instagramAccounts: hasAssets
        ? [
            {
              id: "instagram-1",
              platform: "instagram" as const,
              active: true,
              name: "Bloom Flowers",
              externalId: "9988776655",
              secondaryLabel: "Username @bloomflowers",
              connectedAt: "2026-03-20T10:00:00.000Z",
              lastActivityAt: "2026-03-22T12:00:00.000Z",
            },
          ]
        : [],
      facebookPageCount: hasAssets ? 1 : 0,
      instagramAccountCount: hasAssets ? 1 : 0,
      connectedAssetCount: hasAssets ? 2 : 0,
      totalAssetCount: hasAssets ? 2 : 0,
      connectedPlatforms: hasAssets ? ["facebook", "instagram"] : [],
      platformSummary: hasAssets
        ? "1 Facebook page • 1 Instagram account"
        : "No Facebook Pages or Instagram Business accounts connected",
      authorizationSummary: hasAssets
        ? "Meta authorization is active for the connected Facebook Pages and Instagram Business accounts."
        : "Authorize Meta to connect Facebook Pages and Instagram Business accounts for publishing and analytics.",
      scopes: [
        "pages_read_engagement",
        "pages_show_list",
        "instagram_basic",
        "read_insights",
      ],
      syncLogsPath: "/activity?type=publishing&q=meta",
      managementPath: "/social-accounts",
      canDisconnect: options?.canDisconnect ?? hasAssets,
    },
    targetPath: "/social-accounts",
    requestPath: undefined,
    canUseActions: true,
    emailInfrastructureDetail: null,
    canDisconnect: options?.canDisconnect ?? hasAssets,
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
    lightspeedSyncJobs: [],
    lightspeedSyncState: "idle",
    lightspeedTrackedJobIds: [],
    lightspeedRealtimeActive: false,
    canAccessLightspeedAdminFeatures: false,
    triggerMetaReauthorization: vi.fn().mockResolvedValue(undefined),
    isMetaReauthorizing: false,
    refreshMetaAssets: vi.fn().mockResolvedValue(undefined),
    isRefreshingMetaAssets: false,
    triggerGa4ConnectionTest: vi.fn().mockResolvedValue(undefined),
    isGa4ConnectionTesting: false,
    triggerGa4Reauthorization: vi.fn().mockResolvedValue(undefined),
    isGa4Reauthorizing: false,
    disconnect: vi.fn().mockResolvedValue(undefined),
    isDisconnecting: false,
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
  );
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/integrations/meta"]}>
      <Routes>
        <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
        <Route path="/activity" element={<div>Activity Route</div>} />
        <Route path="/social-accounts" element={<div>Social Accounts</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("IntegrationDetailPage Meta branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Meta-specific authorization and asset panels", () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMetaDetailState());

    renderPage();

    expect(screen.getByText("Meta Authorization")).toBeTruthy();
    expect(screen.getAllByText("Facebook Pages").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      screen.getAllByText("Instagram Accounts").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Publishing & Analytics Capabilities"),
    ).toBeTruthy();
    expect(screen.getAllByText("Authorized").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Bloom Main Page").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Bloom Flowers").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("1234567890").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("9988776655").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Meta actions and navigates to publishing logs", async () => {
    const state = buildMetaDetailState();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    expect(
      screen.getAllByText("Re-authorize Meta").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Refresh Asset List")).toBeTruthy();
    expect(
      screen.getAllByText("View Publishing Logs").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Disconnect Meta").length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByText("Re-authorize Meta")[0]);
    expect(state.triggerMetaReauthorization).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getAllByText("View Publishing Logs")[0]);

    await waitFor(() => {
      expect(screen.getByText("Activity Route")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/activity?type=publishing&q=meta",
      );
    });
  });

  it("renders Meta disconnect copy", () => {
    const state = buildMetaDetailState();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getAllByText("Disconnect Meta")[0]);

    expect(screen.getByText("Disconnect Meta?")).toBeTruthy();
    expect(
      screen.getAllByText(
        /Disconnecting Meta removes the shared authorization for this tenant/i,
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Remove Meta connection")).toBeTruthy();
  });

  it("renders the not-connected Meta state and exposes the authorize action", () => {
    const state = buildMetaDetailState({
      authorizationStatus: "not-connected",
      canDisconnect: false,
    });
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    expect(screen.getAllByText("Not connected").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("No Facebook Pages connected")).toBeTruthy();
    expect(screen.getByText("No Instagram accounts connected")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getAllByText("Authorize Meta")[0]);

    expect(state.triggerMetaReauthorization).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Disconnect Meta?")).toBeNull();
  });
});
