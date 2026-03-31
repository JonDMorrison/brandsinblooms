import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

function buildComingSoonState(
  slug: "custom-webhooks",
  options?: {
    isSubmitted?: boolean;
  },
) {
  const seed = getIntegrationSeed(slug);

  if (!seed) {
    throw new Error(`Expected integration seed for ${slug}`);
  }

  const item = {
    ...seed,
    status: "coming-soon" as const,
  };

  const model = buildIntegrationDetailModel({
    item,
    status: "coming-soon",
    contextLabel: item.syncScopeLabel,
    canDisconnect: false,
  });

  const submitComingSoonInterest = vi.fn().mockResolvedValue(undefined);

  const pageContent = {
    statusLabel: "Coming soon",
    availabilityLabel: "Planned developer release",
    capabilities: [
      "Send BloomSuite CRM events to any external system via HTTP POST",
      "Configure custom payload templates and authentication headers",
      "Monitor delivery logs and retry failed webhook calls automatically",
      "Webhook signing — verify requests originated from BloomSuite",
    ],
    payloadPreview: {
      summary: "Preview example payload",
      content: `{
  "event": "purchase.completed",
  "timestamp": "2026-03-01T14:30:00Z",
  "data": {
    "customer_email": "jane@example.com",
    "order_total": 4250,
    "currency": "GBP"
  }
}`,
    },
  };

  return {
    isValidSlug: true,
    item,
    model,
    comingSoonDetail: {
      statusLabel: pageContent.statusLabel,
      statusTone: "warning" as const,
      availabilityLabel: pageContent.availabilityLabel,
      description: `Roadmap details for ${seed.name}.`,
      metadata: [
        `Category: ${seed.categoryLabel}`,
        `Scope: ${seed.syncScopeLabel ?? seed.categoryLabel}`,
        pageContent.statusLabel === "In progress"
          ? "Availability: In progress"
          : "Availability: Planned release",
      ],
      capabilities: pageContent.capabilities,
      callout: "callout" in pageContent ? pageContent.callout : undefined,
      integrationName: seed.name,
      notifyEmail: "owner@example.com",
      notifyLabel: "Notify me when available",
      notifyConfirmation: `You're on the list. We'll notify you when ${seed.name} is available.`,
      requestLabel: "Request this integration →",
      payloadPreview:
        "payloadPreview" in pageContent
          ? pageContent.payloadPreview
          : undefined,
      requestPath:
        "mailto:support@bloomsuite.app?subject=Request%20an%20Integration",
      isSubmitted: options?.isSubmitted ?? false,
    },
    squareDetail: null,
    cloverDetail: null,
    lightspeedDetail: null,
    metaDetail: null,
    ga4Detail: null,
    marketingImportDetail: null,
    targetPath: undefined,
    requestPath:
      "mailto:support@bloomsuite.app?subject=Request%20an%20Integration",
    canUseActions: false,
    canDisconnect: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    submitComingSoonInterest,
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

function renderPage(slug: string) {
  render(
    <MemoryRouter initialEntries={[`/integrations/${slug}`]}>
      <Routes>
        <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("IntegrationDetailPage coming-soon branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["custom-webhooks"] as const)(
    "renders the stripped-down coming-soon shell for %s",
    (slug) => {
      mockedUseIntegrationDetailData.mockReturnValue(
        buildComingSoonState(slug),
      );

      renderPage(slug);

      expect(screen.getByText("What you'll be able to do")).toBeTruthy();
      expect(
        screen.getByText(
          new RegExp(`owner@example.com.*${getIntegrationSeed(slug)?.name}`),
        ),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Notify me" })).toBeTruthy();
      expect(screen.getByRole("button", { name: /actions/i })).toBeTruthy();
      expect(screen.queryByText("Danger Zone")).toBeNull();
      expect(screen.queryByText("Connection Health")).toBeNull();
      expect(screen.queryByText("Webhook Health")).toBeNull();
      expect(screen.queryByText("Sync Health")).toBeNull();
      expect(
        screen
          .getByRole("link", { name: /request this integration/i })
          .getAttribute("href"),
      ).toContain("mailto:support@bloomsuite.app");
      expect(
        screen.queryByRole("textbox", { name: /notification email/i }),
      ).toBeNull();
    },
  );

  it("submits notify-me from the header action", () => {
    const state = buildComingSoonState("custom-webhooks");
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage("custom-webhooks");

    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));

    expect(state.submitComingSoonInterest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Open .* setup/i)).toBeNull();
  });

  it("renders the acknowledged state after notify-me submission", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildComingSoonState("custom-webhooks", { isSubmitted: true }),
    );

    renderPage("custom-webhooks");

    expect(
      screen.getByText(
        /We'll notify you at owner@example.com when Custom Webhooks is available/i,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Notify me" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "You're on the list" }),
    ).toBeDisabled();
  });

  it("renders the Custom Webhooks payload preview collapsed by default", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildComingSoonState("custom-webhooks"),
    );

    renderPage("custom-webhooks");

    const disclosure = screen.getByText(/Preview example payload/i);
    expect(disclosure).toBeTruthy();
    const details = disclosure.closest("details");
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(disclosure);

    expect(details).toHaveAttribute("open");
    expect(screen.getByText(/purchase.completed/i)).toBeTruthy();
  });

  it("shows a documentation-only actions dropdown for coming-soon pages", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildComingSoonState("custom-webhooks"),
    );

    renderPage("custom-webhooks");

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    expect(screen.getByText("View Documentation")).toBeTruthy();
    expect(screen.queryByText("Disconnect integration")).toBeNull();
    expect(screen.queryByText("Sync now")).toBeNull();
  });
});
