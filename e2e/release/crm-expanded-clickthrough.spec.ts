import { test, expect, type Browser, type Page, type Response } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://www.bloomsuite.app';
const DEMO_TENANT = 'Greenfield Garden Centre';
let previousTenantLabel: string | null = null;

const primaryNavigation = [
  ['Dashboard', '/dashboard'],
  ['Bloom', '/bloom'],
  ['Analytics', '/analytics'],
  ['Activity Center', '/activity'],
  ['Calendar', '/calendar'],
  ['Customers', '/crm/customers'],
  ['Segments', '/crm/segments'],
  ['Personas', '/crm/personas'],
  ['Forms', '/crm/forms'],
  ['Campaigns', '/crm/campaigns'],
  ['Automations', '/crm/automations'],
  ['Newsletter', '/newsletters'],
  ['SMS Campaigns', '/sms'],
  ['Products', '/products'],
  ['Manage Domains', '/domains'],
  ['Integrations', '/integrations'],
  ['Settings', '/settings'],
  // /profile is a parent route whose ProfilePage intentionally replaces its
  // index with the canonical Company Information child.
  ['Profile', '/profile/company'],
  ['Account', '/account'],
  ['Support', '/support'],
] as const;

const secondaryReadOnlyRoutes = [
  ['/crm/analytics', '/crm/analytics'],
  ['/crm/settings/email-sending', '/crm/settings/email-sending'],
  ['/crm/campaigns/blocks', '/crm/campaigns/blocks'],
  ['/settings/usage', '/settings/usage'],
  ['/account-setup', '/account-setup'],
  // These legacy routes have explicit RedirectWithQuery entries in App.tsx.
  ['/plan', '/calendar'],
  ['/helpdesk', '/helpdesk'],
  ['/community', '/crm/campaigns'],
  ['/content', '/crm/campaigns'],
  ['/assets', '/crm/campaigns'],
] as const;

const ignoredConsolePatterns = [
  /favicon/i,
  /ResizeObserver loop/i,
  /third[- ]party cookie/i,
  /Failed to load resource: the server responded with a status of 403/i,
];

function isIgnoredConsoleError(message: string) {
  return ignoredConsolePatterns.some((pattern) => pattern.test(message));
}

function isAdminContextWrite(response: Response) {
  return response.url().includes('/rest/v1/admin_session_context') &&
    response.request().method() !== 'GET';
}

async function openAdminManage(browser: Browser) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: 'e2e/.auth/user.json',
  });
  const page = await context.newPage();
  await page.goto('/admin/manage', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Admin Manage', { exact: true })).toBeVisible({ timeout: 15_000 });
  return { context, page };
}

async function selectTenant(page: Page, tenantName: string) {
  const search = page.getByPlaceholder('Search by tenant name or ID...');
  await search.fill(tenantName);
  const row = page.getByRole('row').filter({ hasText: tenantName }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  const selectedButton = row.getByRole('button', { name: 'Selected', exact: true });
  if (!(await selectedButton.isVisible().catch(() => false))) {
    const contextWrite = page.waitForResponse(isAdminContextWrite, { timeout: 10_000 });
    await row.getByRole('button', { name: 'Select', exact: true }).click();
    const response = await contextWrite;
    expect(response.ok(), `admin tenant context write failed: ${response.status()} ${response.url()}`).toBeTruthy();
  }

  await expect(page.getByText(`Managing ${tenantName}`, { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (new URL(page.url()).pathname !== '/admin/manage') {
    await page.goto('/admin/manage', { waitUntil: 'domcontentloaded' });
  }
  await expect(page.getByText(`Managing ${tenantName}`, { exact: true })).toBeVisible({ timeout: 10_000 });
}

async function clearTenant(page: Page) {
  const clearSelection = page.getByRole('button', { name: 'Clear Selection', exact: true });
  if (!(await clearSelection.isVisible().catch(() => false))) return;
  const contextWrite = page.waitForResponse(isAdminContextWrite, { timeout: 10_000 });
  await clearSelection.click();
  const response = await contextWrite;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByText('No tenant selected', { exact: true })).toBeVisible({ timeout: 10_000 });
}

async function assertHealthyPage(page: Page, expectedPath: string, sourcePath = expectedPath) {
  const accessCheck = page.getByRole('status', { name: 'Checking workspace access' });
  await accessCheck.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await expect(page).not.toHaveURL(/\/auth(?:$|\?)/);
  expect(new URL(page.url()).pathname, `unexpected redirect from ${sourcePath}`).toBe(expectedPath);
  await expect(page.locator('body')).not.toContainText(/Something went wrong|Application error|Security Violation/i);
  await expect(accessCheck, `workspace access never resolved on ${sourcePath}`).toBeHidden({ timeout: 2_000 });
}

function watchForFailures(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const serverErrors: string[] = [];
  const forbiddenResponses: string[] = [];
  const notFoundResponses: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !isIgnoredConsoleError(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on('response', (response) => {
    const status = response.status();
    const diagnostic = `${status} ${response.request().method()} ${response.url()}`;
    if (status >= 500) serverErrors.push(diagnostic);
    if (status === 403) forbiddenResponses.push(diagnostic);
    if (status === 404) notFoundResponses.push(diagnostic);
  });

  return () => {
    expect(serverErrors, '5xx responses').toEqual([]);
    expect(pageErrors, 'page errors').toEqual([]);
    expect(notFoundResponses, '404 responses').toEqual([]);
    expect(consoleErrors, 'console errors').toEqual([]);
    expect(forbiddenResponses, '403 responses').toEqual([]);
  };
}

test.beforeAll(async ({ browser }) => {
  const { context, page } = await openAdminManage(browser);
  try {
    const managing = page.getByText(/^Managing /).first();
    if (await managing.isVisible().catch(() => false)) {
      previousTenantLabel = (await managing.innerText()).replace(/^Managing\s+/, '').trim() || null;
    }
    if (previousTenantLabel !== DEMO_TENANT) await selectTenant(page, DEMO_TENANT);
  } finally {
    await context.close();
  }
});

test.afterAll(async ({ browser }) => {
  const { context, page } = await openAdminManage(browser);
  try {
    if (previousTenantLabel === DEMO_TENANT) return;
    if (previousTenantLabel) await selectTenant(page, previousTenantLabel);
    else await clearTenant(page);
  } finally {
    await context.close();
  }
});

test('primary sidebar navigation is clickable end-to-end', async ({ page }) => {
  const assertNoFailures = watchForFailures(page);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await assertHealthyPage(page, '/dashboard');

  for (const [label, expectedPath] of primaryNavigation) {
    const sidebar = page.getByTestId('dashboard-shell-sidebar');
    const link = sidebar.getByRole('link', { name: label, exact: true });
    await expect(link, `missing sidebar link: ${label}`).toBeVisible({ timeout: 10_000 });
    await link.click();
    await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 12_000 });
    await assertHealthyPage(page, expectedPath, label);
  }

  assertNoFailures();
});

for (const [sourcePath, expectedPath] of secondaryReadOnlyRoutes) {
  test(`expanded read-only route: ${sourcePath}`, async ({ page }) => {
    const assertNoFailures = watchForFailures(page);
    await page.goto(sourcePath, { waitUntil: 'domcontentloaded' });
    await assertHealthyPage(page, expectedPath, sourcePath);
    assertNoFailures();
  });
}
