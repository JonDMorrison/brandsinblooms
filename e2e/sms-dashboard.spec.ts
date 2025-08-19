import { test, expect } from '@playwright/test';

test.describe('SMS Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/auth');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="sign-in-button"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard');
  });

  test('displays SMS Command Center with all components', async ({ page }) => {
    await page.goto('/sms');
    
    // Check header
    await expect(page.locator('h1')).toContainText('SMS Command Center');
    await expect(page.locator('text=Real-time SMS marketing dashboard')).toBeVisible();
    
    // Check action buttons
    await expect(page.locator('button', { hasText: 'Refresh' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Automations' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'New Campaign' })).toBeVisible();
  });

  test('shows stats cards with real data', async ({ page }) => {
    await page.goto('/sms');
    
    // Wait for stats to load
    await page.waitForSelector('[data-testid="sms-stats-cards"]', { timeout: 10000 });
    
    // Check that all 5 stat cards are present
    const statCards = page.locator('.grid').first().locator('.cursor-pointer');
    await expect(statCards).toHaveCount(5);
    
    // Check specific cards
    await expect(page.locator('text=Subscribers')).toBeVisible();
    await expect(page.locator('text=Credits')).toBeVisible();
    await expect(page.locator('text=Deliverability')).toBeVisible();
    await expect(page.locator('text=Clicks')).toBeVisible();
    await expect(page.locator('text=Queue')).toBeVisible();
  });

  test('stat cards are clickable and scroll to sections', async ({ page }) => {
    await page.goto('/sms');
    
    // Wait for content to load
    await page.waitForSelector('text=Subscribers');
    
    // Click on Queue card
    await page.locator('text=Queue').first().click();
    
    // Should scroll to queue section
    await expect(page.locator('#queue')).toBeInViewport();
  });

  test('campaigns table shows recent campaigns', async ({ page }) => {
    await page.goto('/sms');
    
    // Check campaigns section
    await expect(page.locator('#campaigns')).toBeVisible();
    await expect(page.locator('text=Recent Campaigns')).toBeVisible();
    
    // Should show table headers
    await expect(page.locator('text=Campaign')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
    await expect(page.locator('text=Sent')).toBeVisible();
    await expect(page.locator('text=Delivered')).toBeVisible();
  });

  test('recent messages feed displays correctly', async ({ page }) => {
    await page.goto('/sms');
    
    // Check messages section
    await expect(page.locator('#messages')).toBeVisible();
    await expect(page.locator('text=Recent Messages')).toBeVisible();
    await expect(page.locator('text=Latest SMS messages sent to customers')).toBeVisible();
  });

  test('queue status shows current state', async ({ page }) => {
    await page.goto('/sms');
    
    // Check queue section
    await expect(page.locator('#queue')).toBeVisible();
    await expect(page.locator('text=Message Queue')).toBeVisible();
    await expect(page.locator('text=SMS messages waiting to be sent')).toBeVisible();
  });

  test('quick send form works correctly', async ({ page }) => {
    await page.goto('/sms');
    
    // Check quick send section
    await expect(page.locator('#quick-send')).toBeVisible();
    await expect(page.locator('text=Quick Send')).toBeVisible();
    
    // Fill form
    await page.fill('#phone', '+1234567890');
    await page.fill('#message', 'Test message');
    
    // Check send button is enabled
    const sendButton = page.locator('button', { hasText: 'Send Test Message' });
    await expect(sendButton).toBeEnabled();
    
    // Check character count
    await expect(page.locator('text=12/160')).toBeVisible();
  });

  test('refresh button updates data', async ({ page }) => {
    await page.goto('/sms');
    
    // Click refresh button
    const refreshButton = page.locator('button', { hasText: 'Refresh' });
    await refreshButton.click();
    
    // Should show loading state
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('new campaign button navigates correctly', async ({ page }) => {
    await page.goto('/sms');
    
    // Click new campaign button
    await page.click('button', { hasText: 'New Campaign' });
    
    // Should navigate to campaign wizard
    await page.waitForURL('**/sms/new');
  });

  test('automations button navigates correctly', async ({ page }) => {
    await page.goto('/sms');
    
    // Click automations button
    await page.click('button', { hasText: 'Automations' });
    
    // Should navigate to automations
    await page.waitForURL('**/sms/automations');
  });

  test('displays Twilio setup warning when not configured', async ({ page }) => {
    // Mock Twilio as not setup
    await page.route('**/api/twilio-setup', async route => {
      await route.fulfill({
        json: { isSetup: false, hasCredentials: false }
      });
    });
    
    await page.goto('/sms');
    
    // Should show setup warning
    await expect(page.locator('text=SMS Setup Required')).toBeVisible();
    await expect(page.locator('text=Configure Twilio credentials')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Complete Setup' })).toBeVisible();
  });

  test('mobile responsive layout works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/sms');
    
    // Check that stats cards stack properly
    const statCards = page.locator('.grid').first();
    await expect(statCards).toBeVisible();
    
    // Check that main content stacks on mobile
    const mainGrid = page.locator('.lg\\:grid-cols-3');
    await expect(mainGrid).toBeVisible();
  });
});