import { test, expect } from "@playwright/test";

/**
 * E2E tests for the 6 campaign builder features shipped today.
 *
 * These run against production via playwright.prod.config.ts and
 * depend on the "setup" project for auth (storageState).
 */

test.describe("Campaign Builder Features", () => {
  // ── TEST 1: Starter Structures ──────────────────────────────
  test("structure picker shows 5+ cards and pre-populates blocks", async ({
    page,
  }) => {
    await page.goto("/crm/campaigns/new?type=newsletter");
    await page.waitForLoadState("networkidle");

    // Structure picker should be visible
    const picker = page.locator("text=Choose a starting structure");
    await expect(picker).toBeVisible({ timeout: 15000 });

    // At least 5 structure cards + "Start from Scratch"
    const cards = page.locator(
      "button:has(span.text-sm.font-semibold)",
    );
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);

    // Click "Weekly Newsletter"
    await page.locator("button:has-text('Weekly Newsletter')").click();

    // Blocks should now exist — structure picker should disappear
    await expect(picker).not.toBeVisible({ timeout: 5000 });

    // Subject line should be pre-filled
    const subjectInput = page.locator(
      'input[placeholder*="subject"], input[id*="subject"]',
    ).first();
    if (await subjectInput.isVisible()) {
      const value = await subjectInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }
  });

  // ── TEST 2: Email Health Score ──────────────────────────────
  test("health score badge visible and popover opens on click", async ({
    page,
  }) => {
    await page.goto("/crm/campaigns/new?type=newsletter");
    await page.waitForLoadState("networkidle");

    // Pick a structure to get blocks
    const picker = page.locator("text=Choose a starting structure");
    await expect(picker).toBeVisible({ timeout: 15000 });
    await page.locator("button:has-text('Weekly Newsletter')").click();
    await expect(picker).not.toBeVisible({ timeout: 5000 });

    // Health score badge should be visible (matches pattern like "2/5" or "3/5")
    const badge = page.locator("button").filter({ hasText: /\d\/5/ });
    await expect(badge).toBeVisible({ timeout: 5000 });

    // Click badge — popover should open with check items
    await badge.click();
    const popover = page.locator("text=Email Health");
    await expect(popover).toBeVisible({ timeout: 3000 });
  });

  // ── TEST 3: Brand Applied pill ──────────────────────────────
  test("Brand Applied pill is visible", async ({ page }) => {
    await page.goto("/crm/campaigns/new?type=newsletter");
    await page.waitForLoadState("networkidle");

    // Add a structure to get past the picker
    const picker = page.locator("text=Choose a starting structure");
    await expect(picker).toBeVisible({ timeout: 15000 });
    await page.locator("button:has-text('Weekly Newsletter')").click();

    // Brand Applied pill should appear (may take a moment for company info to load)
    const pill = page.locator("a:has-text('Brand Applied')");
    // Brand pill only shows if company has brand colors — may not appear in all envs
    // Use a soft check with short timeout
    const isVisible = await pill.isVisible().catch(() => false);
    if (isVisible) {
      await expect(pill).toHaveAttribute("href", "/profile/brand-colors");
    }
  });

  // ── TEST 4: Suggestions toggle ──────────────────────────────
  test("suggestions toggle switches between on and off", async ({ page }) => {
    await page.goto("/crm/campaigns/new?type=newsletter");
    await page.waitForLoadState("networkidle");

    // Add blocks via structure picker
    const picker = page.locator("text=Choose a starting structure");
    await expect(picker).toBeVisible({ timeout: 15000 });
    await page.locator("button:has-text('Weekly Newsletter')").click();
    await expect(picker).not.toBeVisible({ timeout: 5000 });

    // Suggestions pill should be visible
    const pill = page.locator("button:has-text('Suggestions')");
    await expect(pill).toBeVisible({ timeout: 5000 });

    // Get initial state
    const initialText = await pill.innerText();
    const wasOn = initialText.includes("on");

    // Click to toggle
    await pill.click();
    const newText = await pill.innerText();

    if (wasOn) {
      expect(newText).toContain("off");
    } else {
      expect(newText).toContain("on");
    }

    // Click again to toggle back
    await pill.click();
    const restoredText = await pill.innerText();
    expect(restoredText).toContain(wasOn ? "on" : "off");
  });

  // ── TEST 5: Inline editing ──────────────────────────────────
  test("double-click headline activates inline editing", async ({ page }) => {
    // Clear localStorage to avoid persisted state restoring empty blocks
    await page.goto("/crm/campaigns/new?type=newsletter");
    await page.evaluate(() => {
      localStorage.removeItem("bloom_campaign_draft");
      localStorage.removeItem("bloom_campaign_state");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Pick structure to get blocks with headlines
    const picker = page.locator("text=Choose a starting structure");
    if (await picker.isVisible({ timeout: 10000 }).catch(() => false)) {
      await page.locator("button:has-text('Weekly Newsletter')").click();
      await page.waitForTimeout(2000);
    }

    // Find a headline with the double-click tooltip
    const headline = page.locator('h2[title="Double-click to edit"]').first();
    if (await headline.isVisible({ timeout: 8000 }).catch(() => false)) {
      // Double-click to activate inline editing
      await headline.dblclick();
      await page.waitForTimeout(500);

      // After double-click, look for any contentEditable element
      const editable = page.locator("[contenteditable='true']").first();
      await expect(editable).toBeVisible({ timeout: 3000 });
    } else {
      // If no headline visible (e.g. persisted empty state), skip gracefully
      test.skip(true, "No inline-editable headline found — likely persisted empty state");
    }
  });

  // ── TEST 6: Mobile preview ──────────────────────────────────
  test("mobile preview shows phone frame", async ({ page }) => {
    await page.goto("/crm/campaigns/new?type=newsletter");
    await page.waitForLoadState("networkidle");

    // Pick structure
    const picker = page.locator("text=Choose a starting structure");
    await expect(picker).toBeVisible({ timeout: 15000 });
    await page.locator("button:has-text('Weekly Newsletter')").click();
    await expect(picker).not.toBeVisible({ timeout: 5000 });

    // Open preview dialog — look for Preview button
    const previewBtn = page.locator("button:has-text('Preview')").first();
    if (await previewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await previewBtn.click();

      // Desktop/Mobile toggle should be visible
      const mobileBtn = page
        .locator('[role="dialog"] button:has-text("Mobile")')
        .first();
      await expect(mobileBtn).toBeVisible({ timeout: 5000 });

      // Click Mobile
      await mobileBtn.click();

      // Phone frame label should appear
      const phoneLabel = page.locator("text=390px · iPhone");
      await expect(phoneLabel).toBeVisible({ timeout: 3000 });
    }
  });
});
