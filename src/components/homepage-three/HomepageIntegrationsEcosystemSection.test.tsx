import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageIntegrationsEcosystemSection } from "./HomepageIntegrationsEcosystemSection";
import {
  INTEGRATION_CARDS,
  INTEGRATION_COUNT_COPY,
  INTEGRATIONS_SECTION_HEADER,
} from "./content/integrationsEcosystemContent";

describe("HomepageIntegrationsEcosystemSection", () => {
  it("renders the centered integrations header, card grid, and count copy", () => {
    render(<HomepageIntegrationsEcosystemSection isActive motionEnabled />);

    const grid = screen.getByLabelText("Integration ecosystem cards");

    expect(
      screen.getByText(INTEGRATIONS_SECTION_HEADER.eyebrow),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: INTEGRATIONS_SECTION_HEADER.headline,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(INTEGRATIONS_SECTION_HEADER.subtext),
    ).toBeInTheDocument();
    expect(within(grid).getAllByRole("article")).toHaveLength(
      INTEGRATION_CARDS.length,
    );
    expect(
      screen.getByText(INTEGRATION_COUNT_COPY.headline),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: INTEGRATION_COUNT_COPY.cta }),
    ).toHaveAttribute("href", INTEGRATION_COUNT_COPY.ctaHref);
  });

  it("renders integration cards with logos, fallback icons, and stagger metadata", () => {
    const { container } = render(
      <HomepageIntegrationsEcosystemSection isActive motionEnabled />,
    );

    for (const integration of INTEGRATION_CARDS) {
      const card = container.querySelector<HTMLElement>(
        `.hp-integration-card[data-integration-id="${integration.id}"]`,
      );

      expect(card).toBeInTheDocument();
      expect(card).toHaveClass(`hp-integration-card--${integration.size}`);
      expect(card).toHaveAttribute("data-card-size", integration.size);
      expect(card).toHaveStyle(
        `--hp-integration-card-delay: ${integration.delayMs}ms`,
      );
      expect(
        within(card!).getByRole("heading", { name: integration.name }),
      ).toBeInTheDocument();
      expect(within(card!).getByText(integration.category)).toBeInTheDocument();
      expect(
        within(card!).getByText(integration.description),
      ).toBeInTheDocument();

      if (integration.logo) {
        expect(
          within(card!).getByRole("img", { name: integration.logo.alt }),
        ).toHaveAttribute("src", integration.logo.src);
      } else {
        expect(within(card!).queryByRole("img")).toBeNull();
        expect(card!.querySelector("svg")).toBeInTheDocument();
      }
    }
  });

  it("marks fallback mode for the static non-drawing layout", () => {
    render(
      <HomepageIntegrationsEcosystemSection isActive motionEnabled={false} />,
    );

    expect(
      screen.getByTestId("homepage-integrations-ecosystem"),
    ).toHaveAttribute("data-motion-enabled", "false");
  });
});
