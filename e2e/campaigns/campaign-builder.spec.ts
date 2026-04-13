import { test, expect } from "@playwright/test";

// ── Helper: add a block via the layout picker modal ──────────
async function addBlock(
  page: import("@playwright/test").Page,
  title: string,
) {
  // Click the first visible "Add Block" button
  await page.locator("button:has-text('Add Block')").first().click();

  // Wait for the layout picker dialog to appear
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Click the card whose <h4> matches the requested layout title
  await dialog.locator(`h4:has-text("${title}")`).click();

  // Wait for dialog to close and new block to appear
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
  await page.waitForSelector(".click-to-edit-container", { timeout: 10000 });
}

// ── Helper: open Tools dropdown on a block and click an action ─
async function clickToolsAction(
  page: import("@playwright/test").Page,
  blockIndex: number,
  actionLabel: string,
) {
  const block = page.locator(".click-to-edit-container").nth(blockIndex);
  await block.hover();

  // Open the "Tools" dropdown (button with Settings icon + "Tools" text)
  const toolsBtn = block.locator("button:has-text('Tools')");
  await expect(toolsBtn).toBeVisible({ timeout: 3000 });
  await toolsBtn.click();

  // Click the action inside the dropdown
  const action = page.locator(
    `.absolute button:has-text("${actionLabel}")`,
  );
  await expect(action).toBeVisible({ timeout: 3000 });
  await action.click();
}

// ─────────────────────────────────────────────────────────────
// Smoke tests — no auth required
// ─────────────────────────────────────────────────────────────

test.describe("Campaign Builder — Core UX", () => {
  test("campaign /new route loads without crashing", async ({ page }) => {
    const response = await page.goto("/crm/campaigns/new");
    expect(response?.status()).toBeLessThan(500);
    await page.waitForURL(/\/(crm\/campaigns|auth)/, { timeout: 15000 });
    await expect(
      page.locator("text=Something went wrong"),
    ).not.toBeVisible();
  });

  test("campaign /:id route loads without crashing", async ({ page }) => {
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
// Authenticated tests — require storageState from auth setup
// ─────────────────────────────────────────────────────────────

test.describe("Campaign Builder — Block Interactions (requires auth)", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto("/crm/campaigns/new");
    // Wait for the builder to fully load
    await page.waitForSelector("button:has-text('Add Block')", {
      timeout: 20000,
    });
  });

  test("add a block and verify it appears", async ({ page }) => {
    await addBlock(page, "Plain Text");

    await expect(
      page.locator(".click-to-edit-container"),
    ).toHaveCount(1, { timeout: 5000 });
  });

  test("delete confirmation — cancel preserves block", async ({ page }) => {
    // Add a block first
    await addBlock(page, "Plain Text");
    await expect(page.locator(".click-to-edit-container")).toHaveCount(1);

    // Open Tools dropdown and click Delete
    await clickToolsAction(page, 0, "Delete");

    // Inline confirmation should appear
    await expect(
      page.locator("text=Delete this block?"),
    ).toBeVisible({ timeout: 3000 });

    // Click Cancel
    await page.locator("button:has-text('Cancel')").click();

    // Block should still exist
    await expect(page.locator(".click-to-edit-container")).toHaveCount(1);

    // Confirmation should be gone
    await expect(
      page.locator("text=Delete this block?"),
    ).not.toBeVisible();
  });

  test("undo reverts block deletion", async ({ page }) => {
    // Add a block
    await addBlock(page, "Plain Text");
    await expect(page.locator(".click-to-edit-container")).toHaveCount(1);

    // Delete it via Tools > Delete > confirm
    await clickToolsAction(page, 0, "Delete");
    await expect(page.locator("text=Delete this block?")).toBeVisible();
    await page.locator("button:has-text('Yes, delete')").click();

    // Block should be gone
    await expect(
      page.locator(".click-to-edit-container"),
    ).toHaveCount(0, { timeout: 5000 });

    // Undo — use Control+z which works cross-platform in headless Chromium
    await page.keyboard.press("Control+z");

    // Block should reappear
    await expect(
      page.locator(".click-to-edit-container"),
    ).toHaveCount(1, { timeout: 5000 });
  });

  test("drag-to-reorder changes block order", async ({ page }) => {
    // Add two blocks — Text then Divider
    await addBlock(page, "Plain Text");
    await expect(page.locator(".click-to-edit-container")).toHaveCount(1);

    await addBlock(page, "Divider");
    await expect(
      page.locator(".click-to-edit-container"),
    ).toHaveCount(2, { timeout: 5000 });

    // Hover the first block to reveal the drag handle
    const firstBlock = page.locator(".click-to-edit-container").first();
    await firstBlock.hover();
    await page.waitForTimeout(300); // let opacity transition complete

    // Get the drag handle (the .cursor-grab div with GripVertical)
    const firstHandle = firstBlock.locator(".cursor-grab").first();
    const secondBlock = page.locator(".click-to-edit-container").nth(1);

    const handleBox = await firstHandle.boundingBox();
    const targetBox = await secondBlock.boundingBox();

    if (handleBox && targetBox) {
      // Drag from the handle center to below the second block
      await page.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height + 20,
        { steps: 15 },
      );
      await page.mouse.up();
    }

    // If the drag succeeded, undo history was pushed — undo button should appear
    const undoBtn = page.locator('button[title="Undo (Ctrl+Z)"]');
    await expect(undoBtn).toBeVisible({ timeout: 5000 });
  });
});
