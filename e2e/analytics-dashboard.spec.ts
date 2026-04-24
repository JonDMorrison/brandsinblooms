import { test, expect } from "@playwright/test";
import { PageUtils } from "./utils/test-setup";

const hasAdminCredentials = Boolean(
  process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD,
);

test.describe("Admin dashboard shell", () => {
  test.skip(
    !hasAdminCredentials,
    "Admin browser coverage requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD.",
  );

  test("cost and analytics health pages render inside the admin shell", async ({
    page,
  }) => {
    const pageUtils = new PageUtils(page);

    await pageUtils.login(
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!,
    );

    const adminRoutes = [
      {
        path: "/admin/costs",
        topbarTitle: "Costs",
        pageHeading: "Cost Dashboard",
      },
      {
        path: "/admin/analytics-health",
        topbarTitle: "Analytics Health",
        pageHeading: "Analytics Health",
      },
    ];

    for (const route of adminRoutes) {
      await pageUtils.navigateTo(route.path);

      await expect(
        page.locator('[data-testid="dashboard-shell-root"]'),
      ).toHaveCount(1);
      await expect(
        page.locator('[data-testid="dashboard-shell-topbar"]'),
      ).toContainText(route.topbarTitle);
      await expect(
        page.getByRole("heading", { name: route.pageHeading }),
      ).toBeVisible();
    }
  });
});
