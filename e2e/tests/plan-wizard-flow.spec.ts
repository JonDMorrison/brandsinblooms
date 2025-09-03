import { test, expect } from '@playwright/test';

test.describe('Plan Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - you may need to adjust this based on your auth setup
    await page.goto('/auth');
    // Add your authentication steps here
  });

  test('should show email setup required and provide fix now button', async ({ page }) => {
    // Navigate to plan wizard
    await page.goto('/plan');
    
    // Go through steps to reach review
    // Step 1: Select theme and month
    await page.click('[data-testid="theme-card"]:first-child');
    await page.click('[data-testid="next-button"]');
    
    // Step 2: Skip calendar editing
    await page.click('[data-testid="next-button"]');
    
    // Step 3: Review page
    await expect(page.locator('h2')).toContainText('Review Your Plan');
    
    // Check for email setup required badge (assuming email domain not verified)
    const emailCard = page.locator('[data-testid="email-channel-card"]');
    await expect(emailCard.locator('text=Setup Required')).toBeVisible();
    
    // Click Fix Now button for email
    const emailFixButton = emailCard.locator('button:has-text("Fix Now")');
    await expect(emailFixButton).toBeVisible();
    
    // Verify it navigates to settings/email
    await emailFixButton.click();
    await expect(page).toHaveURL(/\/settings\/email/);
  });

  test('should launch plan and redirect to calendar with success modal', async ({ page }) => {
    // Navigate to plan wizard and complete it
    await page.goto('/plan');
    
    // Complete wizard steps (mocked for test)
    // ... wizard completion steps ...
    
    // Launch the plan
    const launchButton = page.locator('button:has-text("Launch My Plan")');
    await expect(launchButton).toBeVisible();
    await launchButton.click();
    
    // Should redirect to calendar
    await expect(page).toHaveURL(/\/calendar/);
    
    // Success modal should appear
    const successModal = page.locator('[role="dialog"]');
    await expect(successModal).toBeVisible();
    await expect(successModal.locator('text=Plan is Ready!')).toBeVisible();
    
    // Check for confetti effect (data attribute or animation class)
    await expect(page.locator('[data-testid="confetti"]')).toBeVisible();
    
    // Test "View My Calendar" button
    const viewCalendarButton = successModal.locator('button:has-text("View My Calendar")');
    await expect(viewCalendarButton).toBeVisible();
    await viewCalendarButton.click();
    
    // Modal should close, stay on calendar
    await expect(successModal).not.toBeVisible();
    await expect(page).toHaveURL(/\/calendar/);
  });

  test('should allow returning to dashboard from success modal', async ({ page }) => {
    // Set up calendar page with success modal
    await page.goto('/calendar?planLaunched=true&launchMonth=November%202025&launchItems=14');
    
    // Success modal should appear
    const successModal = page.locator('[role="dialog"]');
    await expect(successModal).toBeVisible();
    
    // Click "Back to Dashboard" button
    const backToDashboardButton = successModal.locator('button:has-text("Back to Dashboard")');
    await expect(backToDashboardButton).toBeVisible();
    await backToDashboardButton.click();
    
    // Should navigate to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show expanded channel items when clicked', async ({ page }) => {
    // Navigate to review page with many items
    await page.goto('/plan?step=3');
    
    // Find a channel card with "+X more" button
    const socialCard = page.locator('[data-testid="social-channel-card"]');
    const expandButton = socialCard.locator('button:has-text("+")');
    
    if (await expandButton.isVisible()) {
      await expandButton.click();
      
      // Should show "Show Less" button
      await expect(socialCard.locator('button:has-text("Show Less")')).toBeVisible();
      
      // Click to collapse
      await socialCard.locator('button:has-text("Show Less")').click();
      await expect(socialCard.locator('button:has-text("+"))')).toBeVisible();
    }
  });

  test('should show success toast after modal is dismissed', async ({ page }) => {
    // Navigate to calendar with launch success
    await page.goto('/calendar?planLaunched=true&launchItems=14');
    
    // Close success modal
    const successModal = page.locator('[role="dialog"]');
    await successModal.locator('button:has-text("View My Calendar")').click();
    
    // Should show success toast
    await expect(page.locator('.sonner-toast')).toContainText('Plan scheduled successfully');
  });
});