import { test, expect } from '@playwright/test';

test.describe('Basic E2E Setup Verification', () => {
  test('should load the application homepage', async ({ page }) => {
    await page.goto('/');
    
    // Should be redirected to auth if not logged in
    await expect(page).toHaveURL('/auth');
    
    // Should see the auth form
    await expect(page.locator('h1, h2').filter({ hasText: /welcome|sign/i })).toBeVisible();
    
    // Should see email and password inputs
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should have working navigation to auth page', async ({ page }) => {
    await page.goto('/auth');
    
    // Should see the auth tabs
    await expect(page.locator('text=Sign In')).toBeVisible();
    await expect(page.locator('text=Create Account')).toBeVisible();
    
    // Should be able to switch tabs
    await page.click('text=Create Account');
    await expect(page.locator('input[placeholder*="full name"]')).toBeVisible();
  });
});