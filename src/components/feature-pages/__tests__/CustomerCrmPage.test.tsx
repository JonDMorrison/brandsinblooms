import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// LandingPageHeader transitively imports the Supabase auth client at
// module-load time, which crashes jsdom when window.localStorage isn't
// fully implemented. The shared test infra fix is referenced in earlier
// audits; until that lands, stub the header with a placeholder for this
// test only. The page-under-test does not depend on header internals
// for any assertion.
vi.mock("@/components/landing/LandingPageHeader", () => ({
  LandingPageHeader: () => <header data-testid="landing-page-header" />,
}));

// Imports under test — must come AFTER the vi.mock above so the mock is
// in place before LandingPageHeader resolves through FeaturePage's
// import chain.
import { FeaturePage } from "../FeaturePage";
import { customerCrmContent } from "../content/customerCrmContent";

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/features/customer-crm"]}>
        <FeaturePage content={customerCrmContent} />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("FeaturePage — Customer CRM", () => {
  it("renders the H1 from hero.headline", () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: customerCrmContent.hero.headline,
      }),
    ).toBeInTheDocument();
  });

  it("renders every FAQ question", () => {
    renderPage();
    for (const item of customerCrmContent.faq.items) {
      // <details><summary>question</summary>… — the question text is
      // discoverable via getByText.
      expect(screen.getByText(item.question)).toBeInTheDocument();
    }
  });

  it("renders FAQPage and BreadcrumbList JSON-LD scripts", async () => {
    renderPage();
    // react-helmet-async writes <script type="application/ld+json">
    // tags into the document head asynchronously on the client. Wait
    // for the head to settle, then read them out and assert they
    // contain the expected schema identifiers.
    await waitFor(() => {
      const scripts = document.head.querySelectorAll(
        'script[type="application/ld+json"]',
      );
      expect(scripts.length).toBeGreaterThanOrEqual(2);
    });
    const scripts = Array.from(
      document.head.querySelectorAll(
        'script[type="application/ld+json"]',
      ),
    );
    const combined = scripts.map((s) => s.textContent ?? "").join("\n");
    expect(combined).toContain('"@type":"FAQPage"');
    expect(combined).toContain('"@type":"BreadcrumbList"');
    // BreadcrumbList includes the page's breadcrumb label.
    expect(combined).toContain(customerCrmContent.breadcrumbLabel);
  });

  it("links related cards to /features/campaigns and /features/analytics", () => {
    renderPage();
    const campaignsLink = screen.getByRole("link", {
      name: /Send the Right Message at the Right Time/i,
    });
    expect(campaignsLink).toHaveAttribute("href", "/features/campaigns");
    const analyticsLink = screen.getByRole("link", {
      name: /Numbers in Plain English/i,
    });
    expect(analyticsLink).toHaveAttribute("href", "/features/analytics");
  });
});
