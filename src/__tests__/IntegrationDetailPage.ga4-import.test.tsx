import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { buildIntegrationDetailModel } from "@/components/integrations/integrationDetailModel";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrationDetailData } from "@/hooks/useIntegrationDetailData";
import { useMailchimpImportProgress } from "@/hooks/useMailchimpImportProgress";
import {
  useMailchimpImportedCompliance,
  useMailchimpImportedCustomers,
  useMailchimpImportedDataSummary,
  useMailchimpImportedSegments,
  useMailchimpImportedTags,
  useMailchimpSegmentMembersPreview,
} from "@/hooks/useMailchimpImportedData";
import { useMailchimpSyncLogs } from "@/hooks/useMailchimpSyncLogs";
import MigrationsRouteGate from "@/pages/MigrationsRouteGate";
import IntegrationDetailPage from "@/pages/integrations/IntegrationDetailPage";

const { toastMock, functionsInvokeMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
  functionsInvokeMock: vi.fn(),
}));

vi.mock("@/hooks/useIntegrationDetailData", () => ({
  useIntegrationDetailData: vi.fn(),
}));

vi.mock("@/hooks/useMailchimpImportProgress", () => ({
  useMailchimpImportProgress: vi.fn(),
}));

vi.mock("@/hooks/useMailchimpSyncLogs", () => ({
  useMailchimpSyncLogs: vi.fn(),
}));

vi.mock("@/hooks/useMailchimpImportedData", () => ({
  useMailchimpImportedDataSummary: vi.fn(),
  useMailchimpImportedCustomers: vi.fn(),
  useMailchimpImportedSegments: vi.fn(),
  useMailchimpImportedTags: vi.fn(),
  useMailchimpImportedCompliance: vi.fn(),
  useMailchimpSegmentMembersPreview: vi.fn(),
  useMailchimpCompliancePage: vi.fn((rows: unknown[], page: number) => {
    const typedRows = rows as unknown[];
    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(typedRows.length / pageSize));
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * pageSize;

    return {
      rows: typedRows.slice(start, start + pageSize),
      pagination: {
        page: safePage,
        pageSize,
        totalCount: typedRows.length,
        totalPages,
      },
    };
  }),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => functionsInvokeMock(...args),
    },
  },
}));

vi.mock(
  "@/components/integrations/mailchimp/MailchimpImportOnboardingDialog",
  () => ({
    MailchimpImportOnboardingDialog: ({
      open,
      mode,
    }: {
      open: boolean;
      mode: "import" | "preview";
    }) =>
      open ? (
        <div data-testid="mailchimp-import-dialog">{`Mailchimp import dialog (${mode})`}</div>
      ) : null,
  }),
);

const mockedUseIntegrationDetailData = vi.mocked(useIntegrationDetailData);
const mockedUseMailchimpImportProgress = vi.mocked(useMailchimpImportProgress);
const mockedUseMailchimpSyncLogs = vi.mocked(useMailchimpSyncLogs);
const mockedUseMailchimpImportedDataSummary = vi.mocked(
  useMailchimpImportedDataSummary,
);
const mockedUseMailchimpImportedCustomers = vi.mocked(
  useMailchimpImportedCustomers,
);
const mockedUseMailchimpImportedSegments = vi.mocked(
  useMailchimpImportedSegments,
);
const mockedUseMailchimpImportedTags = vi.mocked(useMailchimpImportedTags);
const mockedUseMailchimpImportedCompliance = vi.mocked(
  useMailchimpImportedCompliance,
);
const mockedUseMailchimpSegmentMembersPreview = vi.mocked(
  useMailchimpSegmentMembersPreview,
);

function buildMailchimpImportProgressState(
  overrides: Record<string, unknown> = {},
) {
  return {
    jobId: null,
    status: null,
    progressPercentage: 0,
    currentStage: "Waiting for import progress...",
    fetchedRows: 0,
    insertedRows: 0,
    skippedRows: 0,
    failedRows: 0,
    estimatedCompletionAt: null,
    batchStats: null,
    errorDetails: null,
    report: null,
    isRunning: false,
    isCompleted: false,
    isFailed: false,
    isStale: false,
    lastUpdatedAt: null,
    loading: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function buildMailchimpSyncLogEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    status: "completed",
    createdAt: "2026-03-23T09:00:00.000Z",
    completedAt: "2026-03-23T09:08:00.000Z",
    updatedAt: "2026-03-23T09:08:00.000Z",
    progressPercentage: 100,
    currentStage: "Import finished",
    estimatedCompletionAt: null,
    fetchedRows: 500,
    insertedRows: 420,
    skippedRows: 70,
    failedRows: 10,
    currentPage: 4,
    totalPagesEstimate: 4,
    listIds: ["list-1"],
    segmentIds: ["segment-1"],
    scopeSummary: "1 list, 1 segment",
    resolvedLists: [{ id: "list-1", name: "Newsletter" }],
    resolvedSegments: [{ id: "segment-1", name: "VIP Customers" }],
    configEntries: [
      { key: "listIds", value: "list-1" },
      { key: "segmentIds", value: "segment-1" },
    ],
    batchStats: {
      total_batches: 4,
      completed_batches: 4,
      failed_batches: 0,
      contacts_per_batch: 125,
      estimated_total_rows: 500,
      total_scopes: 1,
    },
    report: {
      contacts_imported: 420,
      contacts_skipped: 70,
      contacts_failed: 10,
    },
    reportSummary: {
      contactsImported: 420,
      contactsSkipped: 70,
      contactsFailed: 10,
      segmentsCreated: 2,
      tagsCreated: 3,
      consentsRecorded: 420,
      batchesProcessed: 4,
      errors: [],
    },
    errorDetails: null,
    errorMessages: [],
    errorCount: 0,
    hasConnectionIssue: false,
    timeline: [
      {
        id: "job-1-created",
        label: "Job created",
        description: "The import job record was created and queued.",
        timestamp: "2026-03-23T09:00:00.000Z",
        state: "complete",
        derived: false,
      },
    ],
    hasExplicitBatchRows: false,
    explicitBatchRows: [],
    ...overrides,
  };
}

function buildMailchimpSyncLogsState(overrides: Record<string, unknown> = {}) {
  return {
    rows: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    totalCount: 0,
    loadMore: vi.fn(),
    refresh: vi.fn(),
    focusedJobExcluded: false,
    ...overrides,
  };
}

function buildMailchimpImportedDataSummaryState(
  overrides: Record<string, unknown> = {},
) {
  return {
    data: {
      totalCustomers: 12,
      totalSegments: 3,
      totalTags: 4,
      activeConsentRecords: 9,
      activeSuppressions: 2,
    },
    loading: false,
    error: null,
    ...overrides,
  };
}

function buildMailchimpImportedCustomersState(
  overrides: Record<string, unknown> = {},
) {
  return {
    data: {
      rows: [
        {
          id: "customer-1",
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Miller",
          phone: "+1 (555) 100-2000",
          importedAt: "2026-03-23T09:30:00.000Z",
          sourceId: "member-1",
          segments: [{ id: "segment-1", name: "VIP Customers" }],
          tags: [{ id: "tag-1", name: "Spring Promo" }],
          latestConsent: {
            id: "consent-1",
            customerId: "customer-1",
            email: "alice@example.com",
            channel: "email",
            status: "opted_in",
            statusLabel: "Subscribed",
            recordedAt: "2026-03-23T09:10:00.000Z",
          },
          activeSuppression: null,
          allSuppressions: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 25,
        totalCount: 1,
        totalPages: 1,
      },
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function buildMailchimpImportedSegmentsState(
  overrides: Record<string, unknown> = {},
) {
  return {
    data: [
      {
        id: "segment-1",
        name: "VIP Customers",
        sourceId: "list-1:segment-1",
        memberCount: 12,
        createdAt: "2026-03-21T09:00:00.000Z",
        parentListId: "list-1",
        parentListName: "Newsletter",
      },
    ],
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function buildMailchimpImportedTagsState(
  overrides: Record<string, unknown> = {},
) {
  return {
    data: [
      {
        id: "tag-1",
        name: "Spring Promo",
        createdAt: "2026-03-20T08:00:00.000Z",
        customerCount: 7,
      },
    ],
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function buildMailchimpImportedComplianceState(
  overrides: Record<string, unknown> = {},
) {
  return {
    data: {
      consentRows: [
        {
          id: "consent-1",
          customerId: "customer-1",
          email: "alice@example.com",
          channel: "email",
          status: "opted_in",
          statusLabel: "Subscribed",
          recordedAt: "2026-03-23T09:10:00.000Z",
        },
      ],
      suppressionRows: [
        {
          id: "suppression-1",
          customerId: "customer-2",
          email: "blocked@example.com",
          phone: null,
          channel: "email",
          reason: "unsubscribed",
          suppressedAt: "2026-03-23T09:05:00.000Z",
          active: true,
          suppressionType: "unsubscribed",
        },
      ],
      consentSummaryCards: [
        {
          key: "email:Subscribed",
          label: "email · Subscribed",
          value: 1,
        },
      ],
      activeConsentRecords: 1,
      activeSuppressions: 1,
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

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
    hasRunningImport: false,
    runningImportId: null,
    importFlowPath:
      provider === "mailchimp"
        ? "/integrations/mailchimp"
        : `/integrations/migrations?provider=${provider}`,
    previewListsPath:
      provider === "mailchimp"
        ? "/integrations/mailchimp"
        : `/integrations/migrations?provider=${provider}&step=choose`,
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
      importFlowPath: "/integrations/mailchimp",
      previewListsPath: "/integrations/mailchimp",
    }),
  };
}

function buildMailchimpReconnectState(
  status: "revoked" | "expired" | "error" = "revoked",
) {
  const state = buildMailchimpState();
  const connectionLabel =
    status === "expired" ? "Expired" : status === "error" ? "Error" : "Revoked";
  const tone = status === "revoked" ? "warning" : "danger";

  state.item = {
    ...state.item,
    status: "available",
  };
  state.marketingImportDetail = {
    ...state.marketingImportDetail,
    connectionStatus: status,
    connectionLabel,
    connectionState: {
      ...state.marketingImportDetail.connectionState,
      label: connectionLabel,
      subtitle:
        status === "expired"
          ? "The saved Mailchimp authorization has expired. Reconnect to restore previews and imports."
          : status === "error"
            ? "BloomSuite could not validate the stored Mailchimp authorization. Reconnect to continue."
            : "Mailchimp access was revoked. Connect Mailchimp again to restore previews and imports.",
      tone,
      valueClassName: tone === "warning" ? "text-amber-600" : "text-rose-600",
    },
    authorizationLabel: connectionLabel,
    authorizationSummary:
      status === "expired"
        ? "The saved Mailchimp authorization has expired. Reconnect to restore previews and imports."
        : status === "error"
          ? "BloomSuite could not validate the stored Mailchimp authorization. Reconnect to continue."
          : "Mailchimp access was revoked. Connect Mailchimp again to restore previews and imports.",
  };

  return state;
}

function buildMailchimpRunningImportState() {
  const state = buildMailchimpState();

  state.marketingImportDetail = {
    ...state.marketingImportDetail,
    hasRunningImport: true,
    runningImportId: "job-running",
    latestImportCompletedAt: null,
    latestImportSummary: "A Mailchimp import is currently running",
  };

  return state;
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

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("IntegrationDetailPage GA4 and marketing-import branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    functionsInvokeMock.mockReset();
    mockedUseMailchimpImportProgress.mockReturnValue(
      buildMailchimpImportProgressState(),
    );
    mockedUseMailchimpSyncLogs.mockReturnValue(buildMailchimpSyncLogsState());
    mockedUseMailchimpImportedDataSummary.mockReturnValue(
      buildMailchimpImportedDataSummaryState(),
    );
    mockedUseMailchimpImportedCustomers.mockReturnValue(
      buildMailchimpImportedCustomersState(),
    );
    mockedUseMailchimpImportedSegments.mockReturnValue(
      buildMailchimpImportedSegmentsState(),
    );
    mockedUseMailchimpImportedTags.mockReturnValue(
      buildMailchimpImportedTagsState(),
    );
    mockedUseMailchimpImportedCompliance.mockReturnValue(
      buildMailchimpImportedComplianceState(),
    );
    mockedUseMailchimpSegmentMembersPreview.mockReturnValue({
      data: ["alice@example.com", "bob@example.com"],
      isLoading: false,
      error: null,
    });
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

  it("renders the dedicated Mailchimp shell on the canonical page", () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());

    renderPage("/integrations/mailchimp");

    expect(
      screen.getByText(
        "Connection, import status, cached audience metadata, and imported Mailchimp CRM data live on this page.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Sync Logs" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Imported Data" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Connection" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Quick Actions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recent Import" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Danger Zone" })).toBeTruthy();
    expect(screen.getByText("Lists Available")).toBeTruthy();
    expect(screen.getByText("Contacts Imported")).toBeTruthy();
    expect(screen.getByText("Authorization")).toBeTruthy();
    expect(screen.getByText("Mailchimp account")).toBeTruthy();
    expect(screen.getByText("Account ID")).toBeTruthy();
    expect(
      screen.getAllByText("Bloom Newsletter").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(
        /start a one-time import without leaving the Mailchimp detail page/i,
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText("420 contacts imported").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Last Import")).toBeTruthy();
  });

  it("opens the Mailchimp import dialog from Start Import without navigation", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());

    renderPage("/integrations/mailchimp");

    fireEvent.click(screen.getByRole("button", { name: "Start Import" }));

    await waitFor(() => {
      expect(screen.getByTestId("mailchimp-import-dialog").textContent).toBe(
        "Mailchimp import dialog (import)",
      );
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/mailchimp",
      );
    });
  });

  it("opens preview mode from Preview Lists without navigation", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());

    renderPage("/integrations/mailchimp");

    fireEvent.click(screen.getByRole("button", { name: "Preview Lists" }));

    await waitFor(() => {
      expect(screen.getByTestId("mailchimp-import-dialog").textContent).toBe(
        "Mailchimp import dialog (preview)",
      );
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/mailchimp",
      );
    });
  });

  it("disables Start Import and shows tooltip copy when a Mailchimp import is already running", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildMailchimpRunningImportState(),
    );
    mockedUseMailchimpImportProgress.mockReturnValue(
      buildMailchimpImportProgressState({
        jobId: "job-running",
        status: "running",
        progressPercentage: 44,
        currentStage: "Importing audience members",
        fetchedRows: 200,
        insertedRows: 180,
        skippedRows: 20,
        failedRows: 0,
        estimatedCompletionAt: "2026-03-23T10:00:00.000Z",
        isRunning: true,
        lastUpdatedAt: "2026-03-23T09:45:00.000Z",
      }),
    );

    renderPage("/integrations/mailchimp");

    const disabledButton = screen.getByRole("button", {
      name: "Import Running",
    });

    expect(disabledButton.hasAttribute("disabled")).toBe(true);

    fireEvent.pointerMove(disabledButton.parentElement as HTMLElement);

    await waitFor(() => {
      expect(
        screen.getAllByText("An import is already in progress").length,
      ).toBeGreaterThan(0);
    });
  });

  it("renders inline Mailchimp import progress and switches to focused Sync Logs", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildMailchimpRunningImportState(),
    );
    mockedUseMailchimpImportProgress.mockReturnValue(
      buildMailchimpImportProgressState({
        jobId: "job-running",
        status: "running",
        progressPercentage: 58,
        currentStage: "Importing audience members",
        fetchedRows: 580,
        insertedRows: 540,
        skippedRows: 32,
        failedRows: 8,
        estimatedCompletionAt: "2026-03-23T10:00:00.000Z",
        isRunning: true,
        lastUpdatedAt: "2026-03-23T09:58:00.000Z",
      }),
    );

    renderPage("/integrations/mailchimp");

    expect(screen.getByText("Mailchimp import in progress")).toBeTruthy();
    expect(
      screen.getAllByText("Importing audience members").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("58%")).toBeTruthy();
    expect(screen.getByText("580")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View Sync Logs" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/mailchimp?tab=logs&job=job-running",
      );
    });
  });

  it("does not surface abandoned Mailchimp jobs as an active import", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());
    mockedUseMailchimpImportProgress.mockReturnValue(
      buildMailchimpImportProgressState({
        jobId: "job-abandoned",
        status: "running",
        isRunning: false,
        isStale: false,
        lastUpdatedAt: "2025-10-23T09:58:00.000Z",
      }),
    );

    renderPage("/integrations/mailchimp");

    expect(screen.queryByText("Mailchimp import in progress")).toBeNull();
    expect(screen.queryByRole("button", { name: "Import Running" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start Import" })).toBeTruthy();
  });

  it("renders a dismissible terminal Mailchimp import summary", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());
    mockedUseMailchimpImportProgress.mockReturnValue(
      buildMailchimpImportProgressState({
        jobId: "job-completed",
        status: "completed",
        isCompleted: true,
        report: {
          contacts_imported: 420,
          contacts_skipped: 12,
          contacts_failed: 1,
          segments_created: 3,
          tags_created: 6,
          consents_recorded: 420,
          batches_processed: 5,
          errors: ["1 invalid email skipped"],
        },
        errorDetails: [{ message: "1 invalid email skipped" }],
        lastUpdatedAt: "2026-03-23T09:30:00.000Z",
      }),
    );

    renderPage("/integrations/mailchimp");

    expect(screen.getByText("Mailchimp import finished")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Download Report as JSON" }),
    ).toBeTruthy();
    expect(screen.getByText(/Review import issues \(1\)/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByText("Mailchimp import finished")).toBeNull();
    });
  });

  it("opens the Mailchimp connect dialog on the canonical page and shows cancellation with Try Again when the OAuth tab closes silently", async () => {
    vi.useFakeTimers();

    const state = buildMailchimpReconnectState("revoked");
    mockedUseIntegrationDetailData.mockReturnValue(state);
    functionsInvokeMock.mockResolvedValue({
      data: { authUrl: "https://mailchimp.test/oauth" },
      error: null,
    });

    const authorizationTab = {
      closed: false,
      close: vi.fn(() => {
        authorizationTab.closed = true;
      }),
    } as unknown as Window;

    vi.spyOn(window, "open").mockReturnValue(authorizationTab);

    renderPage("/integrations/mailchimp");

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Connect Mailchimp")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Connect with Mailchimp" }),
    );

    await flushAsyncWork();

    expect(functionsInvokeMock).toHaveBeenCalledWith("oauth-authorize", {
      body: { provider: "mailchimp" },
    });
    expect(window.open).toHaveBeenCalledWith(
      "https://mailchimp.test/oauth",
      "_blank",
    );
    expect(
      screen.getAllByText("Waiting for Mailchimp authorization…").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("location-probe").textContent).toBe(
      "/integrations/mailchimp",
    );

    authorizationTab.closed = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(
      screen.getByText(
        "The Mailchimp authorization tab was closed before the connection completed.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();
  });

  it("shows a success confirmation with the Mailchimp account name after OAuth completes", async () => {
    const state = buildMailchimpReconnectState("error");
    state.refetch = vi.fn().mockResolvedValue({
      data: {
        marketingImportDetail: {
          ...state.marketingImportDetail,
          accountName: "Bloom Newsletter",
          connectionStatus: "connected",
        },
      },
    });
    mockedUseIntegrationDetailData.mockReturnValue(state);
    functionsInvokeMock.mockResolvedValue({
      data: { authUrl: "https://mailchimp.test/oauth" },
      error: null,
    });

    const authorizationTab = {
      closed: false,
      close: vi.fn(() => {
        authorizationTab.closed = true;
      }),
    } as unknown as Window;

    vi.spyOn(window, "open").mockReturnValue(authorizationTab);
    vi.useFakeTimers();

    renderPage("/integrations/mailchimp");

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Connect with Mailchimp" }),
    );

    await flushAsyncWork();

    expect(functionsInvokeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: {
            type: "oauth-success",
            provider: "mailchimp",
            message: "Connected successfully",
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(state.refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Mailchimp authorization complete")).toBeTruthy();
    expect(screen.getByText("Connected as Bloom Newsletter.")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reads the Mailchimp shell tab from the URL", () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());

    renderPage("/integrations/mailchimp?tab=logs");

    expect(
      screen
        .getByRole("tab", { name: "Sync Logs" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByText("No Mailchimp sync logs yet")).toBeTruthy();
    expect(screen.getByTestId("location-probe").textContent).toBe(
      "/integrations/mailchimp?tab=logs",
    );
  });

  it("shows Connect Mailchimp instead of Start Import on disconnected Mailchimp sync logs", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildMailchimpReconnectState("revoked"),
    );

    renderPage("/integrations/mailchimp?tab=logs");

    expect(screen.queryByRole("button", { name: "Start Import" })).toBeNull();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Connect Mailchimp" })[0],
    );

    expect(
      screen.getByRole("heading", { name: "Connect Mailchimp" }),
    ).toBeTruthy();
  });

  it("shows Connect Mailchimp instead of Start Import on disconnected Mailchimp imported data", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildMailchimpReconnectState("revoked"),
    );
    mockedUseMailchimpImportedDataSummary.mockReturnValue({
      data: {
        totalCustomers: 0,
        totalSegments: 0,
        totalTags: 0,
        activeConsentRecords: 0,
        activeSuppressions: 0,
      },
      loading: false,
      error: null,
    } as ReturnType<typeof useMailchimpImportedDataSummary>);

    renderPage("/integrations/mailchimp?tab=data");

    expect(screen.queryByRole("button", { name: "Start Import" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Connect Mailchimp" }));

    expect(
      screen.getByRole("heading", { name: "Connect Mailchimp" }),
    ).toBeTruthy();
  });

  it("renders the Mailchimp Imported Data tab with summary cards and customer rows", () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());

    renderPage("/integrations/mailchimp?tab=data");

    expect(screen.getByText("Mailchimp Customers")).toBeTruthy();
    expect(screen.getByText("Mailchimp Segments")).toBeTruthy();
    expect(screen.getByText("Associated Tags")).toBeTruthy();
    expect(screen.getByText("alice@example.com")).toBeTruthy();
    expect(screen.getByText("VIP Customers")).toBeTruthy();
    expect(screen.getByText("Spring Promo")).toBeTruthy();
    expect(screen.getByTestId("location-probe").textContent).toBe(
      "/integrations/mailchimp?tab=data",
    );
  });

  it("switches from a Mailchimp segment into Customers with a linked prefilter", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());

    renderPage("/integrations/mailchimp?tab=data");

    fireEvent.click(screen.getByRole("button", { name: "Segments" }));
    fireEvent.click(screen.getByText("VIP Customers"));
    fireEvent.click(screen.getByRole("button", { name: "View All Customers" }));

    await waitFor(() => {
      expect(mockedUseMailchimpImportedCustomers).toHaveBeenLastCalledWith({
        page: 1,
        search: "",
        hasSegments: false,
        hasTags: false,
        segmentId: "segment-1",
        tagId: null,
      });
      expect(screen.getByText("Segment: VIP Customers")).toBeTruthy();
    });
  });

  it("renders the Mailchimp Imported Data empty state and opens import from there", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());
    mockedUseMailchimpImportedDataSummary.mockReturnValue(
      buildMailchimpImportedDataSummaryState({
        data: {
          totalCustomers: 0,
          totalSegments: 0,
          totalTags: 0,
          activeConsentRecords: 0,
          activeSuppressions: 0,
        },
      }),
    );
    mockedUseMailchimpImportedCustomers.mockReturnValue(
      buildMailchimpImportedCustomersState({
        data: {
          rows: [],
          pagination: {
            page: 1,
            pageSize: 25,
            totalCount: 0,
            totalPages: 1,
          },
        },
      }),
    );
    mockedUseMailchimpImportedSegments.mockReturnValue(
      buildMailchimpImportedSegmentsState({ data: [] }),
    );
    mockedUseMailchimpImportedTags.mockReturnValue(
      buildMailchimpImportedTagsState({ data: [] }),
    );
    mockedUseMailchimpImportedCompliance.mockReturnValue(
      buildMailchimpImportedComplianceState({
        data: {
          consentRows: [],
          suppressionRows: [],
          consentSummaryCards: [],
          activeConsentRecords: 0,
          activeSuppressions: 0,
        },
      }),
    );

    renderPage("/integrations/mailchimp?tab=data");

    expect(
      screen.getByText(
        "No imported data yet. Connect Mailchimp and run your first import to see your data here.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start Import" }));

    await waitFor(() => {
      expect(screen.getByTestId("mailchimp-import-dialog").textContent).toBe(
        "Mailchimp import dialog (import)",
      );
    });
  });

  it("renders Mailchimp sync logs detail, forwards filter state to the hook, and loads more rows", async () => {
    const loadMore = vi.fn();
    const refresh = vi.fn();

    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());
    mockedUseMailchimpSyncLogs.mockReturnValue(
      buildMailchimpSyncLogsState({
        rows: [
          buildMailchimpSyncLogEntry({
            id: "job-failed",
            status: "failed",
            currentStage: "Mailchimp token expired",
            errorDetails: [{ message: "Mailchimp token expired" }],
            errorMessages: ["Mailchimp token expired"],
            errorCount: 1,
            hasConnectionIssue: true,
            report: null,
            completedAt: "2026-03-23T09:03:00.000Z",
            updatedAt: "2026-03-23T09:03:00.000Z",
          }),
          buildMailchimpSyncLogEntry({
            id: "job-completed",
            status: "completed",
            currentStage: "Import finished",
          }),
        ],
        totalCount: 24,
        hasMore: true,
        loadMore,
        refresh,
      }),
    );

    renderPage("/integrations/mailchimp?tab=logs&job=job-failed");

    expect(screen.getByText("Configuration")).toBeTruthy();
    expect(screen.getByText("Progress timeline")).toBeTruthy();
    expect(screen.getByText("Newsletter")).toBeTruthy();
    expect(
      screen.getByText(
        "This looks like a Mailchimp connection problem. Reconnect the Mailchimp account, then retry the import.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    await waitFor(() => {
      expect(mockedUseMailchimpSyncLogs).toHaveBeenLastCalledWith({
        statusFilter: "failed",
        datePreset: "30d",
        focusedJobId: "job-failed",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "All time" }));

    await waitFor(() => {
      expect(mockedUseMailchimpSyncLogs).toHaveBeenLastCalledWith({
        statusFilter: "failed",
        datePreset: "all",
        focusedJobId: "job-failed",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("opens the Mailchimp import dialog from the empty sync logs state", async () => {
    mockedUseIntegrationDetailData.mockReturnValue(buildMailchimpState());
    mockedUseMailchimpSyncLogs.mockReturnValue(buildMailchimpSyncLogsState());

    renderPage("/integrations/mailchimp?tab=logs");

    fireEvent.click(screen.getAllByRole("button", { name: "Start Import" })[1]);

    await waitFor(() => {
      expect(screen.getByTestId("mailchimp-import-dialog").textContent).toBe(
        "Mailchimp import dialog (import)",
      );
    });
  });

  it("keeps the disconnect confirmation open with inline retry state when Mailchimp revoke fails", async () => {
    const state = buildMailchimpState();
    state.disconnect = vi
      .fn()
      .mockRejectedValueOnce(new Error("request failed"))
      .mockResolvedValueOnce(undefined);
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage("/integrations/mailchimp");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Disconnect Mailchimp" })[0],
    );

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Disconnect Mailchimp" }),
    );

    await waitFor(() => {
      expect(state.disconnect).toHaveBeenCalledTimes(1);
      expect(
        within(screen.getByRole("alertdialog")).getByText(
          "Mailchimp could not be disconnected. Retry or cancel and try again later.",
        ),
      ).toBeTruthy();
      expect(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Retry",
        }),
      ).toBeTruthy();
    });

    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Retry",
      }),
    );

    await waitFor(() => {
      expect(state.disconnect).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alertdialog")).toBeNull();
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

  it("redirects legacy Mailchimp migration deep links to the canonical detail page", async () => {
    render(
      <MemoryRouter
        initialEntries={["/integrations/migrations?provider=mailchimp"]}
      >
        <Routes>
          <Route
            path="/integrations/migrations"
            element={<MigrationsRouteGate />}
          />
          <Route
            path="/integrations/mailchimp"
            element={<div>Mailchimp Detail</div>}
          />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Mailchimp Detail")).toBeTruthy();
      expect(screen.getByTestId("location-probe").textContent).toBe(
        "/integrations/mailchimp",
      );
    });
  });
});
