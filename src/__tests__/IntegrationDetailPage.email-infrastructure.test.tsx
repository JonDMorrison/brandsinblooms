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
      badgeLabel: "DNS healthy",
      badgeTone: "success" as const,
      metadata: [
        "Category: Infrastructure",
        "Domain: bloomflowers.co",
        "Status: Connected",
        "Provider: Cloudflare",
        "Environment: Production",
      ],
      primaryDomainId: "domain-1",
      primaryDomain: "bloomflowers.co",
      primaryStatus: "active",
      primaryStatusLabel: "Connected",
      environmentLabel: "Production",
      isSandbox: false,
      providerLabel: "Cloudflare",
      providerModeLabel: "Managed with Cloudflare",
      domainCount: 2,
      verifiedDomainCount: 1,
      dnsRecordCount: 3,
      dnsVerifiedCount: 1,
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
      banner: {
        tone: "warning" as const,
        title: "DNS verification still in progress",
        description:
          "BloomSuite can see the domain, but one or more required DNS records are still missing from public DNS results.",
      },
      readinessSummary:
        "bloomflowers.co is currently connected with 1/3 DNS records verified.",
      configurationSummary:
        "Managed with Cloudflare keeps BloomSuite pointed at bloomflowers.co for sending, DNS verification, and warmup controls.",
      healthSummary:
        "Tenant reputation is 93 with 184 emails sent in the last 24 hours.",
      domainConnectSummary:
        "Automatic DNS management is available through Cloudflare.",
      healthRows: {
        domain: [
          {
            label: "Primary Domain",
            value: "bloomflowers.co",
            tone: "success" as const,
          },
          {
            label: "Status",
            value: "Connected",
            tone: "success" as const,
          },
          {
            label: "Environment",
            value: "Production",
            tone: "neutral" as const,
          },
        ],
        dnsHealth: [
          { label: "SPF", value: "Verified", tone: "success" as const },
          { label: "DKIM", value: "Missing", tone: "warning" as const },
          { label: "DMARC", value: "Incorrect", tone: "danger" as const },
        ],
        sendingHealth: [
          { label: "Health Check", value: "Healthy", tone: "success" as const },
          {
            label: "Reputation",
            value: "93 • Strong",
            tone: "success" as const,
          },
          {
            label: "Delivery",
            value: "1.2% bounce • 0.2% complaint",
            tone: "success" as const,
          },
        ],
      },
      configurationRows: [
        {
          label: "Primary Domain",
          value: "bloomflowers.co",
          description: "Added Mar 20, 2026, 10:00 AM",
          tone: "success" as const,
          copyValue: "bloomflowers.co",
          copyLabel: "Primary domain",
        },
        {
          label: "Status",
          value: "Connected",
          description: "Production",
          tone: "success" as const,
        },
      ],
      protocolRows: [
        {
          label: "SPF",
          value: "Verified",
          description: "TXT bloomflowers.co",
          tone: "success" as const,
        },
        {
          label: "DKIM",
          value: "Missing",
          description: "CNAME selector1._domainkey.bloomflowers.co",
          tone: "warning" as const,
        },
        {
          label: "DMARC",
          value: "Incorrect",
          description: "TXT _dmarc.bloomflowers.co",
          tone: "danger" as const,
        },
      ],
      setupToolRows: [
        {
          label: "Domain Management",
          description:
            "Review domains, default sending settings, and DNS evidence.",
          path: "/domains",
          tone: "neutral" as const,
        },
        {
          label: "Domain Connect Setup",
          description:
            "Open the email sending setup flow and Domain Connect wizard.",
          path: "/crm/settings/email-sending",
          tone: "neutral" as const,
        },
        {
          label: "Sending Logs",
          description:
            "Inspect sending activity, recent failures, and delivery events.",
          path: "/activity?q=email",
          tone: "neutral" as const,
        },
      ],
      dnsRecords: [
        {
          id: "dns-1",
          name: "bloomflowers.co",
          type: "TXT",
          value: "v=spf1 include:resend.email ~all",
          purpose: "spf",
          required: true,
          verified: true,
          verificationState: "verified" as const,
          statusLabel: "Verified",
          statusTone: "success" as const,
          statusReason: "Public DNS matches the expected value",
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
          verificationState: "missing" as const,
          statusLabel: "Missing",
          statusTone: "warning" as const,
          statusReason: "Public DNS did not return the expected record",
          lastCheckedAt: "2026-03-22T14:00:00.000Z",
        },
        {
          id: "dns-3",
          name: "_dmarc.bloomflowers.co",
          type: "TXT",
          value: "v=DMARC1; p=none; rua=mailto:dmarc@bloomsuite.app",
          purpose: "dmarc",
          required: true,
          verified: false,
          verificationState: "incorrect" as const,
          statusLabel: "Incorrect",
          statusTone: "danger" as const,
          statusReason:
            "Public DNS found a record, but the value does not match",
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
    lightspeedSyncJobs: [],
    lightspeedSyncState: "idle",
    lightspeedActiveJobIds: [],
    lightspeedTrackedJobIds: [],
    lightspeedRealtimeActive: false,
    lightspeedHasStaleJobs: false,
    canAccessLightspeedAdminFeatures: false,
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

  it("renders the DNS-health badge, parity sections, and no danger zone", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildEmailInfrastructureState(),
    );

    renderPage();

    expect(screen.getAllByText("DNS healthy").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Run DNS Check" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /DNS Records/i })).toBeTruthy();
    expect(screen.getByText("Domain")).toBeTruthy();
    expect(screen.getByText("DNS Health")).toBeTruthy();
    expect(screen.getByText("Sending Health")).toBeTruthy();
    expect(screen.getByText("Domain Configuration")).toBeTruthy();
    expect(screen.getByText("SPF, DKIM, DMARC Status")).toBeTruthy();
    expect(screen.getByText("Setup Tools")).toBeTruthy();
    expect(screen.queryByText("Danger Zone")).toBeNull();
    expect(screen.queryByText("Webhook Health")).toBeNull();
  });

  it("runs DNS checks and routes sending-log actions to existing destinations", async () => {
    const state = buildEmailInfrastructureState();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    fireEvent.click(screen.getAllByText("Run DNS Check")[0]);
    expect(state.runEmailInfrastructureHealthCheck).toHaveBeenCalledTimes(1);

    const openButton = screen.getAllByRole("button", { name: "Open" })[2];

    if (!openButton) {
      throw new Error("Expected Sending Logs setup tool button.");
    }

    fireEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getByText("Activity Route")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/activity?q=email",
      );
    });
  });

  it("switches to the DNS Records tab without navigating away", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildEmailInfrastructureState(),
    );

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getAllByText("View DNS Records")[0]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "DNS Records" })).toBeTruthy();
      expect(screen.getByText("Purpose")).toBeTruthy();
      expect(screen.getByText("Host")).toBeTruthy();
      expect(screen.getByText("Value")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/email-infrastructure",
      );
    });

    expect(
      screen.getAllByRole("button", { name: /Copy DNS/i }).length,
    ).toBeGreaterThan(0);
  });
});
