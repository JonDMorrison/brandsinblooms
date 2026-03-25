import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { useIntegrationsHubData } from "@/hooks/useIntegrationsHubData";
import { IntegrationsHubIndex } from "@/components/integrations/IntegrationsHubIndex";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/hooks/useIntegrationsHubData", () => ({
  useIntegrationsHubData: vi.fn(),
}));

const mockedUseIntegrationsHubData = vi.mocked(useIntegrationsHubData);

function mockHubData(overrides: Record<string, unknown> = {}) {
  mockedUseIntegrationsHubData.mockReturnValue({
    items: [
      buildItem("square", { status: "connected" }),
      buildItem("clover", { status: "available" }),
      buildItem("meta", {
        status: "connected",
        children: [
          { name: "Facebook", status: "connected" },
          { name: "Instagram", status: "available" },
        ],
      }),
      buildItem("email-infrastructure", {
        status: "available",
        metaLabel: "bloomsuiteflowers.com",
      }),
      buildItem("slack", { status: "coming-soon" }),
    ],
    itemMap: new Map(),
    connections: null,
    tenant: null,
    user: null,
    canUseActions: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  });
}

function buildItem(slug: string, patch: Record<string, unknown> = {}) {
  const seed = getIntegrationSeed(slug);

  if (!seed) {
    throw new Error(`Expected integration seed for ${slug}.`);
  }

  return {
    ...seed,
    status: seed.defaultStatus,
    ...patch,
  };
}

function LocationDisplay() {
  const location = useLocation();

  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderPage() {
  return render(
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <MemoryRouter initialEntries={["/integrations"]}>
        <IntegrationsHubIndex />
        <LocationDisplay />
      </MemoryRouter>
    </TooltipProvider>,
  );
}

describe("IntegrationsHubIndex", () => {
  beforeEach(() => {
    mockHubData();
  });

  it("renders the Lightspeed X-Series logo from the shared local asset", () => {
    mockHubData({
      items: [buildItem("lightspeed", { status: "available" })],
    });

    renderPage();

    const lightspeedCard = screen
      .getByRole("heading", { name: "Lightspeed X-Series" })
      .closest("article");

    if (!lightspeedCard) {
      throw new Error("Expected the Lightspeed X-Series card to render.");
    }

    expect(
      lightspeedCard.querySelector('img[src*="lightspeed-x-series.svg"]'),
    ).toBeInTheDocument();
  });

  it("renders the dedicated skeleton loader during the initial load", () => {
    mockHubData({
      items: [],
      canUseActions: true,
      isLoading: true,
    });

    renderPage();

    expect(screen.getByTestId("integrations-skeleton-loader")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getAllByTestId("integration-skeleton-card")).toHaveLength(8);
    expect(
      screen.getByTestId("integrations-skeleton-actions"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Integrations" }),
    ).not.toBeInTheDocument();
  });

  it("renders a flat sorted grid with the redesigned card actions and links", async () => {
    const user = userEvent.setup();

    renderPage();

    expect(
      screen.queryByRole("heading", { name: "Connected" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Available" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Upcoming" }),
    ).not.toBeInTheDocument();

    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Square", "Meta", "Clover", "Email Infrastructure", "Slack"]);

    const squareCard = screen
      .getByRole("heading", { name: "Square" })
      .closest("article");
    const metaCard = screen
      .getByRole("heading", { name: "Meta" })
      .closest("article");
    const cloverCard = screen
      .getByRole("heading", { name: "Clover" })
      .closest("article");
    const infrastructureCard = screen
      .getByRole("heading", { name: "Email Infrastructure" })
      .closest("article");
    const slackCard = screen
      .getByRole("heading", { name: "Slack" })
      .closest("article");

    if (
      !squareCard ||
      !metaCard ||
      !cloverCard ||
      !infrastructureCard ||
      !slackCard
    ) {
      throw new Error("Expected all integration cards to render as articles.");
    }

    expect(
      within(squareCard).getByRole("link", { name: /squareup\.com/i }),
    ).toHaveAttribute("href", "https://squareup.com");
    expect(
      within(infrastructureCard).getByRole("link", {
        name: /bloomsuiteflowers\.com/i,
      }),
    ).toHaveAttribute("href", "https://bloomsuiteflowers.com");
    expect(
      within(slackCard).getByRole("link", { name: /slack\.com/i }),
    ).toHaveAttribute("href", "https://slack.com");

    expect(
      within(squareCard).getByRole("link", { name: /^documentation$/i }),
    ).toHaveAttribute("href", "/integrations/square/documentation");
    expect(
      within(infrastructureCard).getByRole("link", {
        name: /^documentation$/i,
      }),
    ).toHaveAttribute(
      "href",
      "/integrations/email-infrastructure/documentation",
    );
    expect(
      within(slackCard).getByRole("link", { name: /^documentation$/i }),
    ).toHaveAttribute("href", "/integrations/slack/documentation");

    expect(
      within(squareCard).getByRole("button", { name: /manage/i }),
    ).toBeInTheDocument();
    const cloverAddButton = within(cloverCard).getByRole("button", {
      name: /add/i,
    });
    expect(cloverAddButton).toBeInTheDocument();
    expect(cloverAddButton).toHaveTextContent("Add");
    const infrastructureManageSettingsButton = within(
      infrastructureCard,
    ).getByRole("button", {
      name: /manage settings/i,
    });
    expect(infrastructureManageSettingsButton).toBeInTheDocument();
    expect(infrastructureManageSettingsButton).toHaveTextContent("");
    expect(within(slackCard).queryByRole("button")).not.toBeInTheDocument();
    expect(within(slackCard).getByText("Upcoming")).toBeInTheDocument();

    expect(within(metaCard).getByText("Facebook")).toBeInTheDocument();
    expect(within(metaCard).getByText("Instagram")).toBeInTheDocument();
    expect(within(metaCard).getByText("Connected")).toBeInTheDocument();
    expect(within(metaCard).getByText("Not connected")).toBeInTheDocument();
    expect(
      squareCard.querySelector('img[src*="square.svg"]'),
    ).toBeInTheDocument();
    expect(
      cloverCard.querySelector('img[src*="clover.svg"]'),
    ).toBeInTheDocument();
    expect(
      slackCard.querySelector('img[src*="slack.jpeg"]'),
    ).toBeInTheDocument();
    expect(infrastructureCard.querySelector("img")).toBeNull();

    await user.click(
      within(squareCard).getByRole("link", { name: /^documentation$/i }),
    );
    expect(screen.getByTestId("location-display")).toHaveTextContent(
      "/integrations/square/documentation",
    );

    const refreshedCloverCard = screen
      .getByRole("heading", { name: "Clover" })
      .closest("article");

    if (!refreshedCloverCard) {
      throw new Error("Expected Clover card after documentation navigation.");
    }

    const refreshedCloverAddButton = within(refreshedCloverCard).getByRole(
      "button",
      { name: /add/i },
    );
    expect(refreshedCloverAddButton).toHaveTextContent("Add");

    await user.click(refreshedCloverAddButton);
    expect(screen.getByTestId("location-display")).toHaveTextContent(
      "/integrations/clover",
    );
  });
});
