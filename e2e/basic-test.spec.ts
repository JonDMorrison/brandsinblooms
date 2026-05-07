import { test, expect } from "@playwright/test";

test.describe("Basic E2E Setup Verification", () => {
  test("should load the application homepage", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("homepage-shell")).toBeVisible();
    // Static tagline below the rotating typewriter line — stable
    // assertion that doesn't depend on which phrase the typewriter is
    // currently displaying.
    await expect(
      page.getByText("Built For Garden Centres.", { exact: true }),
    ).toBeVisible();
  });

  test("should have working navigation to auth page", async ({ page }) => {
    await page.goto("/auth");

    // Should see the auth tabs
    await expect(page.getByRole("tab", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Sign Up" })).toBeVisible();

    // Should be able to switch tabs
    await page.getByRole("tab", { name: "Sign Up" }).click();
    await expect(page.locator('input[placeholder*="full name"]')).toBeVisible();
  });
});
