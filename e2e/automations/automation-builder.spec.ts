import { test, expect } from '../fixtures/auth.fixture';

test.describe('Automation Builder', () => {
  test('should create basic SMS automation', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/app/automations');
    
    // Create new automation
    await page.click('[data-testid="create-automation-button"]');
    
    // Fill automation details
    await page.fill('[name="automationName"]', 'Welcome Series');
    
    // Select trigger
    await page.click('[data-testid="trigger-selector"]');
    await page.click('[data-testid="trigger-customer-signup"]');
    
    // Use template
    await page.click('[data-testid="use-template-button"]');
    await page.click('[data-testid="template-welcome-series"]');
    
    // Verify template applied
    await expect(page.locator('[data-testid="automation-steps"]')).toContainText('Welcome Message');
    
    // Save automation
    await page.click('[data-testid="save-automation"]');
    
    // Should show success message
    await expect(page.locator('text=Automation created successfully')).toBeVisible();
    
    // Verify automation is active
    await expect(page.locator('[data-testid="automation-status"]')).toContainText('Active');
  });

  test('should build custom automation flow', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/app/automations/new');
    
    await page.fill('[name="automationName"]', 'Custom Flow');
    
    // Select trigger
    await page.click('[data-testid="trigger-selector"]');
    await page.click('[data-testid="trigger-loyalty-signup"]');
    
    // Build custom flow instead of using template
    await page.click('[data-testid="build-custom-flow"]');
    
    // Add first step - immediate SMS
    await page.click('[data-testid="add-step-button"]');
    await page.selectOption('[data-testid="step-type"]', 'sms');
    await page.fill('[data-testid="sms-message"]', 'Welcome to our loyalty program!');
    await page.click('[data-testid="save-step"]');
    
    // Add delay step
    await page.click('[data-testid="add-step-button"]');
    await page.selectOption('[data-testid="step-type"]', 'delay');
    await page.fill('[data-testid="delay-duration"]', '7');
    await page.selectOption('[data-testid="delay-unit"]', 'days');
    await page.click('[data-testid="save-step"]');
    
    // Add follow-up SMS
    await page.click('[data-testid="add-step-button"]');
    await page.selectOption('[data-testid="step-type"]', 'sms');
    await page.fill('[data-testid="sms-message"]', 'How are you enjoying your loyalty benefits?');
    await page.click('[data-testid="save-step"]');
    
    // Save automation
    await page.click('[data-testid="save-automation"]');
    
    // Verify flow structure
    await expect(page.locator('[data-testid="automation-steps"]')).toContainText('3 steps');
    await expect(page.locator('[data-testid="step-0"]')).toContainText('SMS');
    await expect(page.locator('[data-testid="step-1"]')).toContainText('Wait 7 days');
    await expect(page.locator('[data-testid="step-2"]')).toContainText('SMS');
  });

  test('should handle automation triggers correctly', async ({ page, authenticatedUser, pageUtils, dbUtils }) => {
    // Create automation first
    await pageUtils.navigateTo('/app/automations/new');
    
    await page.fill('[name="automationName"]', 'Birthday Automation');
    
    // Select birthday trigger
    await page.click('[data-testid="trigger-selector"]');
    await page.click('[data-testid="trigger-customer-birthday"]');
    
    // Set trigger conditions
    await page.fill('[data-testid="days-before-birthday"]', '1');
    
    // Add birthday message
    await page.click('[data-testid="add-step-button"]');
    await page.selectOption('[data-testid="step-type"]', 'sms');
    await page.fill('[data-testid="sms-message"]', 'Happy Birthday {{firstName}}! Enjoy 20% off today.');
    await page.click('[data-testid="save-step"]');
    
    await page.click('[data-testid="save-automation"]');
    await page.click('[data-testid="activate-automation"]');
    
    // Now create a customer with birthday tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await pageUtils.navigateTo('/app/customers');
    await page.click('[data-testid="add-customer-button"]');
    
    await page.fill('[name="firstName"]', 'Birthday');
    await page.fill('[name="lastName"]', 'Person');
    await page.fill('[name="email"]', 'birthday@example.com');
    await page.fill('[name="phone"]', '+16048393258');
    await page.fill('[name="birthday"]', tomorrow.toISOString().split('T')[0]);
    
    await page.click('button[type="submit"]');
    
    // Check automation log to see if trigger fired
    await pageUtils.navigateTo('/app/automations');
    await page.click('text=Birthday Automation');
    await page.click('[data-testid="view-logs"]');
    
    // Should see the customer was enrolled
    await expect(page.locator('text=Birthday Person')).toBeVisible();
    await expect(page.locator('text=Enrolled in automation')).toBeVisible();
  });

  test('should pause and resume automations', async ({ page, authenticatedUser, pageUtils }) => {
    // Create automation first
    await pageUtils.navigateTo('/app/automations/new');
    
    await page.fill('[name="automationName"]', 'Test Pause Automation');
    await page.click('[data-testid="trigger-selector"]');
    await page.click('[data-testid="trigger-customer-signup"]');
    
    await page.click('[data-testid="use-template-button"]');
    await page.click('[data-testid="template-welcome-series"]');
    
    await page.click('[data-testid="save-automation"]');
    
    // Verify automation is active
    await expect(page.locator('[data-testid="automation-status"]')).toContainText('Active');
    
    // Pause automation
    await page.click('[data-testid="pause-automation"]');
    await expect(page.locator('text=Automation paused')).toBeVisible();
    await expect(page.locator('[data-testid="automation-status"]')).toContainText('Paused');
    
    // Resume automation
    await page.click('[data-testid="resume-automation"]');
    await expect(page.locator('text=Automation resumed')).toBeVisible();
    await expect(page.locator('[data-testid="automation-status"]')).toContainText('Active');
  });

  test('should show automation analytics and performance', async ({ page, authenticatedUser, pageUtils }) => {
    // Navigate to existing automation
    await pageUtils.navigateTo('/app/automations');
    
    // Assume we have at least one automation from previous tests
    await page.click('[data-testid="automation-row"]:first-child');
    
    // View analytics
    await page.click('[data-testid="view-analytics"]');
    
    // Should show key metrics
    await expect(page.locator('[data-testid="enrolled-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="completed-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="conversion-rate"]')).toBeVisible();
    
    // Should show step-by-step breakdown
    await expect(page.locator('[data-testid="step-analytics"]')).toBeVisible();
    
    // Should show timeline of activities
    await expect(page.locator('[data-testid="activity-timeline"]')).toBeVisible();
  });

  test('should handle automation errors gracefully', async ({ page, authenticatedUser, pageUtils }) => {
    // Create automation with potential error scenario
    await pageUtils.navigateTo('/app/automations/new');
    
    await page.fill('[name="automationName"]', 'Error Test Automation');
    await page.click('[data-testid="trigger-selector"]');
    await page.click('[data-testid="trigger-customer-signup"]');
    
    // Add step with invalid phone number scenario
    await page.click('[data-testid="add-step-button"]');
    await page.selectOption('[data-testid="step-type"]', 'sms');
    await page.fill('[data-testid="sms-message"]', 'Test message');
    await page.click('[data-testid="save-step"]');
    
    await page.click('[data-testid="save-automation"]');
    await page.click('[data-testid="activate-automation"]');
    
    // Create customer with invalid phone number
    await pageUtils.navigateTo('/app/customers');
    await page.click('[data-testid="add-customer-button"]');
    
    await page.fill('[name="firstName"]', 'Invalid');
    await page.fill('[name="lastName"]', 'Phone');
    await page.fill('[name="email"]', 'invalid@example.com');
    await page.fill('[name="phone"]', 'invalid-phone');
    
    await page.click('button[type="submit"]');
    
    // Check automation logs for error handling
    await pageUtils.navigateTo('/app/automations');
    await page.click('text=Error Test Automation');
    await page.click('[data-testid="view-logs"]');
    
    // Should show error was handled gracefully
    await expect(page.locator('text=Invalid Phone')).toBeVisible();
    await expect(page.locator('text=Failed')).toBeVisible();
    await expect(page.locator('[data-testid="error-reason"]')).toContainText('Invalid phone number');
  });
});