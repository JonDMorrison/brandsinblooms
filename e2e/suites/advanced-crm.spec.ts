import { test, expect } from '../fixtures/e2e-test.fixture';

test.describe('BloomSuite Advanced CRM Features - Pre-Beta', () => {
  
  test('Automation builder with complex flows', async ({ page, testContext, a11yTester }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.goto('/crm/automations');
    await page.click('[data-testid="create-automation"]');
    
    // Build custom automation flow
    await page.click('[data-testid="custom-automation"]');
    
    // Set trigger
    await page.click('[data-testid="trigger-selector"]');
    await page.click('[data-testid="trigger-customer-created"]');
    
    // Add first step - SMS
    await page.click('[data-testid="add-step"]');
    await page.click('[data-testid="step-sms"]');
    await page.fill('[data-testid="sms-content"]', 'Welcome to our garden center! {{customer.firstName}}');
    await page.fill('[data-testid="delay-minutes"]', '5');
    
    // Add second step - delay
    await page.click('[data-testid="add-step"]');
    await page.click('[data-testid="step-delay"]');
    await page.fill('[data-testid="delay-hours"]', '24');
    
    // Add third step - email
    await page.click('[data-testid="add-step"]');
    await page.click('[data-testid="step-email"]');
    await page.fill('[data-testid="email-subject"]', 'Getting Started Guide');
    await page.fill('[data-testid="email-content"]', 'Here are some tips for your garden...');
    
    // Add A/B test branch
    await page.click('[data-testid="add-ab-test"]');
    await page.fill('[data-testid="ab-percentage"]', '50');
    
    // Test autosave functionality
    await page.waitForTimeout(3000);
    const saveIndicator = page.locator('[data-testid="autosave-indicator"]');
    await expect(saveIndicator).toContainText('Saved');
    
    // Activate automation
    await page.click('[data-testid="activate-automation"]');
    await expect(page.locator('text=Automation activated')).toBeVisible();
    
    // Test accessibility
    const a11yResult = await a11yTester.scanPage();
    await a11yTester.failOnCriticalViolations(a11yResult);
  });

  test('Campaign creation with revenue projection', async ({ page, testContext }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.goto('/crm/campaigns');
    await page.click('[data-testid="create-campaign"]');
    
    // Create email campaign
    await page.click('[data-testid="email-campaign"]');
    await page.fill('[data-testid="campaign-name"]', 'Spring Plant Sale');
    
    // Select segment
    await page.click('[data-testid="segment-selector"]');
    await page.click('[data-testid="segment-option"]:first-child');
    
    // Fill email content
    await page.fill('[data-testid="email-subject"]', 'Spring Sale - 30% Off Plants');
    await page.fill('[data-testid="email-content"]', 'Don\'t miss our biggest sale of the year!');
    
    // Check revenue projection appears
    await expect(page.locator('[data-testid="revenue-projection"]')).toBeVisible();
    const projection = await page.locator('[data-testid="projected-revenue"]').textContent();
    expect(projection).toMatch(/\$[\d,]+/); // Should show dollar amount
    
    // Schedule campaign
    await page.click('[data-testid="schedule-campaign"]');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await page.fill('[data-testid="schedule-date"]', tomorrow.toISOString().split('T')[0]);
    await page.fill('[data-testid="schedule-time"]', '10:00');
    
    await page.click('[data-testid="confirm-schedule"]');
    await expect(page.locator('text=Campaign scheduled')).toBeVisible();
    
    // Test campaign cancellation
    await page.click('[data-testid="cancel-campaign"]');
    await page.click('[data-testid="confirm-cancel"]');
    await expect(page.locator('text=Campaign cancelled')).toBeVisible();
  });

  test('Customer segment builder with advanced rules', async ({ page, testContext }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.goto('/crm/segments');
    await page.click('[data-testid="create-segment"]');
    
    // Build complex segment rules
    await page.fill('[data-testid="segment-name"]', 'High Value VIP Customers');
    
    // Add first rule - total spent
    await page.click('[data-testid="add-rule"]');
    await page.click('[data-testid="field-total-spent"]');
    await page.click('[data-testid="operator-gte"]');
    await page.fill('[data-testid="value-input"]', '500');
    
    // Add AND condition
    await page.click('[data-testid="add-and-condition"]');
    await page.click('[data-testid="field-tags"]');
    await page.click('[data-testid="operator-contains"]');
    await page.fill('[data-testid="value-input"]', 'VIP');
    
    // Add OR condition group
    await page.click('[data-testid="add-or-group"]');
    await page.click('[data-testid="field-persona"]');
    await page.click('[data-testid="operator-equals"]');
    await page.click('[data-testid="value-landscaper"]');
    
    // Preview customer count
    await page.click('[data-testid="preview-segment"]');
    await expect(page.locator('[data-testid="preview-count"]')).toBeVisible();
    
    const count = await page.locator('[data-testid="preview-count"]').textContent();
    expect(count).toMatch(/\d+ customers/);
    
    // Save segment
    await page.click('[data-testid="save-segment"]');
    await expect(page.locator('text=Segment created')).toBeVisible();
    
    // Verify segment appears in list
    await expect(page.locator('text=High Value VIP Customers')).toBeVisible();
  });

  test('Customer analytics and LTV tracking', async ({ page, testContext }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.goto('/crm/analytics');
    
    // Check dashboard loads with seeded data
    await expect(page.locator('[data-testid="ltv-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="attribution-table"]')).toBeVisible();
    
    // Test data export
    await page.click('[data-testid="export-csv"]');
    
    // Should trigger download (can't test actual download in headless)
    await expect(page.locator('text=Export started')).toBeVisible();
    
    // Test Google Data Studio integration link
    const dataStudioLink = page.locator('[data-testid="data-studio-link"]');
    if (await dataStudioLink.isVisible()) {
      await expect(dataStudioLink).toHaveAttribute('href', /datastudio\.google\.com/);
    }
    
    // Test date range filtering
    await page.click('[data-testid="date-range-picker"]');
    await page.click('[data-testid="last-30-days"]');
    
    // Charts should update
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="ltv-chart"]')).toBeVisible();
  });

  test('Persona management and assignment', async ({ page, testContext }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.goto('/crm/personas');
    
    // Create new persona
    await page.click('[data-testid="create-persona"]');
    await page.fill('[data-testid="persona-name"]', 'Seasonal Decorator');
    await page.fill('[data-testid="persona-description"]', 'Customers who buy plants for seasonal decorating');
    
    // Add characteristics
    await page.click('[data-testid="add-characteristic"]');
    await page.fill('[data-testid="characteristic-name"]', 'Purchase Pattern');
    await page.fill('[data-testid="characteristic-value"]', 'Seasonal spikes in autumn and spring');
    
    await page.click('[data-testid="save-persona"]');
    await expect(page.locator('text=Persona created')).toBeVisible();
    
    // Test persona assignment to customer
    await page.goto('/crm/customers');
    await page.click('[data-testid="customer-row"]:first-child');
    await page.click('[data-testid="edit-customer"]');
    
    await page.click('[data-testid="persona-selector"]');
    await page.click('text=Seasonal Decorator');
    
    await page.click('[data-testid="save-customer"]');
    await expect(page.locator('text=Customer updated')).toBeVisible();
    
    // Verify persona appears in customer profile
    await expect(page.locator('text=Seasonal Decorator')).toBeVisible();
  });
});