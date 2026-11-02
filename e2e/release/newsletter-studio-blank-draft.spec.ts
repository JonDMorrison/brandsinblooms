import { test, expect } from "@playwright/test";

test("a new newsletter opens Design Studio without subject or preview", async ({ page }) => {
  await page.goto("/crm/campaigns/new?type=newsletter");
  const studioEntry = page.getByRole("button", { name: "Customize in Design Studio", exact: true });
  await expect(studioEntry).toBeVisible();
  await expect(studioEntry).not.toHaveAttribute("aria-disabled", "true");
  await studioEntry.click();
  await expect(page).toHaveURL(/\/crm\/campaigns\/[0-9a-f-]+\/studio(?:\?|$)/, { timeout: 30000 });
  await expect(page.getByText("Save the draft before opening Campaign Studio")).toHaveCount(0);
  await expect(page.getByText("Could not create your newsletter draft")).toHaveCount(0);
});
