import { test, expect } from './fixtures/auth.fixture';

test.describe('Dashboard topbar interactions', () => {
  test('search, user menu, and report problem dialog match the current shell', async ({
    page,
    pageUtils,
  }) => {
    await pageUtils.navigateTo('/integrations');

    const isMobile = (page.viewportSize()?.width ?? 0) < 768;

    if (isMobile) {
      await page.getByLabel('Open search').click();
      const mobileSearch = page.getByRole('textbox', {
        name: 'Search something...',
      });

      await expect(mobileSearch).toBeVisible();
      await mobileSearch.fill('lightspeed');
      await page.getByLabel('Close search').click();
      await expect(mobileSearch).toBeHidden();
    } else {
      const desktopSearch = page.getByRole('textbox', {
        name: 'Search something...',
      });

      await expect(desktopSearch).toBeVisible();
      await desktopSearch.fill('lightspeed');
    }

    await page.getByLabel('Open user menu').click();
    await page.getByRole('menuitem', { name: 'Report a Problem' }).click();

    const dialog = page.getByRole('dialog', { name: 'Report a Problem' });

    await expect(dialog).toBeVisible();
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#description')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('authenticated users can move between the current tenant entry routes', async ({
    page,
    pageUtils,
  }) => {
    await pageUtils.navigateTo('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);

    await pageUtils.navigateTo('/integrations');
    await expect(page.locator('[data-testid="dashboard-shell-root"]')).toBeVisible();

    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(page.locator('[data-testid="dashboard-shell-topbar"]')).toContainText('Integrations');
    }

    await pageUtils.navigateTo('/settings');
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('body')).toBeVisible();
  });
});