import { test, expect } from "@playwright/test";

test.describe("Basic E2E Setup Verification", () => {
  test("should load the application homepage", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("homepage-shell")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Grow Your Green Business" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#hero$/);
  });

  test("should have working navigation to auth page", async ({ page }) => {
    await page.goto("/auth");

    // Should see the auth tabs
    await expect(page.getByRole("tab", { name: "Sign In" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Create Account" }),
    ).toBeVisible();

    // Should be able to switch tabs
    await page.getByRole("tab", { name: "Create Account" }).click();
    await expect(page.locator('input[placeholder*="full name"]')).toBeVisible();
  });
});
