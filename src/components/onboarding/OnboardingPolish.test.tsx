import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AuthStepProgress } from "@/components/auth";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { DataReviewStep } from "./DataReviewStep";
import { UrlInputStep } from "./UrlInputStep";
import { WebsiteAnalysisLoader } from "./WebsiteAnalysisLoader";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const extractedData = {
  businessName: "Bloom Garden Center",
  aboutBusiness: "Neighborhood plants and supplies.",
  brandVoice: "Warm and expert",
  annualEvents: "Spring sale",
  location: "Portland, OR",
  services: "Plants, pots, soil",
  locationExtraction: {
    postal_code: "97215",
    city: "Portland",
    state_province: "OR",
    country: "US" as const,
    source: "website",
    confidence: "low" as const,
    snippet: null,
    candidates: [],
    requires_confirmation: true,
  },
};

describe("onboarding polish", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows exact website URL validation copy", () => {
    const setWebsiteUrl = vi.fn();
    const onAnalyze = vi.fn();

    const { rerender } = render(
      <UrlInputStep
        websiteUrl=""
        setWebsiteUrl={setWebsiteUrl}
        onAnalyze={onAnalyze}
        onManualEntry={vi.fn()}
        isAnalyzing={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Analyze My Website" }));
    expect(screen.getByText("Please enter a website URL")).toBeInTheDocument();

    rerender(
      <UrlInputStep
        websiteUrl="http://example.com"
        setWebsiteUrl={setWebsiteUrl}
        onAnalyze={onAnalyze}
        onManualEntry={vi.fn()}
        isAnalyzing={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Analyze My Website" }));
    expect(screen.getByText("Please enter a valid URL")).toBeInTheDocument();
    expect(onAnalyze).not.toHaveBeenCalled();
  });

  it("announces website analysis with the exact live status copy", () => {
    render(<WebsiteAnalysisLoader isAnalyzing />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Analyzing your website...",
    );
  });

  it("labels onboarding progress steps", () => {
    render(
      <AuthStepProgress
        steps={["Website URL", "Review & Confirm"]}
        currentStep={1}
      />,
    );

    expect(screen.getByLabelText("Step 1 of 2: Website URL")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("blocks completion with exact location confirmation copy", () => {
    const onComplete = vi.fn();

    render(
      <DataReviewStep
        extractedData={extractedData}
        updateExtractedData={vi.fn()}
        onBack={vi.fn()}
        onComplete={onComplete}
        isCompleting={false}
        isAnalyzing={false}
        onLocationConfirmationChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Complete Setup" }));

    expect(
      screen.getByText("Please confirm your location"),
    ).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("DataReviewStep: country picker renders and defaults to extracted country", () => {
    render(
      <DataReviewStep
        extractedData={extractedData}
        updateExtractedData={vi.fn()}
        onBack={vi.fn()}
        onComplete={vi.fn()}
        isCompleting={false}
        isAnalyzing={false}
        onLocationConfirmationChange={vi.fn()}
      />,
    );

    const combo = screen.getByRole("combobox", { name: /country/i });
    expect(combo).toBeInTheDocument();
    expect(combo).toHaveTextContent(/united states/i);
  });

  it("DataReviewStep: typing 75000 with US selected does NOT flip the picker", () => {
    const lahoreData = {
      ...extractedData,
      locationExtraction: {
        ...extractedData.locationExtraction,
        postal_code: null,
        city: null,
        state_province: null,
        country: null,
      },
    };

    render(
      <DataReviewStep
        extractedData={lahoreData}
        updateExtractedData={vi.fn()}
        onBack={vi.fn()}
        onComplete={vi.fn()}
        isCompleting={false}
        isAnalyzing={false}
        onLocationConfirmationChange={vi.fn()}
      />,
    );

    const postalInput = screen.getByLabelText("Postal / ZIP Code");
    fireEvent.change(postalInput, { target: { value: "75000" } });

    // Picker still says United States — country is user-driven now.
    expect(
      screen.getByRole("combobox", { name: /country/i }),
    ).toHaveTextContent(/united states/i);
  });

  it("DataReviewStep: flipping picker to Canada surfaces a soft warning on a US-shape postal", async () => {
    const user = userEvent.setup();
    const lahoreData = {
      ...extractedData,
      locationExtraction: {
        ...extractedData.locationExtraction,
        postal_code: null,
        city: null,
        state_province: null,
        country: null,
      },
    };

    render(
      <DataReviewStep
        extractedData={lahoreData}
        updateExtractedData={vi.fn()}
        onBack={vi.fn()}
        onComplete={vi.fn()}
        isCompleting={false}
        isAnalyzing={false}
        onLocationConfirmationChange={vi.fn()}
      />,
    );

    const postalInput = screen.getByLabelText("Postal / ZIP Code");
    fireEvent.change(postalInput, { target: { value: "75000" } });

    await user.click(screen.getByRole("combobox", { name: /country/i }));
    await user.click(await screen.findByRole("option", { name: /canada/i }));

    const matches = await screen.findAllByText(
      /Doesn't look like a Canadian postal code/i,
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  it("blocks manual onboarding navigation with exact location confirmation copy", async () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onComplete={vi.fn()} />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Tell us about your business",
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("About Your Business"), {
      target: { value: "Neighborhood garden center" },
    });
    fireEvent.change(screen.getByLabelText("Brand Voice"), {
      target: { value: "Warm and helpful" },
    });
    fireEvent.change(screen.getByLabelText("Annual Events"), {
      target: { value: "Spring sale" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByRole("heading", { name: "Confirm your location" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Postal / ZIP Code"), {
      target: { value: "97215" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      screen.getByText("Please confirm your location"),
    ).toBeInTheDocument();
  });
});
