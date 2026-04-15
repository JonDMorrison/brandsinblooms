import { test, expect } from './fixtures/auth.fixture';

test.describe('Dashboard shell navigation', () => {
  test('integrations route exposes the current shell controls', async ({
    page,
    pageUtils,
  }) => {
    await pageUtils.navigateTo('/integrations');

    const isMobile = (page.viewportSize()?.width ?? 0) < 768;

    await expect(page.locator('[data-testid="dashboard-shell-root"]')).toBeVisible();

    if (!isMobile) {
      await expect(page.locator('[data-testid="dashboard-shell-topbar"]')).toContainText('Integrations');
    }

    if (isMobile) {
      await page.getByLabel('Open sidebar').click();
      await expect(page.getByLabel('Close sidebar')).toBeVisible();
      await expect(page.locator('[data-testid="dashboard-shell-sidebar-mobile"]')).toBeVisible();
      await expect(page.locator('[data-testid="dashboard-shell-backdrop"]')).toBeVisible();
      await page.locator('[data-testid="dashboard-shell-backdrop"]').click();
      await expect(page.getByLabel('Open sidebar')).toBeVisible();
      return;
    }

    const sidebar = page.locator('[data-testid="dashboard-shell-sidebar"]');

    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('a[href="/integrations"]')).toHaveAttribute('aria-current', 'page');
  });

  test('sidebar arrow-key navigation follows the live focus model', async ({
    page,
    pageUtils,
  }) => {
    await pageUtils.navigateTo('/integrations');

    const isMobile = (page.viewportSize()?.width ?? 0) < 768;

    if (isMobile) {
      await page.getByLabel('Open sidebar').click();
      await expect(page.getByLabel('Close sidebar')).toBeVisible();
    }

    const container = page.locator(
      isMobile
        ? '[data-testid="dashboard-shell-sidebar-mobile"]'
        : '[data-testid="dashboard-shell-sidebar"]',
    );
    const focusables = container.locator(
      '[data-dashboard-sidebar-focus-scope="sidebar-main"] [data-dashboard-sidebar-focusable="true"]',
    );

    await expect(focusables.nth(1)).toBeVisible();
    await focusables.first().focus();
    await expect(focusables.first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(focusables.nth(1)).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(focusables.first()).toBeFocused();
  });
});