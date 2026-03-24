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

  return {
    isValidSlug: true,
    item,
    model,
    comingSoonDetail: {
      statusLabel: slug === "zapier" ? "In progress" : "Upcoming",
      statusTone: "warning" as const,
      availabilityLabel:
        slug === "zapier" ? "Internal preview build" : "Planned release",
      cardTitle:
        slug === "zapier"
          ? "Zapier is actively being built."
          : `${seed.name} is queued for a future rollout.`,
      description: `Roadmap details for ${seed.name}.`,
      metadata: [
        `Category: ${seed.categoryLabel}`,
        `Scope: ${seed.syncScopeLabel ?? seed.categoryLabel}`,
        slug === "zapier"
          ? "Availability: In progress"
          : "Availability: Planned release",
      ],
      capabilities: [
        `Planned capability for ${seed.name}`,
        `Second capability for ${seed.name}`,
      ],
      previewCallout:
        slug === "zapier"
          ? {
              title: "Preview status",
              description:
                "Zapier is currently in progress. Public webhook configuration and setup controls are not exposed from this page yet.",
            }
          : undefined,
      notifyEmail: "owner@example.com",
      requestPath:
        "mailto:support@bloomsuite.app?subject=Request%20an%20Integration",
      emailInfrastructureDetail: null,
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

    expect(screen.getByText("Planned capabilities")).toBeTruthy();
    expect(screen.getByDisplayValue("owner@example.com")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /actions/i })).toBeNull();
    expect(screen.queryByText("Danger Zone")).toBeNull();
    expect(screen.queryByText("Connection Health")).toBeNull();
    expect(screen.queryByText("Webhook Health")).toBeNull();
    expect(screen.queryByText("Sync Health")).toBeNull();
    expect(
      screen.getByRole("link", { name: /documentation/i }),
    ).toHaveAttribute("href", `/integrations/${slug}/documentation`);
    expect(
      screen
        .getByRole("link", { name: /request this integration/i })
        .getAttribute("href"),
    ).toContain("mailto:support@bloomsuite.app");
  });

  it("submits notify-me from the coming-soon card", () => {
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

    expect(screen.getByText("You're on the list")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Notify me" })).toBeNull();
  });

  it("renders the Zapier in-progress badge and preview callout", () => {
    mockedUseIntegrationDetailData.mockReturnValue(
      buildComingSoonState("zapier"),
    );

    renderPage("zapier");

    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByText("Preview status")).toBeTruthy();
    expect(
      screen.getByText(
        /Public webhook configuration and setup controls are not exposed from this page yet/i,
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Connection Actions")).toBeNull();
  });
});
