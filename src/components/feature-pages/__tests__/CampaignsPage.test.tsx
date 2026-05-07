import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// LandingPageHeader transitively imports the Supabase auth client at
// module-load time, which crashes jsdom when window.localStorage isn't
// fully implemented. Stub the header for this test only — same pattern
// as CustomerCrmPage.test.tsx.
vi.mock("@/components/landing/LandingPageHeader", () => ({
  LandingPageHeader: () => <header data-testid="landing-page-header" />,
}));

import { FeaturePage } from "../FeaturePage";
import { campaignsContent } from "../content/campaignsContent";

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/features/campaigns"]}>
        <FeaturePage content={campaignsContent} />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("FeaturePage — Campaigns", () => {
  it("renders the H1 from hero.headline", () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: campaignsContent.hero.headline,
      }),
    ).toBeInTheDocument();
  });

  it("renders every FAQ question", () => {
    renderPage();
    for (const item of campaignsContent.faq.items) {
      expect(screen.getByText(item.question)).toBeInTheDocument();
    }
  });

  it("renders FAQPage and BreadcrumbList JSON-LD scripts", async () => {
    renderPage();
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
    expect(combined).toContain(campaignsContent.breadcrumbLabel);
  });

  it("links related cards to /features/customer-crm and /features/analytics", () => {
    renderPage();
    const crmLink = screen.getByRole("link", {
      name: /Remember Every Customer/i,
    });
    expect(crmLink).toHaveAttribute("href", "/features/customer-crm");
    const analyticsLink = screen.getByRole("link", {
      name: /Numbers in Plain English/i,
    });
    expect(analyticsLink).toHaveAttribute("href", "/features/analytics");
  });
});
