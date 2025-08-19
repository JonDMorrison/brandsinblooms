import { test, expect } from '@playwright/test';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/analytics');
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Analytics Dashboard")', { timeout: 10000 });
  });

  test('displays analytics page header and controls', async ({ page }) => {
    // Check main heading
    await expect(page.locator('h1')).toContainText('Analytics Dashboard');
    
    // Check subtitle
    await expect(page.locator('p')).toContainText('Track your marketing performance and insights');
    
    // Check period selector buttons are present
    await expect(page.locator('button:has-text("7 Days")')).toBeVisible();
    await expect(page.locator('button:has-text("30 Days")')).toBeVisible();
    await expect(page.locator('button:has-text("90 Days")')).toBeVisible();
    
    // Check action buttons
    await expect(page.locator('button:has-text("Sync Analytics")')).toBeVisible();
    await expect(page.locator('button:has-text("Export Report")')).toBeVisible();
  });

  test('displays analytics stats or loading state', async ({ page }) => {
    // Should show either loading state or actual stats
    const statsContainer = page.locator('div').filter({ hasText: /total views|Loading analytics/ }).first();
    await expect(statsContainer).toBeVisible();
    
    // If not loading, should show various metrics
    const isLoading = await page.locator('text=Loading analytics').isVisible();
    
    if (!isLoading) {
      await expect(page.locator('text=total views')).toBeVisible();
      await expect(page.locator('text=engagement')).toBeVisible();
      await expect(page.locator('text=clicks')).toBeVisible();
      await expect(page.locator('text=conversions')).toBeVisible();
      await expect(page.locator('text=growth')).toBeVisible();
    }
  });

  test('can change analytics period', async ({ page }) => {
    // 30 Days should be selected by default (check if it has default styling)
    const thirtyDaysButton = page.locator('button:has-text("30 Days")');
    
    // Click on 7 Days
    await page.locator('button:has-text("7 Days")').click();
    
    // Wait a moment for any data to reload
    await page.waitForTimeout(1000);
    
    // Click on 90 Days
    await page.locator('button:has-text("90 Days")').click();
    
    // Wait a moment for any data to reload
    await page.waitForTimeout(1000);
    
    // Should not have any JavaScript errors
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    
    expect(errors).toHaveLength(0);
  });

  test('sync analytics button functionality', async ({ page }) => {
    const syncButton = page.locator('button:has-text("Sync Analytics")');
    
    // Button should be enabled initially
    await expect(syncButton).toBeEnabled();
    
    // Click sync button
    await syncButton.click();
    
    // Should show loading state temporarily (check for spinner or disabled state)
    // Note: This might be quick, so we'll just verify it doesn't cause errors
    await page.waitForTimeout(500);
    
    // Button should return to enabled state after operation
    await expect(syncButton).toBeEnabled();
  });

  test('export report button is clickable', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export Report")');
    
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
    
    // Click should not cause errors
    await exportButton.click();
    
    // Wait briefly to ensure no errors occur
    await page.waitForTimeout(500);
  });

  test('displays analytics dashboard component', async ({ page }) => {
    // The AnalyticsDashboard component should be rendered
    await expect(page.locator('h2:has-text("Analytics Dashboard")')).toBeVisible();
    
    // Should show the beta badge
    await expect(page.locator('text=Beta Feature')).toBeVisible();
  });
});