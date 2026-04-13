import { test, expect } from "@playwright/test";

test.describe("Campaign Builder — Core UX", () => {
  // These tests navigate to the campaign builder.
  // Without authentication the app redirects to /auth, so we verify the
  // redirect works (the route exists and the app doesn't crash).

  test("campaign /new route loads without crashing", async ({ page }) => {
    const response = await page.goto("/crm/campaigns/new");

    // App should respond (not 500 / network error)
    expect(response?.status()).toBeLessThan(500);

    // Should either show the builder (authenticated) or redirect to auth
    await page.waitForURL(/\/(crm\/campaigns|auth)/, { timeout: 15000 });

    // No React error boundary should be visible
    await expect(
      page.locator("text=Something went wrong"),
    ).not.toBeVisible();
  });

  test("campaign /:id route loads without crashing", async ({ page }) => {
    // Use a UUID that may or may not exist — we just verify no crash
    const response = await page.goto(
      "/crm/campaigns/d2679f4d-4bc3-4fd0-8c33-a4279668c42d",
    );

    expect(response?.status()).toBeLessThan(500);

    await page.waitForURL(/\/(crm\/campaigns|auth)/, { timeout: 15000 });

    await expect(
      page.locator("text=Something went wrong"),
    ).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// The tests below require an authenticated session.
// Run with the "chromium" project in playwright.prod.config.ts
// which depends on the auth setup project and injects storageState.
// ─────────────────────────────────────────────────────────────

test.describe("Campaign Builder — Block Interactions (requires auth)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/crm/campaigns/new");
    // Wait for the builder to be ready
    await page.waitForSelector("text=Add Block", { timeout: 15000 });
  });

  test("add a block and verify it appears", async ({ page }) => {
    // Click the first "Add Block" button
    await page.click("button:has-text('Add Block')");

    // Pick a text block from the layout modal
    const textOption = page.locator(
      '[data-testid="layout-text-plain"], text=Text',
    );
    await textOption.first().click();

    // A new block card should appear
    await expect(
      page.locator(".click-to-edit-block"),
    ).toHaveCount(1, { timeout: 5000 });
  });

  test("delete confirmation — cancel preserves block", async ({ page }) => {
    // Add a block first
    await page.click("button:has-text('Add Block')");
    await page.locator("text=Text").first().click();
    await page.waitForSelector(".click-to-edit-block");

    // Hover the block to reveal the tools menu
    const block = page.locator(".click-to-edit-container").first();
    await block.hover();

    // Click the delete/trash button in the tools dropdown
    const trashButton = block.locator('button[title="Delete block"]');
    if (await trashButton.isVisible()) {
      await trashButton.click();
    } else {
      // Might be in ToolsDropdownMenu — open it and find delete
      const toolsBtn = block.locator(
        'button:has(svg.lucide-more-horizontal), button:has(svg.lucide-settings)',
      );
      if (await toolsBtn.isVisible()) {
        await toolsBtn.click();
        await page.click("text=Delete");
      }
    }

    // Inline confirmation should appear
    await expect(page.locator("text=Delete this block?")).toBeVisible();

    // Click Cancel
    await page.click("button:has-text('Cancel')");

    // Block should still exist
    await expect(page.locator(".click-to-edit-block")).toHaveCount(1);

    // Confirmation should be gone
    await expect(
      page.locator("text=Delete this block?"),
    ).not.toBeVisible();
  });

  test("undo reverts block deletion", async ({ page }) => {
    // Add a block
    await page.click("button:has-text('Add Block')");
    await page.locator("text=Text").first().click();
    await page.waitForSelector(".click-to-edit-block");

    // Delete it (confirm)
    const block = page.locator(".click-to-edit-container").first();
    await block.hover();
    const trashButton = block.locator('button[title="Delete block"]');
    if (await trashButton.isVisible()) {
      await trashButton.click();
    }
    await page.click("button:has-text('Yes, delete')");

    // Block should be gone
    await expect(page.locator(".click-to-edit-block")).toHaveCount(0);

    // Undo with Cmd+Z
    await page.keyboard.press("Meta+z");

    // Block should reappear
    await expect(
      page.locator(".click-to-edit-block"),
    ).toHaveCount(1, { timeout: 3000 });
  });

  test("drag-to-reorder changes block order", async ({ page }) => {
    // Add two blocks
    await page.click("button:has-text('Add Block')");
    await page.locator("text=Text").first().click();
    await page.waitForSelector(".click-to-edit-block");

    await page.click("button:has-text('Add Block')");
    await page.locator("text=Divider").first().click();
    await expect(page.locator(".click-to-edit-block")).toHaveCount(2);

    // Get the drag handles (GripVertical icons in the left gutter)
    const handles = page.locator(
      ".click-to-edit-container .cursor-grab",
    );

    // Drag first block down past the second
    const firstHandle = handles.first();
    const secondBlock = page.locator(".click-to-edit-container").nth(1);

    const firstBox = await firstHandle.boundingBox();
    const secondBox = await secondBlock.boundingBox();

    if (firstBox && secondBox) {
      await page.mouse.move(
        firstBox.x + firstBox.width / 2,
        firstBox.y + firstBox.height / 2,
      );
      await page.mouse.down();
      // Move past the second block
      await page.mouse.move(
        secondBox.x + secondBox.width / 2,
        secondBox.y + secondBox.height + 10,
        { steps: 10 },
      );
      await page.mouse.up();
    }

    // Verify the order changed — undo button should appear (meaning history was pushed)
    const undoBtn = page.locator('button[title="Undo (Ctrl+Z)"]');
    await expect(undoBtn).toBeVisible({ timeout: 3000 });
  });
});
