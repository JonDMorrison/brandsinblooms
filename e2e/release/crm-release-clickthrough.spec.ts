import { test, expect } from '@playwright/test';

const BASE_URL = 'https://www.bloomsuite.app';
const DEMO_TENANT = 'Greenfield Garden Centre';
let previousTenantLabel: string | null = null;

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
  // Chromium emits this generic message without the request URL. Every 403 is
  // captured below with its actionable URL, so this duplicate line is ignored.
  /Failed to load resource: the server responded with a status of 403/i,
];

function isIgnoredConsoleError(message: string) {
  return ignoredConsolePatterns.some((pattern) => pattern.test(message));
}

async function openAdminManage(browser: Parameters<typeof test.beforeAll>[0] extends never ? never : any) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: 'e2e/.auth/user.json',
  });
  const page = await context.newPage();
  await page.goto('/admin/manage', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Admin Manage', { exact: true })).toBeVisible({ timeout: 15_000 });
  return { context, page };
}

async function selectTenant(page: any, tenantName: string) {
  const search = page.getByPlaceholder('Search by tenant name or ID...');
  await search.fill(tenantName);
  const row = page.getByRole('row').filter({ hasText: tenantName }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  const selectedButton = row.getByRole('button', { name: 'Selected', exact: true });
  if (!(await selectedButton.isVisible().catch(() => false))) {
    await row.getByRole('button', { name: 'Select', exact: true }).click();
  }
  await expect(page.getByText(`Managing ${tenantName}`, { exact: true })).toBeVisible({ timeout: 10_000 });
  // AdminContext persists the selection to admin_session_context asynchronously.
  await page.waitForTimeout(750);
}

test.beforeAll(async ({ browser }) => {
  const { context, page } = await openAdminManage(browser);
  try {
    const managing = page.getByText(/^Managing /).first();
    if (await managing.isVisible().catch(() => false)) {
      previousTenantLabel = (await managing.innerText()).replace(/^Managing\s+/, '').trim() || null;
    }

    if (previousTenantLabel !== DEMO_TENANT) {
      await selectTenant(page, DEMO_TENANT);
    }
  } finally {
    await context.close();
  }
});

test.afterAll(async ({ browser }) => {
  const { context, page } = await openAdminManage(browser);
  try {
    if (previousTenantLabel === DEMO_TENANT) return;

    if (previousTenantLabel) {
      await selectTenant(page, previousTenantLabel);
      return;
    }

    const clearSelection = page.getByRole('button', { name: 'Clear Selection', exact: true });
    if (await clearSelection.isVisible().catch(() => false)) {
      await clearSelection.click();
      await expect(page.getByText('No tenant selected', { exact: true })).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(750);
    }
  } finally {
    await context.close();
  }
});

for (const route of routes) {
  test(`release click-through: ${route}`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    const forbiddenResponses: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !isIgnoredConsoleError(message.text())) {
        consoleErrors.push(message.text());
      }
    });
    page.on('response', (response) => {
      const status = response.status();
      if (status >= 500) {
        serverErrors.push(`${status} ${response.request().method()} ${response.url()}`);
      }
      if (status === 403) {
        forbiddenResponses.push(`${status} ${response.request().method()} ${response.url()}`);
      }
    });

    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const accessCheck = page.getByRole('status', { name: 'Checking workspace access' });
    await accessCheck.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(650);

    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/auth(?:$|\?)/);
    expect(new URL(page.url()).pathname, `unexpected redirect from ${route}`).toBe(route);
    await expect(page.locator('body')).not.toContainText(/Something went wrong|Application error|Security Violation/i);
    await expect(accessCheck, `workspace access never resolved on ${route}`).toBeHidden({ timeout: 2_000 });

    // Click visible tabs and safe disclosure controls to exercise secondary views
    // without sending messages, creating records, saving changes, or mutating data.
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
    expect(forbiddenResponses, `403 responses on ${route}`).toEqual([]);
  });
}
