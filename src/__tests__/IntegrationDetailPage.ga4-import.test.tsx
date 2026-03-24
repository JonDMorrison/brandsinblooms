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

function buildBaseState(
  slug: string,
  itemOverrides: Record<string, unknown>,
  modelOverrides: Record<string, unknown>,
) {
  const seed = getIntegrationSeed(slug);

  if (!seed) {
    throw new Error(`Expected integration seed for ${slug}`);
  }

  const item = {
    ...seed,
    ...itemOverrides,
  };

  const model = buildIntegrationDetailModel({
    item,
    status: item.status as "available" | "connected" | "coming-soon",
    contextLabel: item.metaLabel as string,
    connectedAt: (item.connectedSince as string | undefined) ?? null,
    lastSyncAt: null,
    lastActivityAt: null,
    hasWebhookMonitoring: false,
    syncSummary: "",
    serviceStateLabel: item.status === "connected" ? "Connected" : "Available",
    canDisconnect: true,
    ...modelOverrides,
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
    targetPath: item.targetPath,
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
    triggerMetaReauthorization: vi.fn(),
    isMetaReauthorizing: false,
    refreshMetaAssets: vi.fn(),
    isRefreshingMetaAssets: false,
    triggerGa4ConnectionTest: vi.fn().mockResolvedValue(undefined),
    isGa4ConnectionTesting: false,
    triggerGa4Reauthorization: vi.fn().mockResolvedValue(undefined),
    isGa4Reauthorizing: false,
    disconnect: vi.fn().mockResolvedValue(undefined),
    isDisconnecting: false,
  };
}

function buildGa4State() {
  const state = buildBaseState(
    "google-analytics-4",
    {
      status: "connected",
      connectedSince: "2026-03-20T10:00:00.000Z",
      metaLabel: "Property 123456789",
      targetPath: "/integrations/website",
    },
    {
      contextLabel: "Property 123456789",
      verificationAt: "2026-03-22T12:00:00.000Z",
      lastActivityAt: "2026-03-22T12:00:00.000Z",
      syncSummary: "Service account configured",
      serviceStateLabel: "Connected",
    },
  );

  return {
    ...state,
    ga4Detail: {
      connectionId: "ga4-1",
      propertyId: "123456789",
      propertyLabel: "Property 123456789",
      connectionStatus: "connected",
      connectionLabel: "Connected",
      serviceAccountConfigured: true,
      lastTestAt: "2026-03-22T12:00:00.000Z",
      connectedAt: "2026-03-20T10:00:00.000Z",
      updatedAt: "2026-03-22T12:00:00.000Z",
      reportingPath: "/integrations/website",
      managementPath: "/integrations/website",
      reportingSummary:
        "Website analytics reporting is available from the Website integrations page.",
      canDisconnect: true,
    },
  };
}

function buildMailchimpState() {
  const state = buildBaseState(
    "mailchimp",
    {
      status: "connected",
      connectedSince: "2026-03-18T10:00:00.000Z",
      metaLabel: "Bloom Newsletter",
      targetPath: "/integrations/migrations?provider=mailchimp",
    },
    {
      contextLabel: "Bloom Newsletter",
      lastActivityAt: "2026-03-23T09:30:00.000Z",
      syncSummary: "420 contacts imported • 3 segments created • 0 errors",
      serviceStateLabel: "Connected",
    },
  );

  return {
    ...state,
    marketingImportDetail: {
      provider: "mailchimp",
      providerLabel: "Mailchimp",
      providerDescription:
        "Import audiences, tags, and list structure from Mailchimp.",
      connectionId: "mailchimp-1",
      accountName: "Bloom Newsletter",
      accountId: "acct-123",
      contactEmail: "owner@example.com",
      connectionStatus: "connected",
      connectionLabel: "Connected",
      connectedAt: "2026-03-18T10:00:00.000Z",
      updatedAt: "2026-03-23T09:30:00.000Z",
      tokenExpiresAt: null,
      listCount: 4,
      segmentCount: 3,
      latestImportId: "job-1",
      latestImportStatus: "completed",
      latestImportStartedAt: "2026-03-23T09:00:00.000Z",
      latestImportCompletedAt: "2026-03-23T09:30:00.000Z",
      latestImportSummary:
        "420 contacts imported • 3 segments created • 0 errors",
      importFlowPath: "/integrations/migrations?provider=mailchimp",
      previewListsPath:
        "/integrations/migrations?provider=mailchimp&step=choose",
      purposeLabel: "Contact Import",
      liveSyncLabel: "Not available",
      capabilities: [
        "Preview available audiences before importing",
        "Start one-time contact imports into BloomSuite",
        "Preserve list and segment structure for review",
      ],
      canDisconnect: true,
    },
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
  );
}

function renderPage(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
        <Route
          path="/integrations/website"
          element={<div>Website Integrations</div>}
        />
        <Route
          path="/integrations/migrations"
          element={<div>Migration Wizard</div>}
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("IntegrationDetailPage GA4 and marketing-import branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the GA4 panels and actions", async () => {
    const state = buildGa4State();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage("/integrations/google-analytics-4");

    expect(screen.getByText("Property Details")).toBeTruthy();
    expect(screen.getByText("Reporting Capabilities")).toBeTruthy();
    expect(screen.getByText("Connection Actions")).toBeTruthy();
    expect(screen.getByText("Property 123456789")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    expect(
      screen.getAllByText("Test Connection").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Re-authorize Google Analytics").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("View Reporting Dashboard").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Disconnect Google Analytics").length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByText("Test Connection")[0]);
    expect(state.triggerGa4ConnectionTest).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByText("View Reporting Dashboard")[0]);

    await waitFor(() => {
      expect(screen.getByText("Website Integrations")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/website",
      );
    });
  });

  it("renders marketing-import badges, panels, and routes actions to the migration wizard", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());

    renderPage("/integrations/mailchimp");

    expect(screen.getByText("Connection Details")).toBeTruthy();
    expect(screen.getByText("Import Capabilities")).toBeTruthy();
    expect(screen.getByText("Import Actions")).toBeTruthy();
    expect(screen.getByText("Purpose: Contact Import")).toBeTruthy();
    expect(screen.getByText("Live Sync: Not available")).toBeTruthy();
    expect(screen.getByText("Bloom Newsletter")).toBeTruthy();
    expect(
      screen.getAllByText(
        "420 contacts imported • 3 segments created • 0 errors",
      ).length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "Open Import Flow" }));

    await waitFor(() => {
      expect(screen.getByText("Migration Wizard")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/migrations?provider=mailchimp",
      );
    });
  });
});
