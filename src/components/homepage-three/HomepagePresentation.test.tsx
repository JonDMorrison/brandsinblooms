import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { HomepagePresentation } from "./HomepagePresentation";
import { HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY } from "./homepageTelemetry";
import { HOMEPAGE_SEO, HOMEPAGE_STRUCTURED_DATA } from "./homepageSeo";
import { HOMEPAGE_SECTIONS, HOMEPAGE_TRANSITIONS } from "./sectionConfig";
import {
  FOOTER_CONTENT,
  PRICING_CARDS_LABEL,
  PRICING_PLANS,
  PRICING_SECTION_HEADER,
} from "./content/pricingCtaFooterContent";
import {
  TESTIMONIAL_CARDS_LABEL,
  TESTIMONIALS,
  TESTIMONIALS_SECTION_HEADER,
} from "./content/testimonialsSocialProofContent";

const renderHomepage = (hash = "") => {
  window.history.replaceState(null, "", `/${hash}`);

  return render(
    <HelmetProvider>
      <MemoryRouter>
        <HomepagePresentation />
      </MemoryRouter>
    </HelmetProvider>,
  );
};

describe("HomepagePresentation", () => {
  beforeEach(() => {
    window.localStorage.removeItem("bloomsuite.homepage.animationsDisabled");
    window.localStorage.removeItem(HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY);
    delete window.dataLayer;
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
    window.localStorage.removeItem("bloomsuite.homepage.animationsDisabled");
    window.localStorage.removeItem(HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY);
    delete window.dataLayer;
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  });

  it("renders the locked shell, nav, and eight progress dots", () => {
    renderHomepage();

    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-section",
      "0",
    );
    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-device-tier",
      "fallback",
    );
    expect(
      screen.getByRole("navigation", { name: "Homepage navigation" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Homepage section progress")).getAllByRole(
        "button",
        {
          name: /^Navigate to /,
        },
      ),
    ).toHaveLength(8);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("exposes HP-M12 semantic landmarks, skip link, and labelled sections", () => {
    renderHomepage();

    expect(
      screen.getByRole("main", { name: "BloomSuite homepage" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#homepage-main-content");
    expect(
      screen.getByRole("region", { name: "Hero section" }),
    ).toHaveAttribute("id", "hero");
    expect(
      screen.getByRole("navigation", { name: "Homepage section progress" }),
    ).toBeInTheDocument();
  });

  it("sets homepage SEO metadata and structured data", async () => {
    renderHomepage();

    await waitFor(() => expect(document.title).toBe(HOMEPAGE_SEO.title));

    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
    ).toBe(HOMEPAGE_SEO.description);
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe(HOMEPAGE_SEO.url);
    expect(
      document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute("content"),
    ).toBe(HOMEPAGE_SEO.title);
    expect(
      document
        .querySelector('meta[name="twitter:card"]')
        ?.getAttribute("content"),
    ).toBe("summary_large_image");

    const jsonLd = JSON.parse(
      document.querySelector('script[type="application/ld+json"]')
        ?.textContent ?? "[]",
    );

    expect(jsonLd.map((entry: { "@type": string }) => entry["@type"])).toEqual(
      HOMEPAGE_STRUCTURED_DATA.map((entry) => entry["@type"]),
    );
  });

  it("persists the animation preference toggle", () => {
    renderHomepage();
    const shell = screen.getByTestId("homepage-shell");

    fireEvent.click(screen.getByRole("button", { name: "Disable animations" }));

    expect(shell).toHaveAttribute("data-animations-disabled", "true");
    expect(
      window.localStorage.getItem("bloomsuite.homepage.animationsDisabled"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Enable animations" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("fires consent-gated homepage analytics for page, section, and CTA events", async () => {
    window.localStorage.setItem(
      HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY,
      "granted",
    );
    renderHomepage();

    await waitFor(() =>
      expect(window.dataLayer?.map((event) => event.event)).toContain(
        "homepage_page_view",
      ),
    );

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Start Free Trial" })[0],
    );

    await waitFor(() =>
      expect(window.dataLayer).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: "homepage_section_view",
            section: "features",
          }),
          expect.objectContaining({
            event: "homepage_cta_click",
            label: "Start Free Trial",
            href: "/auth",
          }),
        ]),
      ),
    );
  });

  it("deep-links only to known hash sections", () => {
    renderHomepage("#ai");

    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-section",
      "3",
    );
    expect(window.location.hash).toBe("#ai");
  });

  it("renders the feature highlights section at the features hash", () => {
    renderHomepage("#features");

    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-section",
      "1",
    );
    const featureSection = screen.getByTestId("homepage-feature-highlights");
    expect(featureSection).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Everything You Need to Grow" }),
    ).toBeInTheDocument();
    expect(within(featureSection).getAllByRole("article")).toHaveLength(6);
  });

  it("renders the CRM showcase at the customer-growth hash", () => {
    renderHomepage("#customer-growth");

    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-section",
      "2",
    );
    expect(screen.getByTestId("homepage-crm-showcase")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "A CRM That Actually Works" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("CRM feature callouts")).getAllByRole(
        "article",
      ),
    ).toHaveLength(3);
  });

  it("renders the AI capabilities section at the AI hash without particles", () => {
    renderHomepage("#ai");

    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-section",
      "3",
    );
    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-surface",
      "dark",
    );
    expect(screen.getByTestId("homepage-ai-capabilities")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Intelligence Built In" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".hp-particle-canvas")).toBeNull();
  });

  it("renders the impact and how-it-works section at the automation hash", () => {
    renderHomepage("#automation");

    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-section",
      "4",
    );
    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-surface",
      "light",
    );
    expect(
      screen.getByTestId("homepage-impact-how-it-works"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Why Teams Choose BloomSuite" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Get Started in 3 Easy Steps" }),
    ).toBeInTheDocument();
  });

  it("renders the integrations ecosystem section at the integrations hash", () => {
    renderHomepage("#integrations");

    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-section",
      "5",
    );
    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-surface",
      "subtle",
    );
    expect(
      screen.getByTestId("homepage-integrations-ecosystem"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Works With Your Favorite Tools" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Integration ecosystem logos")).getAllByRole(
        "img",
      ),
    ).toHaveLength(10);
  });

  it("renders the testimonials social proof section at the testimonials hash", () => {
    renderHomepage("#testimonials");

    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-section",
      "6",
    );
    expect(screen.getByTestId("homepage-shell")).toHaveAttribute(
      "data-current-surface",
      "light",
    );
    expect(
      screen.getByTestId("homepage-testimonials-social-proof"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: TESTIMONIALS_SECTION_HEADER.headline,
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText(TESTIMONIAL_CARDS_LABEL)).getAllByRole(
        "article",
      ),
    ).toHaveLength(TESTIMONIALS.length);
    expect(HOMEPAGE_SECTIONS[6]).toMatchObject({
      id: "testimonials",
      slug: "testimonials",
      surface: "light",
      particleDensity: 0.3,
      particleTint: "sage",
    });
  });

  it("renders the final pricing CTA and footer section at the start hash", () => {
    renderHomepage("#start");

    const shell = screen.getByTestId("homepage-shell");
    const progressButtons = within(
      screen.getByLabelText("Homepage section progress"),
    ).getAllByRole("button", { name: /^Navigate to / });

    expect(shell).toHaveAttribute("data-current-section", "7");
    expect(shell).toHaveAttribute("data-current-surface", "light");
    expect(shell).toHaveAttribute("data-particle-density", "0.500");
    expect(
      screen.getByTestId("homepage-pricing-cta-footer"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: PRICING_SECTION_HEADER.headline }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText(PRICING_CARDS_LABEL)).getAllByRole(
        "article",
      ),
    ).toHaveLength(PRICING_PLANS.length);
    expect(progressButtons[progressButtons.length - 1]).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(HOMEPAGE_SECTIONS[7]).toMatchObject({
      id: "start",
      slug: "start",
      surface: "light",
      particleDensity: 0.5,
      particleTint: "sage",
    });
  });

  it("routes the Pricing nav item to the final conversion section", () => {
    renderHomepage();
    const shell = screen.getByTestId("homepage-shell");

    fireEvent.click(screen.getByRole("button", { name: "Pricing" }));

    expect(shell).toHaveAttribute("data-current-section", "7");
    expect(window.location.hash).toBe("#start");
  });

  it("persists the footer disable animations link end-to-end", () => {
    renderHomepage("#start");
    const shell = screen.getByTestId("homepage-shell");

    fireEvent.click(
      screen.getByRole("link", {
        name: FOOTER_CONTENT.disableAnimationsLabel,
      }),
    );

    expect(shell).toHaveAttribute("data-animations-disabled", "true");
    expect(
      window.localStorage.getItem("bloomsuite.homepage.animationsDisabled"),
    ).toBe("true");
  });

  it("uses the HP-M11 section choreography map", () => {
    expect(HOMEPAGE_SECTIONS.map((section) => section.id)).toEqual([
      "hero",
      "features",
      "customer-growth",
      "ai",
      "automation",
      "integrations",
      "testimonials",
      "start",
    ]);
    expect(HOMEPAGE_TRANSITIONS).toEqual([
      { from: 0, to: 1, type: "slide-up", durationMs: 700 },
      { from: 1, to: 2, type: "slide-up", durationMs: 700 },
      { from: 2, to: 3, type: "dissolve", durationMs: 800 },
      { from: 3, to: 4, type: "dissolve", durationMs: 800 },
      { from: 4, to: 5, type: "crossfade-hold", durationMs: 600 },
      { from: 5, to: 6, type: "crossfade-hold", durationMs: 600 },
      { from: 6, to: 7, type: "scale-fade", durationMs: 700 },
    ]);
    expect(HOMEPAGE_SECTIONS[3]).toMatchObject({
      id: "ai",
      surface: "dark",
      particleDensity: 0,
      particleTint: "none",
    });
    expect(HOMEPAGE_SECTIONS[4]).toMatchObject({
      id: "automation",
      surface: "light",
      particleDensity: 0.4,
      particleTint: "sage",
    });
  });

  it("normalizes a wheel flick to one section advance", () => {
    renderHomepage();
    const shell = screen.getByTestId("homepage-shell");

    fireEvent.wheel(shell, { deltaY: 120, deltaMode: 0 });
    fireEvent.wheel(shell, { deltaY: 180, deltaMode: 0 });

    expect(shell).toHaveAttribute("data-current-section", "1");
    expect(shell).toHaveAttribute("data-transition-type", "slide-up");
    expect(window.location.hash).toBe("#features");
  });

  it("does not advance when wheel input starts inside a scrollable gesture-locked section", () => {
    renderHomepage("#features");
    const shell = screen.getByTestId("homepage-shell");
    const featureSection = screen.getByTestId("homepage-feature-highlights");

    Object.defineProperty(featureSection, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(featureSection, "clientHeight", {
      configurable: true,
      value: 600,
    });

    fireEvent.wheel(featureSection, { deltaY: 180, deltaMode: 0 });

    expect(shell).toHaveAttribute("data-current-section", "1");
    expect(window.location.hash).toBe("#features");
  });

  it("supports keyboard navigation and no-op edges", () => {
    renderHomepage();
    const shell = screen.getByTestId("homepage-shell");

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(shell).toHaveAttribute("data-current-section", "0");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(shell).toHaveAttribute("data-current-section", "1");
    expect(screen.getByText("Showing Features section")).toBeInTheDocument();
  });

  it("supports Home and End keyboard section jumps from rest", () => {
    renderHomepage();
    const shell = screen.getByTestId("homepage-shell");

    fireEvent.keyDown(window, { key: "End" });
    expect(shell).toHaveAttribute("data-current-section", "7");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(shell).toHaveAttribute("data-current-section", "7");
  });

  it("navigates from progress dots at faster speed and updates hash", () => {
    renderHomepage();
    const shell = screen.getByTestId("homepage-shell");

    fireEvent.click(
      screen.getByRole("button", { name: "Navigate to Pricing" }),
    );

    expect(shell).toHaveAttribute("data-current-section", "7");
    expect(shell).toHaveStyle("--hp-transition-duration: 466.6666666666667ms");
    expect(window.location.hash).toBe("#start");
  });

  it("opens and closes the mobile glass menu", () => {
    renderHomepage();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
