import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LightspeedLandingPage } from "./LightspeedLandingPage";

vi.mock("@/components/landing/LandingPageHeader", () => ({
  LandingPageHeader: () => <nav aria-label="Primary">BloomSuite</nav>,
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/lightspeed"]}>
        <LightspeedLandingPage />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("LightspeedLandingPage", () => {
  it("renders the public Lightspeed story and trial CTAs", () => {
    renderPage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Turn your Lightspeed data into customers who come back",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /start a free trial/i })).toHaveLength(4);
    for (const link of screen.getAllByRole("link", { name: /start a free trial/i })) {
      expect(link).toHaveAttribute("href", "/auth#signup");
    }
    expect(screen.getByText("customers:read", { exact: false })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /read the technical integration guide/i }),
    ).toHaveAttribute("href", "/docs/integrations/lightspeed");
  });

  it("exposes straightforward FAQ answers", () => {
    renderPage();

    const checkoutQuestion = screen.getByText(
      "Does BloomSuite change my Lightspeed checkout or payments?",
    );
    fireEvent.click(checkoutQuestion);

    expect(
      screen.getByText(/does not replace your point of sale/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(8);
  });

  it("sets canonical and social metadata", async () => {
    renderPage();

    await waitFor(() =>
      expect(document.title).toBe(
        "BloomSuite for Lightspeed X-Series | Garden Centre Marketing",
      ),
    );
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://bloomsuite.app/lightspeed");
    expect(
      document.querySelector('meta[property="og:url"]')?.getAttribute("content"),
    ).toBe("https://bloomsuite.app/lightspeed");
    expect(
      document.querySelector('script[type="application/ld+json"]'),
    ).not.toBeNull();
  });
});
