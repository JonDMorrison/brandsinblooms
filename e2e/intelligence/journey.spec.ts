import { test, expect } from "@playwright/test";

test("the customer overview feels clear, uses real UI controls, and avoids overflow", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto("/e2e/intelligence/fixture.html");
  await expect(
    page.getByRole("heading", {
      name: "Know your customers. Know what to do next.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What would you like to do today?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A snapshot of your customer records" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Intelligence sections" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path:
      "test-results/intelligence-overview-" + test.info().project.name + ".png",
    fullPage: true,
  });
  const width = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(width).toBeLessThanOrEqual(2);
  expect(pageErrors).toEqual([]);
});

test("each key feature is reachable, and advanced setup is hidden by default", async ({
  page,
}) => {
  await page.goto("/e2e/intelligence/fixture.html");
  const nav = page.getByRole("navigation", { name: "Intelligence sections" });
  await nav.getByRole("button", { name: /Find customers/ }).click();
  await expect(
    page.getByRole("heading", { name: "Find a group worth understanding" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Customer purchase explorer" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: /Growth/ }).click();
  await expect(
    page.getByRole("heading", { name: "Customer growth comparison" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: /Rewards/ }).click();
  await expect(
    page.getByRole("heading", { name: "Loyalty programmes and measurement" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: /Data & channels/ }).click();
  await expect(
    page.getByRole("heading", { name: "Reviewed Ideal Customer Type export" }),
  ).toBeVisible();
  await expect(page.getByText("Push channel readiness")).toBeVisible();
  await expect(page.getByText("Advanced push programme controls")).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: /Show advanced channel setup/ })
    .click();
  await expect(
    page.getByText("Advanced push programme controls"),
  ).toBeVisible();
});

test("Bloom receives the specific question, chosen view and a safe return trail", async ({
  page,
}) => {
  await page.goto("/e2e/intelligence/fixture.html");
  const nav = page.getByRole("navigation", { name: "Intelligence sections" });
  await nav.getByRole("button", { name: /Find customers/ }).click();
  await page
    .getByRole("textbox", { name: "Ask Bloom about your customers" })
    .fill("Which customers purchased hydrangeas?");
  await page.getByRole("button", { name: /Continue in Bloom/ }).click();
  await expect(
    page.getByRole("heading", { name: "Bloom conversation" }),
  ).toBeVisible();
  const route = await page.getByTestId("bloom-url").textContent();
  expect(route).toContain("origin=intelligence");
  expect(route).toContain("returnView=explore");
  expect(route).toContain("Which+customers+purchased+hydrangeas");
});
