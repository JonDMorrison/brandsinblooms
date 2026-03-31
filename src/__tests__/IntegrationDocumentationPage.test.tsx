import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import IntegrationDocumentationPage from "@/pages/integrations/IntegrationDocumentationPage";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedToast = vi.mocked((await import("sonner")).toast);

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderPage(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route
          path="/integrations/:slug/documentation"
          element={<IntegrationDocumentationPage />}
        />
        <Route path="/integrations" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("IntegrationDocumentationPage", () => {
  it("renders the static documentation shell for a supported slug", () => {
    const { container } = renderPage("/integrations/square/documentation");

    expect(
      screen.getByRole("heading", { name: "Square Integration Guide" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Overview" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Connect and Configure" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Connecting Your Square Account",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Supported Webhook Events" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to square/i }),
    ).toHaveAttribute("href", "/integrations/square");
    expect(screen.getByLabelText("Documentation sections")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeNull();
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it("renders provider-specific Clover documentation content", () => {
    renderPage("/integrations/clover/documentation");

    expect(
      screen.getByRole("heading", { name: "Clover Integration Guide" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Connecting Your Clover Account",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Webhook Setup and Verification",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Connect and Configure" }),
    ).not.toBeInTheDocument();
  });

  it("supports slug aliases through canonical integration lookup", () => {
    const { container } = renderPage(
      "/integrations/lightspeed-x-series/documentation",
    );

    expect(
      screen.getByRole("heading", {
        name: "Lightspeed X-Series Integration Guide",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Connecting Your Lightspeed Store",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Webhook Modes and Verification",
      }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src*="lightspeed-x-series.svg"]'),
    ).toBeInTheDocument();
  });

  it("renders provider-specific Meta documentation content", () => {
    renderPage("/integrations/meta/documentation");

    expect(
      screen.getByRole("heading", { name: "Meta Integration Guide" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Connecting Your Meta Account",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Publishing and Analytics Coverage",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Connect and Configure" }),
    ).not.toBeInTheDocument();
  });

  it("supports the requested Google Analytics alias route", () => {
    renderPage("/integrations/google-analytics/documentation");

    expect(
      screen.getByRole("heading", {
        name: "Google Analytics 4 Integration Guide",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Connecting Google Analytics 4",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Current Reporting Caveats",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to google analytics 4/i }),
    ).toHaveAttribute("href", "/integrations/google-analytics");
  });

  it("renders provider-specific Mailchimp documentation content", () => {
    renderPage("/integrations/mailchimp/documentation");

    expect(
      screen.getByRole("heading", { name: "Mailchimp Import Guide" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Before You Start: Migration Checklist",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Step 4: Import & Monitor" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Connect and Configure" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Imported as BloomSuite CRM segments, with contacts linked",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /When you select specific segments in the Choose step, only contacts from those segments are imported/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders provider-specific Klaviyo documentation content", () => {
    renderPage("/integrations/klaviyo/documentation");

    expect(
      screen.getByRole("heading", { name: "Klaviyo Import Guide" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Step 2: Preview Lists & Segments",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "API Key Issues" }),
    ).toBeInTheDocument();
  });

  it("renders provider-specific Constant Contact documentation content", () => {
    renderPage("/integrations/constant-contact/documentation");

    expect(
      screen.getByRole("heading", {
        name: "Constant Contact Import Guide",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Step 1: Preview Contact Lists",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What Does NOT Import" }),
    ).toBeInTheDocument();
  });

  it("renders provider-specific Email Infrastructure documentation content", () => {
    renderPage("/integrations/email-infrastructure/documentation");

    expect(
      screen.getByRole("heading", {
        name: "Email Infrastructure & Sending Domain Guide",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Reading the DNS Status Dashboard",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Warm-Up Best Practices",
      }),
    ).toBeInTheDocument();
  });

  it("renders provider-specific Shopify documentation content", () => {
    renderPage("/integrations/shopify/documentation");

    expect(
      screen.getByRole("heading", {
        name: "Shopify Integration Guide",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Data Dashboard Tabs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Admin Diagnostics" }),
    ).toBeInTheDocument();
  });

  it("renders provider-specific HubSpot documentation content", () => {
    renderPage("/integrations/hubspot/documentation");

    expect(
      screen.getByRole("heading", {
        name: "HubSpot Integration Guide (Coming Soon)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What You'll Need" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Frequently Asked Questions",
      }),
    ).toBeInTheDocument();
  });

  it("renders provider-specific Zapier documentation content", () => {
    renderPage("/integrations/zapier/documentation");

    expect(
      screen.getByRole("heading", {
        name: "Zapier Integration Guide (In Progress)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Feature Overview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "How to Prepare Before Launch",
      }),
    ).toBeInTheDocument();
  });

  it("renders provider-specific Slack documentation content", () => {
    renderPage("/integrations/slack/documentation");

    expect(
      screen.getByRole("heading", {
        name: "Slack Integration Guide (Coming Soon)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Feature Overview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Frequently Asked Questions",
      }),
    ).toBeInTheDocument();
  });

  it("renders provider-specific Custom Webhooks documentation content", () => {
    renderPage("/integrations/custom-webhooks/documentation");

    expect(
      screen.getByRole("heading", {
        name: "Custom Webhooks Guide (Coming Soon)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Feature Overview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Frequently Asked Questions",
      }),
    ).toBeInTheDocument();
  });

  it("redirects invalid slugs back to integrations with a toast", async () => {
    renderPage("/integrations/not-a-provider/documentation");

    await waitFor(() => {
      expect(screen.getByTestId("location-display")).toHaveTextContent(
        "/integrations",
      );
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      "Documentation not available for this integration",
    );
  });
});
