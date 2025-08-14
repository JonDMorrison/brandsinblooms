import { test, expect } from '../fixtures/e2e-test.fixture';

test.describe('BloomSuite Admin & Permissions - Pre-Beta', () => {
  
  test('Admin panel access and user management', async ({ page, testContext, a11yTester, reporter }) => {
    // Login as admin user
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    // Navigate to admin panel
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Check admin dashboard elements
    await expect(page.locator('text=User Management')).toBeVisible();
    await expect(page.locator('text=System Metrics')).toBeVisible();
    
    // Test user list functionality
    const userCount = await page.locator('[data-testid="user-row"]').count();
    expect(userCount).toBeGreaterThan(0);
    
    // Test user role switching (if available)
    const editButtons = page.locator('[data-testid="edit-user"]');
    if (await editButtons.count() > 0) {
      await editButtons.first().click();
      await expect(page.locator('[data-testid="user-edit-modal"]')).toBeVisible();
      await page.keyboard.press('Escape');
    }
    
    // Accessibility check
    const a11yResult = await a11yTester.scanPage();
    await a11yTester.failOnCriticalViolations(a11yResult);
  });

  test('Role-based access control (RLS validation)', async ({ page, testContext, reporter }) => {
    // Test Editor role limitations
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.editorUser.email);
    await page.fill('input[type="password"]', testContext.editorUser.password);
    await page.click('button[type="submit"]');
    
    // Editor should NOT have access to admin panel
    await page.goto('/admin');
    
    // Should be redirected or see access denied
    const currentUrl = page.url();
    const hasAccessDenied = await page.locator('text=Access Denied').isVisible().catch(() => false);
    const isRedirected = !currentUrl.includes('/admin');
    
    if (!hasAccessDenied && !isRedirected) {
      await reporter.captureFailure({
        testName: 'Editor Admin Access Restriction',
        suiteName: 'Admin & Permissions',
        status: 'fail',
        reproSteps: [
          'Login as editor user',
          'Navigate to /admin',
          'Check access is denied'
        ],
        expected: 'Access denied or redirect to dashboard',
        actual: 'Editor has access to admin panel',
        suggestedOwner: 'RLS/DB',
        severity: 'Blocker'
      });
    }
    
    // Test Viewer role limitations
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.viewerUser.email);
    await page.fill('input[type="password"]', testContext.viewerUser.password);
    await page.click('button[type="submit"]');
    
    // Viewer should have read-only access to most features
    await page.goto('/crm/customers');
    
    // Should not see create/edit buttons
    const createButton = page.locator('[data-testid="add-customer"]');
    const hasCreateAccess = await createButton.isVisible().catch(() => false);
    
    if (hasCreateAccess) {
      await reporter.captureFailure({
        testName: 'Viewer Write Access Restriction',
        suiteName: 'Admin & Permissions',
        status: 'fail',
        reproSteps: [
          'Login as viewer user',
          'Navigate to CRM customers',
          'Check create button is hidden'
        ],
        expected: 'No create/edit buttons for viewer role',
        actual: 'Viewer can create/edit customers',
        suggestedOwner: 'RLS/DB',
        severity: 'High'
      });
    }
  });

  test('Cross-tenant data isolation', async ({ page, testContext, reporter }) => {
    // This test would require multiple workspaces to be properly tested
    // For now, we'll test that users can only see their workspace data
    
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    // Navigate to customers
    await page.goto('/crm/customers');
    
    // All customers should belong to the same workspace
    const customerRows = await page.locator('[data-testid="customer-row"]').all();
    
    for (const row of customerRows.slice(0, 5)) { // Test first 5 rows
      const customerData = await row.getAttribute('data-workspace-id');
      if (customerData && customerData !== testContext.workspaceId) {
        await reporter.captureFailure({
          testName: 'Cross-Tenant Data Leak',
          suiteName: 'Admin & Permissions',
          status: 'fail',
          reproSteps: [
            'Login to workspace',
            'View customer list',
            'Check all customers belong to current workspace'
          ],
          expected: 'Only workspace-specific data visible',
          actual: 'Data from other workspaces visible',
          suggestedOwner: 'RLS/DB',
          severity: 'Blocker'
        });
        break;
      }
    }
  });
});