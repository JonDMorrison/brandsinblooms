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
  slug: "shopify" | "hubspot" | "zapier" | "slack" | "custom-webhooks",
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

  const pageContent =
    slug === "shopify"
      ? {
          statusLabel: "Coming soon",
          availabilityLabel: "Planned ecommerce release",
          capabilities: [
            "Sync Shopify products, orders, and customers into BloomSuite CRM",
            "Trigger automations on new orders, abandoned carts, and fulfillment events",
            "Import your Shopify customer base as a migration source",
            "Display Shopify products on BloomSuite-powered store pages",
          ],
          callout: {
            tone: "warning" as const,
            title:
              "The legacy Shopify connection flow in BloomSuite has been retired.",
            description:
              "The new first-class Shopify integration is currently being built.",
          },
        }
      : slug === "hubspot"
        ? {
            statusLabel: "Coming soon",
            availabilityLabel: "Planned automation release",
            capabilities: [
              "Sync BloomSuite CRM contacts and customers into HubSpot",
              "Push BloomSuite automation events as HubSpot timeline activities",
              "Import HubSpot contacts into BloomSuite",
              "Bi-directional deal and lifecycle stage sync",
            ],
          }
        : slug === "zapier"
          ? {
              statusLabel: "In progress",
              availabilityLabel: "Internal preview build",
              capabilities: [
                "Trigger Zapier workflows from BloomSuite CRM events (new customer, purchase, loyalty join)",
                "Push data from 5,000+ Zapier-connected apps into BloomSuite contacts",
                "No-code automation across your full tool stack",
                "Multi-step Zap support with BloomSuite as trigger or action",
              ],
              callout: {
                tone: "info" as const,
                title: "The Zapier integration is in active development.",
                description:
                  "The documentation below describes planned functionality.",
              },
            }
          : slug === "slack"
            ? {
                statusLabel: "Coming soon",
                availabilityLabel: "Planned collaboration release",
                capabilities: [
                  "Receive BloomSuite CRM notifications in designated Slack channels",
                  "Alert your team when automations fire, syncs fail, or connections have issues",
                  "Daily and weekly performance summaries delivered to Slack",
                  "Custom alert rules based on thresholds (e.g. orders over GBP 500)",
                ],
              }
            : {
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

  it.each([
    "shopify",
    "hubspot",
    "zapier",
    "slack",
    "custom-webhooks",
  ] as const)("renders the stripped-down coming-soon shell for %s", (slug) => {
    mockedUseIntegrationDetailData.mockReturnValue(buildComingSoonState(slug));

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
  });

  it("submits notify-me from the header action", () => {
    const state = buildComingSoonState("shopify");
    mockedUseIntegrationDetailData.mockReturnValue(state);

    renderPage("shopify");

    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));

    expect(state.submitComingSoonInterest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Open Shopify setup/i)).toBeNull();
  });

  it("renders the acknowledged state after notify-me submission", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildComingSoonState("slack", { isSubmitted: true }),
    );

    renderPage("slack");

    expect(
      screen.getByText(
        /We'll notify you at owner@example.com when Slack is available/i,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Notify me" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "You're on the list" }),
    ).toBeDisabled();
  });

  it("renders the Zapier in-progress badge and info callout", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildComingSoonState("zapier"),
    );

    renderPage("zapier");

    expect(screen.getByText("In progress")).toBeTruthy();
    expect(
      screen.getByText("The Zapier integration is in active development."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /The documentation below describes planned functionality/i,
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Connection Actions")).toBeNull();
  });

  it("renders the Shopify legacy-flow retirement warning", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildComingSoonState("shopify"),
    );

    renderPage("shopify");

    expect(
      screen.getByText(
        "The legacy Shopify connection flow in BloomSuite has been retired.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "The new first-class Shopify integration is currently being built.",
      ),
    ).toBeTruthy();
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
      buildComingSoonState("hubspot"),
    );

    renderPage("hubspot");

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));

    expect(screen.getByText("View Documentation")).toBeTruthy();
    expect(screen.queryByText("Disconnect integration")).toBeNull();
    expect(screen.queryByText("Sync now")).toBeNull();
  });
});
