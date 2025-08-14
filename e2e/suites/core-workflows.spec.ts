import { test, expect } from '../fixtures/e2e-test.fixture';

test.describe('BloomSuite Core Workflows - Pre-Beta', () => {
  
  test('Dashboard loads and displays all tiles', async ({ page, testContext, a11yTester, perfTester, reporter }) => {
    // Login as admin user
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
    
    // Check core elements
    await expect(page.locator('text=Create and Post Something')).toBeVisible();
    await expect(page.locator('text=View My Existing Content')).toBeVisible();
    
    // Accessibility check
    const a11yResult = await a11yTester.scanPage();
    await a11yTester.failOnCriticalViolations(a11yResult);
    
    // Performance check
    const perfPassed = await perfTester.checkLighthouseThresholds();
    if (!perfPassed) {
      await reporter.captureFailure({
        testName: 'Dashboard Performance',
        suiteName: 'Core Workflows',
        status: 'fail',
        reproSteps: ['Navigate to dashboard', 'Measure performance'],
        expected: 'Performance score ≥ 90',
        actual: 'Performance score < 90',
        suggestedOwner: 'Frontend',
        severity: 'Medium'
      });
    }
  });

  test('Content Library functionality', async ({ page, testContext, a11yTester }) => {
    // Login and navigate to content library
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.goto('/content/library');
    await page.waitForLoadState('networkidle');
    
    // Test search and filter
    await page.fill('[data-testid="search-input"]', 'spring');
    await page.waitForTimeout(1000);
    
    // Test bundle interaction
    const firstBundle = page.locator('[data-testid="content-bundle"]').first();
    if (await firstBundle.isVisible()) {
      await firstBundle.click();
      await expect(page.locator('[data-testid="content-modal"]')).toBeVisible();
      
      // Test media selector
      await expect(page.locator('[data-testid="media-selector"]')).toBeVisible();
      
      // Close modal
      await page.keyboard.press('Escape');
    }
    
    // Accessibility check
    const a11yResult = await a11yTester.scanPage();
    await a11yTester.failOnCriticalViolations(a11yResult);
  });

  test('CRM Customer Management', async ({ page, testContext, externalMocks }) => {
    // Login and navigate to CRM
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.goto('/crm/customers');
    await page.waitForLoadState('networkidle');
    
    // Test customer creation
    await page.click('[data-testid="add-customer"]');
    await page.fill('[name="email"]', 'test-new@example.com');
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="lastName"]', 'Customer');
    await page.click('button[type="submit"]');
    
    // Verify customer appears in list
    await expect(page.locator('text=test-new@example.com')).toBeVisible();
    
    // Test search
    await page.fill('[data-testid="customer-search"]', 'test-new');
    await page.waitForTimeout(500);
    await expect(page.locator('text=test-new@example.com')).toBeVisible();
  });

  test('SMS Demo functionality', async ({ page, testContext, externalMocks }) => {
    // Navigate to SMS demo
    await page.goto('/demo');
    
    // Test SMS send
    await page.fill('[data-testid="sms-phone"]', '+15551234567');
    await page.fill('[data-testid="sms-message"]', 'Test message from E2E');
    await page.click('[data-testid="send-sms"]');
    
    // Check for success message
    await expect(page.locator('text=Message sent')).toBeVisible({ timeout: 5000 });
    
    // Test STOP compliance
    const stopResponse = await externalMocks.simulateSTOPResponse('+15551234567');
    console.log('STOP response simulated:', stopResponse);
  });
});