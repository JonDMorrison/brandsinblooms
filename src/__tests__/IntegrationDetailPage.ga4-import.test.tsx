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
    lightspeedSyncJobs: [],
    lightspeedSyncState: "idle",
    lightspeedTrackedJobIds: [],
    lightspeedRealtimeActive: false,
    canAccessLightspeedAdminFeatures: false,
    triggerMetaReauthorization: vi.fn(),
    isMetaReauthorizing: false,
    refreshMetaAssets: vi.fn(),
    isRefreshingMetaAssets: false,
    triggerGa4ConnectionTest: vi.fn().mockResolvedValue(undefined),
    isGa4ConnectionTesting: false,
    triggerGa4Reauthorization: vi.fn().mockResolvedValue(undefined),
    isGa4Reauthorizing: false,
    validateMarketingImportConnection: vi.fn().mockResolvedValue(undefined),
    isValidatingMarketingImportConnection: false,
    disconnect: vi.fn().mockResolvedValue(undefined),
    isDisconnecting: false,
  };
}

function buildGa4State() {
  const state = buildBaseState(
    "google-analytics",
    {
      status: "connected",
      connectedSince: "2026-03-20T10:00:00.000Z",
      metaLabel: "Bloom GA4 Property",
      targetPath: "/integrations/website",
    },
    {
      contextLabel: "Bloom GA4 Property",
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
      tenantId: "tenant-1",
      propertyId: "123456789",
      propertyName: "Bloom GA4 Property",
      measurementId: "G-BLOOM123",
      googleAccountEmail: "analytics@bloom.test",
      propertyLabel: "Property 123456789",
      connectionStatus: "connected",
      connectionLabel: "Connected",
      authorizationLabel: "Authorized",
      readPermissionsConfirmed: true,
      reportingStatus:
        "Website analytics reporting is available from the Website integrations page.",
      serviceAccountConfigured: true,
      lastTestAt: "2026-03-22T12:00:00.000Z",
      lastTestStatus: "success",
      lastTestMessage: "Property accessible · Sessions data available",
      lastPullAt: "2026-03-23T07:00:00.000Z",
      latestConnectionTest: {
        status: "success",
        message: "Property accessible · Sessions data available",
        testedAt: "2026-03-22T12:00:00.000Z",
      },
      connectedAt: "2026-03-20T10:00:00.000Z",
      updatedAt: "2026-03-22T12:00:00.000Z",
      reportingPath: "/integrations/website",
      managementPath: "/integrations/website",
      reportingSummary:
        "Website analytics reporting is available from the Website integrations page.",
      analyticsUrl:
        "https://analytics.google.com/analytics/web/#/p123456789/reports/intelligenthome",
      canDisconnect: true,
    },
  };
}

function buildMarketingImportDetail(
  provider: "mailchimp" | "klaviyo" | "constant_contact",
  overrides: Record<string, unknown> = {},
) {
  const baseLabel =
    provider === "mailchimp"
      ? "Mailchimp"
      : provider === "klaviyo"
        ? "Klaviyo"
        : "Constant Contact";
  const providerSlug =
    provider === "constant_contact" ? "constant-contact" : provider;

  return {
    provider,
    providerSlug,
    providerLabel: baseLabel,
    providerDescription: `Import data from ${baseLabel}.`,
    connectionId: `${provider}-1`,
    accountName: `Bloom ${baseLabel}`,
    accountId: `acct-${provider}`,
    contactEmail: `${provider}@example.com`,
    connectionStatus: "connected",
    connectionLabel: "Connected",
    connectedAt: "2026-03-18T10:00:00.000Z",
    updatedAt: "2026-03-23T09:30:00.000Z",
    tokenExpiresAt: provider === "klaviyo" ? null : "2026-04-01T10:00:00.000Z",
    listCount: 4,
    segmentCount: provider === "constant_contact" ? 0 : 3,
    latestImportId: `job-${provider}`,
    latestImportStatus: "completed",
    latestImportStartedAt: "2026-03-23T09:00:00.000Z",
    latestImportCompletedAt: "2026-03-23T09:30:00.000Z",
    latestImportSummary:
      "420 contacts imported • 3 segments created • 0 errors",
    latestImportReport: {
      contactsImported: 420,
      contactsSkipped: 10,
      contactsFailed: 0,
      segmentsCreated: 3,
      tagsCreated: 6,
      consentsRecorded: 420,
      errors: [],
      batchesProcessed: 5,
    },
    latestCompletedImport: {
      id: `job-${provider}`,
      startedAt: "2026-03-23T09:00:00.000Z",
      completedAt: "2026-03-23T09:30:00.000Z",
      status: "completed",
      contactsImported: 420,
      segmentsCreated: 3,
      errorCount: 0,
      durationSeconds: 1800,
    },
    importHistory: [
      {
        id: `job-${provider}`,
        startedAt: "2026-03-23T09:00:00.000Z",
        completedAt: "2026-03-23T09:30:00.000Z",
        status: "completed",
        contactsImported: 420,
        segmentsCreated: 3,
        errorCount: 0,
        durationSeconds: 1800,
      },
    ],
    latestImportLabel: "Completed",
    latestImportTone: "success",
    contactsImportedAllTime: 420,
    importJobCount: 2,
    importFlowPath: `/integrations/migrations?provider=${provider}`,
    previewListsPath: `/integrations/migrations?provider=${provider}&step=choose`,
    purposeLabel: "Contact Import",
    liveSyncLabel: "Not available",
    importOnlyLabel: "Import only",
    connectionState: {
      label:
        provider === "klaviyo"
          ? "Validated"
          : provider === "mailchimp"
            ? "Connected"
            : "Connected",
      subtitle:
        provider === "klaviyo"
          ? "Stored credential is ready for list previews and one-time imports"
          : provider === "mailchimp"
            ? "Mailchimp authorization is active for previews and one-time or periodic imports."
            : "Stored authorization is ready for list previews and one-time imports",
      tone: "success",
      valueClassName: "text-emerald-600",
    },
    authorizationLabel:
      provider === "mailchimp"
        ? "Connected"
        : provider === "klaviyo"
          ? "API key configured"
          : "OAuth authorization active",
    authorizationSummary:
      provider === "klaviyo"
        ? "Klaviyo credentials are stored securely for preview and import flows. The raw API key is never shown from this page."
        : provider === "mailchimp"
          ? "Mailchimp is connected and ready for previews and imports."
          : `${baseLabel} authorization is active for previews and one-time imports.`,
    authorizationModelLabel:
      provider === "klaviyo" ? "API key connection" : "OAuth authorization",
    healthRows: {
      authorization:
        provider === "mailchimp"
          ? [
              {
                label: "Status",
                value: "Connected",
                tone: "success",
              },
              {
                label: "Connected since",
                value: "Connected",
                timestamp: "2026-03-18T10:00:00.000Z",
                tone: "success",
              },
              {
                label: "Mailchimp account",
                value: "Bloom Mailchimp",
                tone: "neutral",
              },
            ]
          : [
              {
                label:
                  provider === "klaviyo"
                    ? "API key connection"
                    : "OAuth authorization",
                value:
                  provider === "klaviyo"
                    ? "API key configured"
                    : "OAuth authorization active",
                tone: "success",
              },
            ],
      importHistory:
        provider === "mailchimp"
          ? [
              {
                label: "Status",
                value: "420 contacts imported",
                tone: "success",
              },
              {
                label: "Last import",
                value: "Import recorded",
                timestamp: "2026-03-23T09:30:00.000Z",
                tone: "success",
              },
              {
                label: "Total contacts",
                value: "420",
                tone: "success",
              },
            ]
          : [
              {
                label: "Latest Import",
                value: "Completed",
                tone: "success",
              },
            ],
    },
    timeline: [
      {
        key: `${provider}-connected`,
        label: `${baseLabel} connected`,
        timestamp: "2026-03-18T10:00:00.000Z",
        tone: "success",
      },
    ],
    connectionDetailsRows: [
      ...(provider === "mailchimp"
        ? [
            {
              label: "Authorization Status",
              value: "Connected",
              description:
                "Mailchimp authorization is active for previews and one-time or periodic imports.",
              tone: "success",
              valueClassName: "text-emerald-600",
            },
            {
              label: "Mailchimp Account",
              value: "Bloom Mailchimp",
            },
            {
              label: "Connected Since",
              value: "2026-03-18T10:00:00.000Z",
            },
          ]
        : [
            {
              label: "Provider",
              value: baseLabel,
            },
            {
              label: "Authorization",
              value: provider === "klaviyo" ? "Validated" : "Authorized",
              description:
                provider === "klaviyo"
                  ? "Stored credential is ready for list previews and one-time imports"
                  : "Stored authorization is ready for list previews and one-time imports",
              tone: "success",
              valueClassName: "text-emerald-600",
            },
            {
              label: "Connected Since",
              value: "2026-03-18T10:00:00.000Z",
            },
          ]),
      ...(provider === "klaviyo"
        ? [
            {
              label: "Credential Type",
              value: "API key",
              description:
                "Stored securely for import workflows. The raw API key is never displayed here.",
              tone: "success",
            },
          ]
        : [
            {
              label: "Token Expiry",
              value: "2026-04-01T10:00:00.000Z",
              tone: "neutral",
            },
          ]),
    ],
    capabilityRows:
      provider === "klaviyo"
        ? [
            {
              label: "SMS Consent",
              value: "Supported",
              description:
                "Klaviyo SMS consent can be imported alongside profile data when present.",
              tone: "success",
            },
          ]
        : provider === "constant_contact"
          ? [
              {
                label: "Event Registrations",
                value: "Unavailable",
                description:
                  "Event registration data is not imported from Constant Contact in this workflow.",
                tone: "neutral",
              },
              {
                label: "Survey Responses",
                value: "Unavailable",
                description:
                  "Survey response data is not imported from Constant Contact in this workflow.",
                tone: "neutral",
              },
            ]
          : [
              {
                label: "Contacts",
                value: "Available to import",
                tone: "success",
              },
              { label: "Tags", value: "Available to import", tone: "success" },
              {
                label: "Lists & Audiences",
                value: "Available to import",
                tone: "success",
              },
              {
                label: "Segments",
                value: "Available to import",
                tone: "success",
              },
              {
                label: "Consent status",
                value: "Available to import",
                tone: "success",
              },
              {
                label: "Groups / Interests",
                value: "Available to import",
                tone: "success",
              },
              { label: "Live sync", value: "Not available", tone: "neutral" },
            ],
    supportsRevokeToken: provider !== "klaviyo",
    supportsValidateConnection: provider === "klaviyo",
    dangerZone: {
      title: `Disconnect ${baseLabel}`,
      description:
        provider === "mailchimp"
          ? "Remove BloomSuite's access to your Mailchimp account and stop future Mailchimp imports."
          : `Disconnect ${baseLabel} by removing the stored authorization used for import previews and one-time imports.`,
      confirmDescription:
        provider === "mailchimp"
          ? "Disconnecting Mailchimp revokes the saved authorization, clears cached list and segment data, and prevents future previews or imports until Mailchimp is connected again."
          : `Disconnecting ${baseLabel} stops future previews and imports until the provider is connected again.`,
      bullets:
        provider === "mailchimp"
          ? [
              "Remove BloomSuite's access to your Mailchimp account",
              "Prevent future imports from Mailchimp",
              "Clear cached list and segment data",
            ]
          : [
              "Future list previews will stop until the provider is connected again.",
              "New one-time imports cannot be started while the connection is removed.",
              "Previously imported CRM records are not deleted from BloomSuite.",
            ],
      safetyNote:
        provider === "mailchimp"
          ? "Previously imported contacts remain in your BloomSuite CRM. Your Mailchimp account is not affected."
          : "Previously imported CRM records remain in BloomSuite after the connection is removed.",
    },
    capabilities: [
      "Preview available audiences before importing",
      "Start one-time contact imports into BloomSuite",
    ],
    capabilitiesNote:
      provider === "mailchimp"
        ? "Mailchimp is available for one-time or periodic import, not live two-way sync."
        : null,
    canDisconnect: true,
    ...overrides,
  };
}

function buildMailchimpState() {
  const state = buildBaseState(
    "mailchimp",
    {
      status: "connected",
      connectedSince: "2026-03-18T10:00:00.000Z",
      metaLabel: "Bloom Newsletter",
      targetPath: "/integrations/mailchimp",
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
    marketingImportDetail: buildMarketingImportDetail("mailchimp", {
      providerDescription:
        "Import audiences, tags, and list structure from Mailchimp.",
      accountName: "Bloom Newsletter",
      accountId: "acct-123",
      contactEmail: "owner@example.com",
      tokenExpiresAt: null,
      importFlowPath: "/integrations/migrations?provider=mailchimp",
      previewListsPath:
        "/integrations/migrations?provider=mailchimp&step=choose",
    }),
  };
}

function buildKlaviyoState() {
  const state = buildBaseState(
    "klaviyo",
    {
      status: "connected",
      connectedSince: "2026-03-18T10:00:00.000Z",
      metaLabel: "Bloom Klaviyo",
      targetPath: "/integrations/migrations?provider=klaviyo",
    },
    {
      contextLabel: "Bloom Klaviyo",
      lastActivityAt: "2026-03-23T09:30:00.000Z",
      syncSummary: "420 contacts imported • 3 segments created • 0 errors",
      serviceStateLabel: "Connected",
    },
  );

  return {
    ...state,
    marketingImportDetail: buildMarketingImportDetail("klaviyo", {
      importFlowPath: "/integrations/migrations?provider=klaviyo",
      previewListsPath: "/integrations/migrations?provider=klaviyo&step=choose",
    }),
  };
}

function buildConstantContactState() {
  const state = buildBaseState(
    "constant-contact",
    {
      status: "connected",
      connectedSince: "2026-03-18T10:00:00.000Z",
      metaLabel: "Bloom Constant Contact",
      targetPath: "/integrations/migrations?provider=constant_contact",
    },
    {
      contextLabel: "Bloom Constant Contact",
      lastActivityAt: "2026-03-23T09:30:00.000Z",
      syncSummary: "420 contacts imported • 3 segments created • 0 errors",
      serviceStateLabel: "Connected",
    },
  );

  return {
    ...state,
    marketingImportDetail: buildMarketingImportDetail("constant_contact", {
      importFlowPath: "/integrations/migrations?provider=constant_contact",
      previewListsPath:
        "/integrations/migrations?provider=constant_contact&step=choose",
    }),
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

    renderPage("/integrations/google-analytics");

    expect(screen.getByText("Property Details")).toBeTruthy();
    expect(screen.getByText("Reporting Capabilities")).toBeTruthy();
    expect(screen.getByText("Connection Test")).toBeTruthy();
    expect(
      screen.getAllByText("Bloom GA4 Property").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("G-BLOOM123").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    expect(
      screen.getAllByText(/Run connection test/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Re-authorize/i).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      screen.getAllByText("View Reporting Dashboard").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Disconnect Google Analytics").length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByText(/Run connection test/i)[0]);
    expect(state.triggerGa4ConnectionTest).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByText("View Reporting Dashboard")[0]);

    await waitFor(() => {
      expect(screen.getByText("Website Integrations")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/website",
      );
    });
  });

  it("renders updated GA4 disconnect copy", () => {
    const state = buildGa4State();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage("/integrations/google-analytics");

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getAllByText("Disconnect Google Analytics")[0]);

    expect(screen.getByText("Disconnect Google Analytics?")).toBeTruthy();
    expect(
      screen.getAllByText(
        /Disconnecting Google Analytics removes the stored GA4 property settings for this tenant/i,
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Remove Google Analytics connection")).toBeTruthy();
  });

  it("renders Mailchimp import parity panels and routes start import to the migration wizard", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());

    renderPage("/integrations/mailchimp");

    expect(screen.getByText("Import only")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Authorization" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Import History" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Recent Imports" }),
    ).toBeTruthy();
    expect(screen.getByText("Connection Details")).toBeTruthy();
    expect(screen.getByText("Import Capabilities")).toBeTruthy();
    expect(screen.getByText("Import Actions")).toBeTruthy();
    expect(screen.getByText("Live Sync: Not available")).toBeTruthy();
    expect(screen.getByText("Contacts Imported")).toBeTruthy();
    expect(screen.getByText("Revoke Token")).toBeTruthy();
    expect(screen.getByText("Segments")).toBeTruthy();
    expect(
      screen.getByText(
        "Mailchimp is available for one-time or periodic import, not live two-way sync.",
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText("420 contacts imported").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Webhook Health")).toBeNull();
    expect(screen.queryByText("Sync Health")).toBeNull();
    expect(screen.getByText("Last Import")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start Import" }));

    await waitFor(() => {
      expect(screen.getByText("Migration Wizard")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/migrations?provider=mailchimp",
      );
    });
  });

  it("renders Klaviyo-specific validation and capability content", () => {
    const state = buildKlaviyoState();
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage("/integrations/klaviyo");

    expect(screen.getByText("Validate Connection")).toBeTruthy();
    expect(screen.getByText("SMS Consent")).toBeTruthy();
    expect(screen.getByText("API key")).toBeTruthy();
    expect(screen.queryByText("Revoke Token")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Validate Connection" }),
    );
    expect(state.validateMarketingImportConnection).toHaveBeenCalledTimes(1);
  });

  it("routes Constant Contact actions using the provider key while rendering the slugged detail page", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildConstantContactState());

    renderPage("/integrations/constant-contact");

    expect(screen.getByText("Event Registrations")).toBeTruthy();
    expect(screen.getByText("Survey Responses")).toBeTruthy();
    expect(screen.getByText("Revoke Token")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start Import" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/migrations?provider=constant_contact",
      );
    });
  });
});
