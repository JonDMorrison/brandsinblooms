import { test, expect } from "@playwright/test";

test("mobile actions and KPIs are visible, not lost in whitespace", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/e2e/dashboard-mobile/fixture.html?scenario=owner");
  await expect(page.getByText("What would you like to do?")).toBeVisible();
  for (const name of ["Create an email", "Send a text", "Customers"]) {
    const button = page.getByRole("button", { name: new RegExp(name) });
    await expect(button).toBeVisible();
    const rect = await button.boundingBox();
    expect(rect?.x).toBeGreaterThanOrEqual(0);
    expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(
      page.viewportSize()!.width + 2,
    );
  }
  const first = await page
    .getByRole("button", { name: /Create an email/ })
    .boundingBox();
  const heading = await page
    .getByText("What would you like to do?")
    .boundingBox();
  expect((first?.y ?? Infinity) - (heading?.y ?? 0)).toBeLessThan(150);
  await expect(page.getByText("Recent performance")).toBeVisible();
  await expect(page.getByText("Example spring newsletter")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/dashboard-owner-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Create an email/ }).click();
  await expect(page.getByTestId("destination")).toContainText(
    "/newsletters/new",
  );
});

test("no permission state is explicit rather than a blank page", async ({
  page,
}) => {
  await page.goto("/e2e/dashboard-mobile/fixture.html?scenario=no-permissions");
  const heading = page.getByText("What would you like to do?");
  await expect(heading).toBeVisible();
  const warning = page.getByRole("alert");
  await expect(warning).toContainText(
    "Your dashboard tools aren't available yet",
  );
  await expect(
    page.getByRole("button", { name: /Retry dashboard access/ }),
  ).toBeVisible();
  const [first, second] = await Promise.all([
    heading.boundingBox(),
    warning.boundingBox(),
  ]);
  expect((second?.y ?? Infinity) - (first?.y ?? 0)).toBeLessThan(110);
  await page.screenshot({
    path:
      "test-results/dashboard-no-rights-" + test.info().project.name + ".png",
    fullPage: true,
  });
});

test("master admins can choose a company directly from their dashboard", async ({
  page,
}) => {
  await page.goto(
    "/e2e/dashboard-mobile/fixture.html?scenario=master-no-company",
  );
  await expect(page.getByText("Choose a company to get started")).toBeVisible();
  await page.getByRole("combobox", { name: "Company to manage" }).click();
  await page.getByRole("option", { name: "Example Garden Centre" }).click();
  await expect(
    page.getByRole("button", { name: /Create an email/ }),
  ).toBeVisible();
});

test("loading rights show clear action placeholders", async ({ page }) => {
  await page.goto("/e2e/dashboard-mobile/fixture.html?scenario=loading");
  await expect(
    page.getByRole("status", { name: "Loading dashboard actions" }),
  ).toBeVisible();
  await expect(page.getByText("Loading your company tools…")).toBeVisible();
});

test("tap depresses the dashboard card, then opens the destination once", async ({
  page,
}) => {
  await page.goto("/e2e/dashboard-mobile/fixture.html?scenario=owner");
  const email = page.getByRole("button", { name: /Create an email/ });
  const sms = page.getByRole("button", { name: /Send a text/ });
  await email.dispatchEvent("click");
  await expect(email).toHaveAttribute("data-activating", "true");
  await expect(email).toHaveAttribute("aria-busy", "true");
  await expect(email).toContainText("Opening…");
  // A second press may arrive while the touch animation is running.
  await sms.dispatchEvent("click");
  await page.waitForTimeout(80);
  const transform = await email.evaluate(
    (el) => getComputedStyle(el).transform,
  );
  const scale = transform.match(/matrix\(([^,)]+)/);
  expect(
    scale,
    "Expected a rendered press transform; received " + transform,
  ).not.toBeNull();
  expect(Number(scale![1])).toBeLessThan(0.998);
  await expect(page.getByTestId("destination")).toContainText(
    "/newsletters/new",
  );
});

test("performance tiles have the same tactile feedback before opening analytics", async ({
  page,
}) => {
  await page.goto("/e2e/dashboard-mobile/fixture.html?scenario=owner");
  const clickRate = page.getByRole("button", { name: /Click-through rate/ });
  await clickRate.dispatchEvent("click");
  await expect(clickRate).toHaveAttribute("data-activating", "true");
  await expect(clickRate).toContainText("Opening…");
  await expect(page.getByTestId("destination")).toContainText("/analytics");
});

test("reduced-motion settings skip the delayed transition", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/e2e/dashboard-mobile/fixture.html?scenario=owner");
  const elapsed = await page
    .getByRole("button", { name: /Create an email/ })
    .evaluate(
      (element) =>
        new Promise<number>((resolve, reject) => {
          const start = performance.now();
          const timeout = window.setTimeout(() => {
            observer.disconnect();
            reject(new Error("Navigation did not complete."));
          }, 1000);
          const observer = new MutationObserver(() => {
            if (document.querySelector('[data-testid="destination"]')) {
              observer.disconnect();
              clearTimeout(timeout);
              resolve(performance.now() - start);
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          (element as HTMLButtonElement).click();
        }),
    );
  expect(elapsed).toBeLessThan(150);
});
