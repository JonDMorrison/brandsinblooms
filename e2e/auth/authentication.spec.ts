import { test, expect } from '@playwright/test';
import { TestDataFactory, PageUtils } from '../utils/test-setup';

test.describe('Authentication Flow', () => {
  test('should complete full signup and onboarding flow', async ({ page }) => {
    const userData = TestDataFactory.generateTestUser();
    const pageUtils = new PageUtils(page);

    // Navigate to auth page
    await page.goto('/auth');

    // Switch to signup if needed
    const signupTab = page.locator('text=Sign Up');
    if (await signupTab.isVisible()) {
      await signupTab.click();
    }

    // Fill signup form
    await page.fill('input[type="email"]', userData.email);
    await page.fill('input[type="password"]', userData.password);
    await page.fill('input[name="fullName"]', userData.fullName);
    
    // Submit signup
    await page.click('button[type="submit"]');

    // Should redirect to onboarding or app
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 15000 });

    // Complete onboarding if on onboarding page
    if (page.url().includes('/onboarding') || await page.locator('[data-testid="onboarding-form"]').isVisible()) {
      await page.fill('[name="companyName"]', userData.companyName);
      await page.fill('[name="companyOverview"]', 'E2E test company description');
      await page.selectOption('[name="industry"]', 'retail');
      await page.fill('[name="targetAudience"]', 'E2E test audience');
      
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
    }

    // Verify successful login and dashboard access
    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should handle login with existing credentials', async ({ page }) => {
    const pageUtils = new PageUtils(page);

    // Use existing test credentials or create them
    await pageUtils.login('test-user@example.com', 'testpassword123');

    // Should be on dashboard
    await expect(page).toHaveURL(/\/app/);
  });

  test('should handle password reset flow', async ({ page }) => {
    await page.goto('/auth');

    // Click forgot password link
    await page.click('text=Forgot your password?');

    // Fill reset form
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('should prevent access to protected routes when not authenticated', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/app/customers');

    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should handle logout correctly', async ({ page }) => {
    const userData = TestDataFactory.generateTestUser();
    const pageUtils = new PageUtils(page);

    // Login first
    await pageUtils.login(userData.email, userData.password);
    await expect(page).toHaveURL(/\/app/);

    // Find and click logout button
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');

    // Should redirect to auth page
    await expect(page).toHaveURL(/\/auth/);

    // Verify cannot access protected routes
    await page.goto('/app');
    await expect(page).toHaveURL(/\/auth/);
  });
});