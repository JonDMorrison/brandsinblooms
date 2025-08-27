import { test, expect } from '@playwright/test';

test.describe('CTA Button Visibility and Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to campaign creator
    await page.goto('/crm/campaigns/new');
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="campaign-name-input"]', { timeout: 10000 });
  });

  test('CTA button appears and persists after save in Image & Text Section', async ({ page }) => {
    // Set campaign name
    await page.fill('[data-testid="campaign-name-input"]', 'CTA Test Campaign');
    
    // Add a Text & Image Section
    await page.click('[data-testid="add-block-button"]');
    await page.click('[data-testid="layout-image-left"]');
    
    // Wait for block to be added
    await page.waitForSelector('[data-testid="content-block"]');
    
    // Click to edit text content
    await page.click('[data-testid="edit-text-button"]');
    
    // Fill in headline and body
    await page.fill('input[placeholder*="headline"]', 'Test Headline');
    await page.fill('textarea[placeholder*="body"], [contenteditable][placeholder*="body"]', 'This is test body content.');
    
    // Fill in CTA fields
    await page.fill('input[placeholder*="button text"]', 'Shop Now');
    await page.fill('input[placeholder*="button url"]', 'https://example.com');
    
    // Save the text editor
    await page.click('button:has-text("Save")');
    
    // Wait for save to complete
    await page.waitForTimeout(1000);
    
    // Verify CTA button is immediately visible in preview
    const ctaButton = page.locator('a:has-text("Shop Now"), button:has-text("Shop Now")');
    await expect(ctaButton).toBeVisible();
    
    // Verify button has correct URL
    const ctaLink = page.locator('a:has-text("Shop Now")');
    if (await ctaLink.count() > 0) {
      await expect(ctaLink).toHaveAttribute('href', 'https://example.com');
    }
    
    // Save campaign
    await page.click('button:has-text("Save as Draft")');
    await page.waitForSelector(':has-text("Campaign saved")', { timeout: 5000 });
    
    // Reload page to test persistence
    await page.reload();
    await page.waitForSelector('[data-testid="content-block"]');
    
    // Verify CTA button still visible after reload
    await expect(page.locator('a:has-text("Shop Now"), button:has-text("Shop Now")')).toBeVisible();
    
    // Verify button still has correct URL
    const persistedCtaLink = page.locator('a:has-text("Shop Now")');
    if (await persistedCtaLink.count() > 0) {
      await expect(persistedCtaLink).toHaveAttribute('href', 'https://example.com');
    }
  });

  test('CTA button appears in Image block', async ({ page }) => {
    // Set campaign name
    await page.fill('[data-testid="campaign-name-input"]', 'Image CTA Test');
    
    // Add an Image block
    await page.click('[data-testid="add-block-button"]');
    await page.click('[data-testid="layout-image-full"]');
    
    // Wait for block to be added
    await page.waitForSelector('[data-testid="content-block"]');
    
    // Click to edit text content (should still be available for image blocks)
    await page.click('[data-testid="edit-text-button"]');
    
    // Fill in CTA fields
    await page.fill('input[placeholder*="button text"]', 'View Gallery');
    await page.fill('input[placeholder*="button url"]', 'https://gallery.example.com');
    
    // Save
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);
    
    // Verify CTA button is visible
    const ctaButton = page.locator('a:has-text("View Gallery"), button:has-text("View Gallery")');
    await expect(ctaButton).toBeVisible();
  });

  test('CTA button updates when fields are changed', async ({ page }) => {
    // Set campaign name
    await page.fill('[data-testid="campaign-name-input"]', 'CTA Update Test');
    
    // Add a block
    await page.click('[data-testid="add-block-button"]');
    await page.click('[data-testid="layout-image-left"]');
    
    await page.waitForSelector('[data-testid="content-block"]');
    
    // First, add initial CTA
    await page.click('[data-testid="edit-text-button"]');
    await page.fill('input[placeholder*="button text"]', 'Initial Button');
    await page.fill('input[placeholder*="button url"]', 'https://initial.com');
    await page.click('button:has-text("Save")');
    
    // Verify initial button
    await expect(page.locator('text=Initial Button')).toBeVisible();
    
    // Update CTA
    await page.click('[data-testid="edit-text-button"]');
    await page.fill('input[placeholder*="button text"]', 'Updated Button');
    await page.fill('input[placeholder*="button url"]', 'https://updated.com');
    await page.click('button:has-text("Save")');
    
    // Verify updated button
    await expect(page.locator('text=Updated Button')).toBeVisible();
    await expect(page.locator('text=Initial Button')).not.toBeVisible();
  });

  test('CTA button disappears when fields are cleared', async ({ page }) => {
    // Set campaign name
    await page.fill('[data-testid="campaign-name-input"]', 'CTA Clear Test');
    
    // Add a block with CTA
    await page.click('[data-testid="add-block-button"]');
    await page.click('[data-testid="layout-image-left"]');
    
    await page.waitForSelector('[data-testid="content-block"]');
    
    // Add CTA
    await page.click('[data-testid="edit-text-button"]');
    await page.fill('input[placeholder*="button text"]', 'Remove Me');
    await page.fill('input[placeholder*="button url"]', 'https://remove.com');
    await page.click('button:has-text("Save")');
    
    // Verify button exists
    await expect(page.locator('text=Remove Me')).toBeVisible();
    
    // Clear CTA fields
    await page.click('[data-testid="edit-text-button"]');
    await page.fill('input[placeholder*="button text"]', '');
    await page.fill('input[placeholder*="button url"]', '');
    await page.click('button:has-text("Save")');
    
    // Verify button is gone
    await expect(page.locator('text=Remove Me')).not.toBeVisible();
  });
});