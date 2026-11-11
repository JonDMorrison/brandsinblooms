import { expect, type Page } from "@playwright/test";

/**
 * How long one tenant-shell route may take to finish every client-side
 * loading stage on a cold page load (bundle, auth rehydration, onboarding
 * check, lazy page chunk, CRM role lookup, and any route redirect).
 */
export const ROUTE_SETTLE_TIMEOUT_MS = 15_000;

/**
 * Asserts that a tenant-shell route has finished loading and landed on
 * `expectedPath`.
 *
 * A route in this app passes through several loading stages, each mounted
 * only after the previous one finishes: ProtectedRoute's "Loading..." screen,
 * the DashboardShell, the Suspense `PageSkeleton` ("Loading page content")
 * while the lazy chunk downloads, and `CRMAccessGate` ("Checking workspace
 * access") while the role resolves. Redirects such as `/community` ->
 * `/crm/campaigns` only run after the lazy chunk has loaded.
 *
 * Sampling the URL after a fixed sleep raced those stages: on a slow cold
 * load the redirect had not happened yet, or the access check had not even
 * mounted when the "hidden" wait ran. This helper waits on the real
 * conditions instead, then re-checks the final URL because the access gate
 * itself may redirect once it resolves.
 */
export async function expectRouteSettled(
  page: Page,
  expectedPath: string,
  sourcePath = expectedPath,
) {
  const pathname = () => new URL(page.url()).pathname;

  await expect
    .poll(pathname, {
      message: `unexpected redirect from ${sourcePath}`,
      timeout: ROUTE_SETTLE_TIMEOUT_MS,
    })
    .toBe(expectedPath);

  // The shell renders only after ProtectedRoute and OnboardingGuard pass. Its
  // content slot then always holds either a loading status or the page, in
  // the same React commit, so once the shell is visible the absence of both
  // loading statuses means the routed page itself has rendered.
  await expect(
    page.getByTestId("dashboard-shell-sidebar"),
    `dashboard shell never rendered on ${sourcePath}`,
  ).toBeVisible({ timeout: ROUTE_SETTLE_TIMEOUT_MS });
  await expect(
    page.getByRole("status", { name: "Loading page content" }),
    `page chunk never loaded on ${sourcePath}`,
  ).toHaveCount(0, { timeout: ROUTE_SETTLE_TIMEOUT_MS });
  await expect(
    page.getByRole("status", { name: "Checking workspace access" }),
    `workspace access never resolved on ${sourcePath}`,
  ).toHaveCount(0, { timeout: ROUTE_SETTLE_TIMEOUT_MS });

  expect(pathname(), `unexpected redirect from ${sourcePath}`).toBe(
    expectedPath,
  );
}
