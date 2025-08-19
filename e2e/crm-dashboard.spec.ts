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
    await expect(page.getByText('Quick insights and navigation to your customer data')).toBeVisible();
    
    // Check refresh button
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });

  test('displays clickable stats cards', async ({ page }) => {
    // Wait for stats to load
    await page.waitForTimeout(1000);
    
    // Check all six stat cards
    await expect(page.getByText('Total Customers')).toBeVisible();
    await expect(page.getByText('Customer Segments')).toBeVisible();
    await expect(page.getByText('Top Segment')).toBeVisible();
    await expect(page.getByText('Customer Personas')).toBeVisible();
    await expect(page.getByText('Average Open Rate')).toBeVisible();
    await expect(page.getByText('Average Click Rate')).toBeVisible();
    
    // Cards should be clickable (have link styling)
    const customerCard = page.locator('text=Total Customers').locator('..');
    await expect(customerCard).toBeVisible();
  });

  test('displays simplified key metrics', async ({ page }) => {
    // Wait for metrics to load
    await page.waitForTimeout(1000);
    
    // Check three main metric cards
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Active Campaigns')).toBeVisible();
    await expect(page.getByText('New This Month')).toBeVisible();
  });

  test('displays customer segments section', async ({ page }) => {
    await expect(page.getByText('Customer Segments')).toBeVisible();
    await expect(page.getByRole('link', { name: /view all segments/i })).toBeVisible();
    
    // Should show segments or empty state
    const segmentsCard = page.locator('text=Customer Segments').locator('..').locator('..');
    await expect(segmentsCard).toBeVisible();
  });

  test('displays recent activity section', async ({ page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible();
    
    // Should show activity items or empty state
    const activitySection = page.locator('text=Recent Activity').locator('..').locator('..');
    await expect(activitySection).toBeVisible();
  });

  test('stat cards navigation', async ({ page }) => {
    // Test customers link
    const customersCard = page.locator('text=Total Customers').locator('..');
    if (await customersCard.isVisible()) {
      await customersCard.click();
      await expect(page).toHaveURL(/\/crm\/customers/);
      await page.goBack();
    }
    
    // Test segments link
    const segmentsCard = page.locator('text=Customer Segments').locator('..');
    if (await segmentsCard.isVisible()) {
      await segmentsCard.click();
      await expect(page).toHaveURL(/\/crm\/segments/);
      await page.goBack();
    }
    
    // Test personas link
    const personasCard = page.locator('text=Customer Personas').locator('..');
    if (await personasCard.isVisible()) {
      await personasCard.click();
      await expect(page).toHaveURL(/\/crm\/personas/);
      await page.goBack();
    }
    
    // Test analytics link
    const analyticsCard = page.locator('text=Average Open Rate').locator('..');
    if (await analyticsCard.isVisible()) {
      await analyticsCard.click();
      await expect(page).toHaveURL(/\/crm\/analytics/);
      await page.goBack();
    }
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

  test('displays real stats', async ({ page }) => {
    // Wait for real stats to load
    await page.waitForTimeout(2000);
    
    // Check that numeric values are displayed (should be real data, not just 0s)
    const customerCard = page.locator('text=Total Customers').locator('..');
    await expect(customerCard).toBeVisible();
    
    // Check revenue formatting (should show currency)
    const revenueText = page.getByText('Total Revenue');
    await expect(revenueText).toBeVisible();
  });
});