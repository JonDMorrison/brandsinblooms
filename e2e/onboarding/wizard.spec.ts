import { test, expect, type Page } from "@playwright/test";
import { TestDataFactory, TestDatabaseUtils } from "../utils/test-setup";

const ANALYZE_URL_RE = /\/functions\/v1\/analyze-website/;

interface AnalyzePayload {
  extractedData: {
    businessName: string;
    aboutBusiness: string;
    location: string;
    services: string;
    brandVoice: string;
    annualEvents: string;
  };
  extractionMethod: string;
  brandingData: null;
  locationExtraction: {
    postal_code: string | null;
    city: string | null;
    state_province: string | null;
    country: "US" | "CA" | null;
    source: string;
    confidence: "high" | "medium" | "low";
    snippet: string | null;
    candidates: Array<{
      postal_code: string;
      city?: string;
      state_province?: string;
      country?: "US" | "CA";
    }>;
    requires_confirmation: boolean;
  } | null;
}

const fullExtraction: AnalyzePayload = {
  extractedData: {
    businessName: "Bloomwood Garden Center",
    aboutBusiness:
      "Family-owned garden center serving the Pacific Northwest since 1982.",
    location: "Portland, OR",
    services: "Plants, pots, soil, landscape design",
    brandVoice: "Warm, knowledgeable, and approachable.",
    annualEvents: "Spring plant sale, fall harvest festival.",
  },
  extractionMethod: "direct",
  brandingData: null,
  locationExtraction: {
    postal_code: "97215",
    city: "Portland",
    state_province: "OR",
    country: "US",
    source: "jsonld",
    confidence: "high",
    snippet: "Visit us at 1234 SE Hawthorne Blvd, Portland, OR 97215",
    candidates: [],
    requires_confirmation: false,
  },
};

const noLocationExtraction: AnalyzePayload = {
  ...fullExtraction,
  extractedData: {
    ...fullExtraction.extractedData,
    location: "",
  },
  locationExtraction: {
    postal_code: null,
    city: null,
    state_province: null,
    country: null,
    source: "none",
    confidence: "low",
    snippet: null,
    candidates: [],
    requires_confirmation: true,
  },
};

const stubAnalyzer = async (
  page: Page,
  response:
    | { kind: "ok"; body: AnalyzePayload }
    | { kind: "error"; status: number; body: Record<string, unknown> },
) => {
  await page.route(ANALYZE_URL_RE, async (route) => {
    if (response.kind === "ok") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response.body),
      });
    } else {
      await route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: JSON.stringify(response.body),
      });
    }
  });
};

const signUpAndGoToOnboarding = async (page: Page) => {
  const userData = TestDataFactory.generateTestUser();
  const dbUtils = new TestDatabaseUtils();

  await dbUtils.createTestUser(userData);

  await page.goto("/auth");
  await page.locator("#signin-email").waitFor({ state: "visible" });
  await page.fill("#signin-email", userData.email);
  await page.fill("#signin-password", userData.password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL(/\/onboarding(?!\/manual)/, { timeout: 20000 });
  await expect(
    page.getByRole("heading", { name: /set up your store/i }),
  ).toBeVisible({ timeout: 15000 });

  return { userData, dbUtils };
};

test.describe("BloomSuite onboarding wizard", () => {
  test("analyzer success → Review prefills, location auto-confirms, Complete Setup enables", async ({
    page,
  }) => {
    await stubAnalyzer(page, { kind: "ok", body: fullExtraction });
    const { userData, dbUtils } = await signUpAndGoToOnboarding(page);

    try {
      await page.fill('input[id="website-url"]', "https://example-garden.com");
      await page
        .getByRole("button", { name: "Analyze My Website" })
        .click();

      await expect(
        page.getByRole("heading", { name: /review your store profile/i }),
      ).toBeVisible({ timeout: 20000 });

      await expect(page.getByLabel("Business Name")).toHaveValue(
        fullExtraction.extractedData.businessName,
      );
      await expect(page.getByLabel("About Your Business")).toHaveValue(
        fullExtraction.extractedData.aboutBusiness,
      );
      await expect(page.getByLabel("Brand Voice")).toHaveValue(
        fullExtraction.extractedData.brandVoice,
      );
      await expect(page.getByLabel("Annual Events")).toHaveValue(
        fullExtraction.extractedData.annualEvents,
      );

      await expect(page.getByLabel("Postal / ZIP Code")).toHaveValue("97215");
      await expect(page.getByLabel("City")).toHaveValue("Portland");
      await expect(page.getByText(/location confirmed/i)).toBeVisible();

      await expect(
        page.getByRole("button", { name: "Complete Setup" }),
      ).toBeEnabled();
    } finally {
      await dbUtils.cleanupTestData(userData);
    }
  });

  test("analyzer failure → user stays on step 1 with a visible error", async ({
    page,
  }) => {
    await stubAnalyzer(page, {
      kind: "error",
      status: 422,
      body: {
        error: "Website analysis failed: site unreachable",
        type: "extraction",
      },
    });
    const { userData, dbUtils } = await signUpAndGoToOnboarding(page);

    try {
      await page.fill(
        'input[id="website-url"]',
        "https://broken-site.example.com",
      );
      await page
        .getByRole("button", { name: "Analyze My Website" })
        .click();

      // Should remain on the URL input screen (not advance to Review & Confirm).
      await expect(
        page.getByRole("heading", { name: /set up your store/i }),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        page.getByRole("heading", { name: /review your store profile/i }),
      ).toHaveCount(0);

      // The hook surfaces a categorized error through the alert in UrlInputStep.
      await expect(
        page.getByRole("button", { name: /try again|manual entry instead/i }),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await dbUtils.cleanupTestData(userData);
    }
  });

  test("manual location fallback → user fills four inputs, Confirm works, Complete Setup enables", async ({
    page,
  }) => {
    await stubAnalyzer(page, { kind: "ok", body: noLocationExtraction });
    const { userData, dbUtils } = await signUpAndGoToOnboarding(page);

    try {
      await page.fill('input[id="website-url"]', "https://example-garden.com");
      await page
        .getByRole("button", { name: "Analyze My Website" })
        .click();

      await expect(
        page.getByRole("heading", { name: /review your store profile/i }),
      ).toBeVisible({ timeout: 20000 });

      // Location section renders even though analyzer returned no postal/city.
      await expect(
        page.getByRole("heading", { name: /detected location|primary location/i }),
      ).toBeVisible();

      const postalInput = page.getByLabel("Postal / ZIP Code");
      const cityInput = page.getByLabel("City");
      const stateInput = page.getByLabel("State / Province");
      const countryInput = page.getByLabel("Country");

      await expect(postalInput).toHaveValue("");
      await expect(cityInput).toHaveValue("");
      await expect(stateInput).toHaveValue("");
      await expect(countryInput).toHaveValue("");

      const completeButton = page.getByRole("button", {
        name: "Complete Setup",
      });
      await expect(completeButton).toBeDisabled();

      await postalInput.fill("97215");
      await cityInput.fill("Portland");
      await stateInput.fill("OR");
      await countryInput.fill("US");

      await page
        .getByRole("button", { name: /confirm this location/i })
        .click();

      await expect(page.getByText(/location confirmed/i)).toBeVisible();
      await expect(completeButton).toBeEnabled();
    } finally {
      await dbUtils.cleanupTestData(userData);
    }
  });
});
