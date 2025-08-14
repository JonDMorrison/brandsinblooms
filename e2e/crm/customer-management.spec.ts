import { test, expect } from '../fixtures/auth.fixture';
import { TestDataFactory } from '../utils/test-setup';

test.describe('Customer Management', () => {
  test('should create and manage customers', async ({ page, authenticatedUser, pageUtils }) => {
    const customerData = TestDataFactory.generateTestCustomer();

    // Navigate to customers page
    await pageUtils.navigateTo('/app/customers');
    
    // Create new customer
    await page.click('[data-testid="add-customer-button"]');
    
    // Fill customer form
    await page.fill('[name="firstName"]', customerData.firstName);
    await page.fill('[name="lastName"]', customerData.lastName);
    await page.fill('[name="email"]', customerData.email);
    await page.fill('[name="phone"]', customerData.phone);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify customer appears in list
    await expect(page.locator('text=' + customerData.firstName)).toBeVisible();
    await expect(page.locator('text=' + customerData.email)).toBeVisible();
  });

  test('should import customers from CSV', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/app/customers');
    
    // Click import button
    await page.click('[data-testid="import-customers-button"]');
    
    // Create test CSV content
    const csvContent = `firstName,lastName,email,phone
John,Doe,john.doe@example.com,+16048393258
Jane,Smith,jane.smith@example.com,+16041234567`;
    
    // Create temporary file for upload
    const csvFile = Buffer.from(csvContent);
    
    // Upload CSV file
    await page.setInputFiles('[data-testid="csv-upload"]', {
      name: 'test-customers.csv',
      mimeType: 'text/csv',
      buffer: csvFile,
    });
    
    // Confirm import
    await page.click('[data-testid="confirm-import"]');
    
    // Wait for import to complete
    await expect(page.locator('text=Import completed')).toBeVisible();
    
    // Verify imported customers
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).toBeVisible();
  });

  test('should create and assign customer segments', async ({ page, authenticatedUser, pageUtils, dbUtils }) => {
    // Seed some test customers first
    await dbUtils.seedTestData(authenticatedUser.userId);
    
    await pageUtils.navigateTo('/app/segments');
    
    // Create new segment
    await page.click('[data-testid="create-segment-button"]');
    
    await page.fill('[name="segmentName"]', 'High Value Customers');
    await page.fill('[name="description"]', 'Customers with high lifetime value');
    
    // Set segment criteria
    await page.selectOption('[name="filterField"]', 'tags');
    await page.selectOption('[name="filterOperator"]', 'contains');
    await page.fill('[name="filterValue"]', 'test-customer');
    
    await page.click('button[type="submit"]');
    
    // Verify segment created
    await expect(page.locator('text=High Value Customers')).toBeVisible();
    
    // Check segment has customers
    await page.click('text=High Value Customers');
    await expect(page.locator('[data-testid="segment-customer-count"]')).toContainText('5'); // We seeded 5 customers
  });

  test('should view customer timeline and interactions', async ({ page, authenticatedUser, pageUtils, dbUtils }) => {
    // Seed test data
    const seededData = await dbUtils.seedTestData(authenticatedUser.userId);
    
    await pageUtils.navigateTo('/app/customers');
    
    // Click on first customer
    await page.click('[data-testid="customer-row"]:first-child');
    
    // Should be on customer detail page
    await expect(page.locator('[data-testid="customer-timeline"]')).toBeVisible();
    
    // Add manual interaction
    await page.click('[data-testid="add-interaction-button"]');
    await page.selectOption('[name="interactionType"]', 'call');
    await page.fill('[name="notes"]', 'Follow-up call completed');
    await page.click('button[type="submit"]');
    
    // Verify interaction appears in timeline
    await expect(page.locator('text=Follow-up call completed')).toBeVisible();
  });

  test('should handle customer data validation', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/app/customers');
    
    // Try to create customer with invalid data
    await page.click('[data-testid="add-customer-button"]');
    
    // Submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=First name is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();
    
    // Try with invalid email
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Please enter a valid email')).toBeVisible();
    
    // Try with invalid phone
    await page.fill('[name="email"]', 'john@example.com');
    await page.fill('[name="phone"]', '123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Please enter a valid phone number')).toBeVisible();
  });
});