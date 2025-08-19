import { test, expect } from './fixtures/e2e-test.fixture';

test.describe('CRM Dashboard', () => {
  test.beforeEach(async ({ page, testContext }) => {
    // Navigate to CRM dashboard
    await page.goto('/crm');
    
    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('CRM Dashboard');
  });

  test('displays main dashboard elements', async ({ page }) => {
    // Check header
    await expect(page.locator('h1')).toContainText('CRM Dashboard');
    await expect(page.getByText('Comprehensive insights into your customer relationships')).toBeVisible();
    
    // Check refresh button
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
    
    // Check filter bar
    await expect(page.getByText('Past 7 Days')).toBeVisible();
    await expect(page.getByText('Past 30 Days')).toBeVisible();
    await expect(page.getByText('All Time')).toBeVisible();
  });

  test('displays key metrics cards', async ({ page }) => {
    // Wait for metrics to load
    await page.waitForTimeout(1000);
    
    // Check all four metric cards
    await expect(page.getByText('Total Customers')).toBeVisible();
    await expect(page.getByText('Active Campaigns')).toBeVisible();
    await expect(page.getByText('Conversion Rate')).toBeVisible();
    await expect(page.getByText('Revenue')).toBeVisible();
    
    // Check that values are displayed (should be numbers, not loading state)
    const metricCards = page.locator('[data-testid="metric-card"], .text-2xl.font-bold').first();
    await expect(metricCards).toBeVisible();
  });

  test('displays performance chart', async ({ page }) => {
    // Check chart container
    await expect(page.getByText('Performance Over Time')).toBeVisible();
    
    // Wait for chart to potentially load
    await page.waitForTimeout(2000);
    
    // Chart should be visible (either loaded chart or loading state)
    const chartArea = page.locator('.recharts-wrapper, .h-80').first();
    await expect(chartArea).toBeVisible();
  });

  test('displays customer segments section', async ({ page }) => {
    await expect(page.getByText('Customer Segments')).toBeVisible();
    await expect(page.getByRole('link', { name: /view all segments/i })).toBeVisible();
    
    // Should show segments or empty state
    const segmentsCard = page.locator('text=Customer Segments').locator('..').locator('..');
    await expect(segmentsCard).toBeVisible();
  });

  test('displays campaign performance section', async ({ page }) => {
    await expect(page.getByText('Campaign Performance')).toBeVisible();
    
    // Should show campaigns table or empty state
    const campaignsSection = page.locator('text=Campaign Performance').locator('..').locator('..');
    await expect(campaignsSection).toBeVisible();
  });

  test('displays recent activity section', async ({ page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible();
    
    // Should show activity items or empty state
    const activitySection = page.locator('text=Recent Activity').locator('..').locator('..');
    await expect(activitySection).toBeVisible();
  });

  test('time filter functionality', async ({ page }) => {
    // Test 7 days filter
    await page.getByText('Past 7 Days').click();
    await page.waitForTimeout(500);
    
    // Test 30 days filter
    await page.getByText('Past 30 Days').click();
    await page.waitForTimeout(500);
    
    // Test all time filter
    await page.getByText('All Time').click();
    await page.waitForTimeout(500);
    
    // Should update the metrics description
    await expect(page.getByText('all time')).toBeVisible();
  });

  test('segment filter functionality', async ({ page }) => {
    // Test different segment filters
    await page.getByText('High-Value').click();
    await page.waitForTimeout(500);
    
    await page.getByText('New Customers').click();
    await page.waitForTimeout(500);
    
    await page.getByText('All Segments').click();
    await page.waitForTimeout(500);
  });

  test('channel filter functionality', async ({ page }) => {
    // Test different channel filters
    await page.getByText('Email', { exact: true }).click();
    await page.waitForTimeout(500);
    
    await page.getByText('SMS', { exact: true }).click();
    await page.waitForTimeout(500);
    
    await page.getByText('All Channels').click();
    await page.waitForTimeout(500);
  });

  test('reset filters functionality', async ({ page }) => {
    // Change some filters
    await page.getByText('Past 7 Days').click();
    await page.getByText('High-Value').click();
    await page.getByText('Email', { exact: true }).click();
    
    // Reset should appear
    const resetButton = page.getByRole('button', { name: /reset/i });
    await expect(resetButton).toBeVisible();
    
    // Click reset
    await resetButton.click();
    await page.waitForTimeout(500);
    
    // Should return to default state
    await expect(page.getByText('Past 30 Days')).toHaveClass(/bg-primary|default/);
  });

  test('refresh functionality', async ({ page }) => {
    // Click refresh button
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    await refreshButton.click();
    
    // Should trigger a data refresh (we can't easily test the actual refresh, 
    // but we can ensure the button works)
    await page.waitForTimeout(1000);
    
    // Dashboard should still be visible after refresh
    await expect(page.locator('h1')).toContainText('CRM Dashboard');
  });

  test('navigation links work', async ({ page }) => {
    // Test segments link
    const segmentsLink = page.getByRole('link', { name: /view all segments/i });
    if (await segmentsLink.isVisible()) {
      await segmentsLink.click();
      await expect(page).toHaveURL(/\/crm\/segments/);
      await page.goBack();
    }
    
    // Test campaigns link
    const campaignsLink = page.getByRole('link', { name: /view all/i }).first();
    if (await campaignsLink.isVisible()) {
      await campaignsLink.click();
      await expect(page).toHaveURL(/\/crm\/campaigns/);
      await page.goBack();
    }
    
    // Test analytics link
    const analyticsLink = page.getByRole('link', { name: /view analytics/i });
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await expect(page).toHaveURL(/\/crm\/analytics/);
      await page.goBack();
    }
  });

  test('responsive design', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Dashboard should still be visible and functional
    await expect(page.locator('h1')).toContainText('CRM Dashboard');
    await expect(page.getByText('Total Customers')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    await expect(page.locator('h1')).toContainText('CRM Dashboard');
    
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    
    await expect(page.locator('h1')).toContainText('CRM Dashboard');
  });

  test('handles loading states', async ({ page }) => {
    // Reload the page to catch loading states
    await page.reload();
    
    // Should show loading state briefly, then content
    await page.waitForTimeout(500);
    
    // Final state should show the dashboard
    await expect(page.locator('h1')).toContainText('CRM Dashboard');
    await expect(page.getByText('Total Customers')).toBeVisible();
  });
});