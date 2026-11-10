import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomepagePresentation } from "./HomepagePresentation";
import { HOMEPAGE_SEO, HOMEPAGE_STRUCTURED_DATA } from "./homepageSeo";
import { HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY } from "./homepageTelemetry";
import { HOMEPAGE_SECTIONS } from "./sectionConfig";
import { AI_CAPABILITIES_HEADER } from "./content/aiCapabilitiesContent";
import {
  PRICING_CARDS_LABEL,
  PRICING_PLANS,
  PRICING_SECTION_HEADER,
} from "./content/pricingCtaFooterContent";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ loading: false, user: null }),
}));

const renderHomepage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <HomepagePresentation />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("HomepagePresentation", () => {
  beforeEach(() => {
    window.localStorage.removeItem(HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY);
    delete window.dataLayer;
  });

  afterEach(() => {
    delete window.dataLayer;
    document.documentElement.style.scrollBehavior = "";
  });

  it("renders the shared navigation and every configured homepage section", () => {
    renderHomepage();

    expect(
      screen.getByRole("main", { name: "BloomSuite homepage" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("banner").length).toBeGreaterThan(0);

    const sections = screen
      .getAllByRole("region")
      .filter((section) => section.hasAttribute("data-section-id"));
    expect(sections).toHaveLength(HOMEPAGE_SECTIONS.length);
    expect(sections.map((section) => section.id)).toEqual(
      HOMEPAGE_SECTIONS.map((section) => section.id),
    );
  });

  it("renders the garden-center product, AI, integration, and pricing content", () => {
    renderHomepage();

    expect(
      screen.getByRole("heading", { name: "What you get with BloomSuite" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: AI_CAPABILITIES_HEADER.headline }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Connects to what you already use." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: PRICING_SECTION_HEADER.headline }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText(PRICING_CARDS_LABEL)).getAllByRole("article"),
    ).toHaveLength(PRICING_PLANS.length);
  });

  it("sets homepage SEO metadata and structured data", async () => {
    renderHomepage();

    await waitFor(() => expect(document.title).toBe(HOMEPAGE_SEO.title));
    expect(
      document.querySelector('meta[name="description"]')?.getAttribute("content"),
    ).toBe(HOMEPAGE_SEO.description);
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe(HOMEPAGE_SEO.url);

    const jsonLd = JSON.parse(
      document.querySelector('script[type="application/ld+json"]')
        ?.textContent ?? "[]",
    );
    expect(jsonLd.map((entry: { "@type": string }) => entry["@type"])).toEqual(
      HOMEPAGE_STRUCTURED_DATA.map((entry) => entry["@type"]),
    );
  });

  it("records a consented page view", async () => {
    window.localStorage.setItem(
      HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY,
      "granted",
    );
    renderHomepage();

    await waitFor(() =>
      expect(window.dataLayer).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: "homepage_page_view",
            section: "hero",
          }),
        ]),
      ),
    );
  });

  it("enables smooth scrolling only while mounted", () => {
    const view = renderHomepage();
    expect(document.documentElement.style.scrollBehavior).toBe("smooth");

    view.unmount();
    expect(document.documentElement.style.scrollBehavior).toBe("");
  });
});
