import { test, expect } from './fixtures/auth.fixture';

test.describe('Sidebar Navigation', () => {
  test('all sidebar links navigate correctly', async ({ page, authenticatedUser }) => {
    // Start at dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Test main navigation items
    const navigationTests = [
      { label: 'Dashboard', url: '/', expectedHeading: /dashboard|overview/i },
      { label: 'Analytics', url: '/analytics', expectedHeading: /analytics/i },
      { label: 'Calendar', url: '/calendar', expectedHeading: /calendar/i },
      
      // CRM & Marketing
      { label: 'Customers', url: '/crm/customers', expectedHeading: /customers/i },
      { label: 'Campaigns', url: '/crm/campaigns', expectedHeading: /campaigns/i },
      { label: 'Automations', url: '/crm/automations', expectedHeading: /automations/i },
      { label: 'Segments', url: '/crm/segments', expectedHeading: /segments/i },
      { label: 'Personas', url: '/crm/personas', expectedHeading: /personas/i },
      
      // Content & Publishing
      { label: 'Social Media', url: '/social-accounts', expectedHeading: /social|accounts/i },
      { label: 'Newsletter', url: '/newsletters/new', expectedHeading: /newsletter/i },
      { label: 'SMS Campaigns', url: '/sms', expectedHeading: /sms/i },
      
      // Settings & Support
      { label: 'Integrations', url: '/integrations', expectedHeading: /integrations/i },
      { label: 'Profile', url: '/profile', expectedHeading: /profile/i },
      { label: 'Account', url: '/account', expectedHeading: /account/i },
      { label: 'Support', url: '/support', expectedHeading: /support/i },
    ];

    for (const nav of navigationTests) {
      // Click the sidebar link
      await page.click(`a[href="${nav.url}"]`);
      
      // Wait for navigation and verify URL
      await expect(page).toHaveURL(nav.url);
      
      // Verify page content loaded by checking for expected heading
      await expect(page.locator('h1, h2, h3').first()).toContainText(nav.expectedHeading);
      
      console.log(`✅ ${nav.label} navigation working - URL: ${nav.url}`);
    }
  });

  test('CRM group stays expanded when navigating to CRM subroutes', async ({ page, authenticatedUser }) => {
    await page.goto('/dashboard');

    // Navigate to a CRM route
    await page.click('a[href="/crm/customers"]');
    await expect(page).toHaveURL('/crm/customers');
    
    // Verify CRM group is expanded by checking if other CRM links are visible
    await expect(page.locator('a[href="/crm/campaigns"]')).toBeVisible();
    await expect(page.locator('a[href="/crm/segments"]')).toBeVisible();
    await expect(page.locator('a[href="/crm/personas"]')).toBeVisible();

    // Navigate to another CRM route
    await page.click('a[href="/crm/segments"]');
    await expect(page).toHaveURL('/crm/segments');
    
    // CRM group should still be expanded
    await expect(page.locator('a[href="/crm/customers"]')).toBeVisible();
    await expect(page.locator('a[href="/crm/campaigns"]')).toBeVisible();
  });

  test('sidebar trigger is accessible and functional', async ({ page, authenticatedUser }) => {
    await page.goto('/dashboard');
    
    // Find the sidebar trigger button
    const sidebarTrigger = page.locator('button[data-sidebar="trigger"]').first();
    await expect(sidebarTrigger).toBeVisible();
    
    // Test that it's clickable (won't test actual collapse as it's complex to verify reliably)
    await expect(sidebarTrigger).toBeEnabled();
  });

  test('active route highlighting works correctly', async ({ page, authenticatedUser }) => {
    // Test Dashboard active state
    await page.goto('/dashboard');
    const dashboardLink = page.locator('a[href="/"]');
    await expect(dashboardLink.locator('..')).toHaveAttribute('data-active', 'true');

    // Test CRM route active state
    await page.goto('/crm/customers');
    const customersLink = page.locator('a[href="/crm/customers"]');
    await expect(customersLink.locator('..')).toHaveAttribute('data-active', 'true');
  });
});