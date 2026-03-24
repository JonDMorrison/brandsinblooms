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

function buildEmailInfrastructureState() {
  const seed = getIntegrationSeed("email-infrastructure");

  if (!seed) {
    throw new Error("Expected Email Infrastructure integration seed to exist.");
  }

  const item = {
    ...seed,
    status: "connected" as const,
    connectedSince: "2026-03-20T10:00:00.000Z",
    metaLabel: "bloomflowers.co",
  };

  const model = buildIntegrationDetailModel({
    item,
    status: item.status,
    contextLabel: "bloomflowers.co",
    connectedAt: item.connectedSince,
    verificationAt: "2026-03-21T11:00:00.000Z",
    lastActivityAt: "2026-03-22T14:00:00.000Z",
    syncSummary: "Domains 2 • Verified 1 • Sent 24h 184",
    serviceStateLabel: "Connected",
    configurationHint:
      "Managed with Entri keeps BloomSuite pointed at bloomflowers.co for sending, DNS verification, and warmup controls.",
    activityHint:
      "Tenant reputation is 93 with 184 emails sent in the last 24 hours.",
    canDisconnect: false,
  });

  return {
    isValidSlug: true,
    item,
    model,
    comingSoonDetail: null,
    squareDetail: null,
    cloverDetail: null,
    lightspeedDetail: null,
    metaDetail: null,
    ga4Detail: null,
    marketingImportDetail: null,
    emailInfrastructureDetail: {
      badgeLabel: "Infrastructure",
      badgeTone: "neutral" as const,
      metadata: [
        "Category: Infrastructure",
        "Domain: bloomflowers.co",
        "Status: Connected",
        "Provider: Cloudflare",
      ],
      primaryDomainId: "domain-1",
      primaryDomain: "bloomflowers.co",
      primaryStatus: "active",
      primaryStatusLabel: "Connected",
      providerLabel: "Cloudflare",
      providerModeLabel: "Managed with Cloudflare",
      domainCount: 2,
      verifiedDomainCount: 1,
      dnsRecordCount: 3,
      dnsVerifiedCount: 2,
      latestHealthCheckAt: "2026-03-22T14:00:00.000Z",
      healthCheckStatus: "healthy" as const,
      healthCheckLabel: "Healthy",
      reputationScore: 93,
      reputationTier: "Strong",
      trendDirection: "up" as const,
      sent24h: 184,
      delivered24h: 180,
      bounceRate24h: 1.2,
      complaintRate24h: 0.2,
      sent30d: 4320,
      deliveryRate30d: 98.1,
      bounceRate30d: 1.4,
      dailySentCount: 184,
      dailyLimit: 500,
      warmupStage: 3,
      healthyDaysCounter: 12,
      verifiedAt: "2026-03-21T11:00:00.000Z",
      lastVerifyAttemptAt: "2026-03-22T10:00:00.000Z",
      lastError: null,
      readinessSummary:
        "bloomflowers.co is currently connected with 2/3 DNS records verified.",
      configurationSummary:
        "Managed with Cloudflare keeps BloomSuite pointed at bloomflowers.co for sending, DNS verification, and warmup controls.",
      healthSummary:
        "Tenant reputation is 93 with 184 emails sent in the last 24 hours.",
      domainConnectSummary:
        "Automatic DNS management is available through Cloudflare.",
      dnsRecords: [
        {
          id: "dns-1",
          name: "bloomflowers.co",
          type: "TXT",
          value: "v=spf1 include:resend.email ~all",
          purpose: "spf",
          required: true,
          verified: true,
          lastCheckedAt: "2026-03-22T14:00:00.000Z",
        },
        {
          id: "dns-2",
          name: "selector1._domainkey.bloomflowers.co",
          type: "CNAME",
          value: "selector1.domainkey.resend.email",
          purpose: "dkim",
          required: true,
          verified: false,
          lastCheckedAt: "2026-03-22T14:00:00.000Z",
        },
      ],
      domainSettingsPath: "/domains",
      emailSettingsPath: "/crm/settings/email-sending",
      dnsRecordsPath: "/domains",
      sendingLogsPath: "/activity?q=email",
      supportPath:
        "mailto:support@bloomsuite.app?subject=Email%20Infrastructure%20Support",
      canRunHealthCheck: true,
    },
    targetPath: "/domains",
    requestPath: undefined,
    canUseActions: true,
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
    triggerMetaReauthorization: vi.fn(),
    isMetaReauthorizing: false,
    refreshMetaAssets: vi.fn(),
    isRefreshingMetaAssets: false,
    triggerGa4ConnectionTest: vi.fn(),
    isGa4ConnectionTesting: false,
    triggerGa4Reauthorization: vi.fn(),
    isGa4Reauthorizing: false,
    disconnect: vi.fn(),
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
    <MemoryRouter initialEntries={["/integrations/email-infrastructure"]}>
      <Routes>
        <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
        <Route path="/domains" element={<div>Domains Route</div>} />
        <Route path="/activity" element={<div>Activity Route</div>} />
        <Route
          path="/crm/settings/email-sending"
          element={<div>Email Settings Route</div>}
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("IntegrationDetailPage email infrastructure branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the infrastructure badge, panels, and no danger zone", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildEmailInfrastructureState(),
    );

    renderPage();

    expect(screen.getAllByText("Infrastructure").length).toBeGreaterThan(0);
    expect(screen.getByText("Domain Configuration")).toBeTruthy();
    expect(screen.getByText("DNS Record Status")).toBeTruthy();
    expect(screen.getByText("Sending Infrastructure Health")).toBeTruthy();
    expect(screen.getByText("Domain Connect & Setup Tools")).toBeTruthy();
    expect(screen.queryByText("Danger Zone")).toBeNull();
    expect(screen.queryByText("Webhook Health")).toBeNull();
  });

  it("runs health checks and routes actions to existing destinations", async () => {
    const state = buildEmailInfrastructureState();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    fireEvent.click(screen.getAllByText("Run Health Check")[0]);
    expect(state.runEmailInfrastructureHealthCheck).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getAllByText("View Sending Logs")[0]);

    await waitFor(() => {
      expect(screen.getByText("Activity Route")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/activity?q=email",
      );
    });
  });

  it("routes DNS-record actions into the existing domain settings flow", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildEmailInfrastructureState(),
    );

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getAllByText("View DNS Records")[0]);

    await waitFor(() => {
      expect(screen.getByText("Domains Route")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe("/domains");
    });
  });
});
