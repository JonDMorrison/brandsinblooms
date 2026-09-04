import { test, expect } from '../fixtures/auth.fixture';

const routes = [
  '/dashboard',
  '/activity',
  '/calendar',
  '/crm/customers',
  '/crm/segments',
  '/crm/personas',
  '/crm/forms',
  '/crm/campaigns',
  '/crm/automations',
  '/newsletters',
  '/sms',
  '/products',
  '/domains',
  '/integrations',
  '/settings',
] as const;

const ignoredConsolePatterns = [
  /favicon/i,
  /ResizeObserver loop/i,
  /third[- ]party cookie/i,
];

function isIgnoredConsoleError(message: string) {
  return ignoredConsolePatterns.some((pattern) => pattern.test(message));
}

for (const route of routes) {
  test(`release click-through: ${route}`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !isIgnoredConsoleError(message.text())) {
        consoleErrors.push(message.text());
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/auth(?:$|\?)/);
    await expect(page.locator('body')).not.toContainText(/Something went wrong|Application error|Security Violation/i);

    // Click visible tabs and safe disclosure controls to exercise secondary views.
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    for (let i = 0; i < Math.min(tabCount, 8); i += 1) {
      const tab = tabs.nth(i);
      if (await tab.isVisible().catch(() => false)) {
        await tab.click().catch(() => undefined);
        await page.waitForTimeout(150);
      }
    }

    const safeButtons = page.getByRole('button', {
      name: /^(Filters?|View|Details?|More|Options|Open|Close|Expand|Collapse|Preview)$/i,
    });
    const safeButtonCount = await safeButtons.count();
    for (let i = 0; i < Math.min(safeButtonCount, 6); i += 1) {
      const button = safeButtons.nth(i);
      if (await button.isVisible().catch(() => false) && await button.isEnabled().catch(() => false)) {
        await button.click().catch(() => undefined);
        await page.waitForTimeout(100);
      }
    }

    expect(serverErrors, `5xx responses on ${route}`).toEqual([]);
    expect(pageErrors, `page errors on ${route}`).toEqual([]);
    expect(consoleErrors, `console errors on ${route}`).toEqual([]);
  });
}
