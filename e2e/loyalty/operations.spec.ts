import { test, expect, type Page } from "@playwright/test";
const at = "2026-10-15T18:00:00Z";
const actions: string[] = [];
async function mockApi(page: Page) {
  actions.length = 0;
  await page.route("**/functions/v1/loyalty-programmes", async (route) => {
    const body = route.request().postDataJSON();
    actions.push(body.action);
    if (body.expectedTenantId !== "fixture-tenant")
      throw new Error("Unexpected test tenant");
    let response: unknown;
    if (body.action === "audiences") response = { segments: [], bloomSets: [] };
    else if (body.action === "list") response = { programmes: [], count: 0 };
    else if (body.action === "runs") response = { runs: [] };
    else if (body.action === "preview_baseline")
      response = {
        previewId: "review-a",
        digest: "a".repeat(64),
        expiresAt: "2099-01-01T00:00:00Z",
        versionId: "version-a",
        page: 1,
        hasMore: false,
        baseline: {
          version: 1,
          period: {
            version: 1,
            tenantId: "fixture-tenant",
            sourceCutoff: at,
            settings: {
              currency: "CAD",
              timezone: "America/Vancouver",
              spendWeight: 50,
              transactionsWeight: 50,
            },
            window: body.window,
            coverage: { status: "unverified", evidence: "", reviewedAt: null },
            customers: [
              {
                customerId: "synthetic-customer-a",
                recordedSpendMinor: 20000,
                recordedTransactions: 4,
                orders: [{ id: "synthetic-order" }],
                missingOrderIds: [],
              },
            ],
            unlinkedOrderIds: [],
          },
          capturedEmailConsentCount: 0,
          capturedMemberCount: 1,
          membershipDatesMissing: 0,
        },
        audience: {
          name: "All active profiles",
          customerCount: 1,
          excludedCount: 0,
          unknownCount: 0,
          definition: { activeProfiles: true },
          notes: ["Marketing consent is a separate check."],
        },
      };
    else if (body.action === "confirm_baseline") {
      expect(body.confirmed).toBe(true);
      expect(body.digest).toBe("a".repeat(64));
      response = { saved: { baselineId: "baseline-a" } };
    } else if (body.action === "calendar_preview")
      response = {
        previewId: "calendar-a",
        digest: "b".repeat(64),
        expiresAt: "2099-01-01T00:00:00Z",
        preview: {
          counts: { source: 2, accepted: 1, duplicate: 0, rejected: 1 },
          rows: [
            {
              rowNumber: 2,
              state: "accepted",
              item: {
                title: "Spring hydrangeas",
                date: "2027-03-01",
                channel: "email",
              },
              original: body.rows[0],
              errors: [],
            },
            {
              rowNumber: 3,
              state: "rejected",
              item: null,
              original: body.rows[1],
              errors: ["Invalid source date."],
            },
          ],
        },
      };
    else if (body.action === "calendar_confirm") {
      expect(body.confirmed).toBe(true);
      expect(body.acceptRejected).toBe(true);
      response = {
        saved: { created: 1, duplicates: 0, rejected: 1, scheduledMessages: 0 },
      };
    } else if (body.action === "calendar_history") response = { batches: [] };
    else
      throw new Error("Unexpected financial or sending action: " + body.action);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
      body: JSON.stringify({
        tenantId: "fixture-tenant",
        ...(response as object),
      }),
    });
  });
}
test("baseline review is explicit, editable and does not issue rewards", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/e2e/loyalty/fixture.html");
  await page
    .getByRole("button", { name: "Review baseline and audience" })
    .click();
  await expect(
    page.getByText("1 customers in this fixed cohort"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm and save baseline" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Save this exact 1-customer baseline/ })
    .check();
  await page.getByRole("button", { name: "Confirm and save baseline" }).click();
  await expect(
    page.getByText(/original cohort and baseline are saved/),
  ).toBeVisible();
  expect(actions).toContain("confirm_baseline");
  expect(actions.some((a) => /issue|send|redeem/.test(a))).toBe(false);
  await page.screenshot({
    path: `test-results/loyalty-baseline-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("calendar import preserves rejected rows and never schedules communications", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/e2e/loyalty/fixture.html?view=calendar");
  await page
    .getByRole("button", { name: /Import your marketing calendar/ })
    .click();
  await page
    .getByLabel("Marketing calendar file")
    .setInputFiles({
      name: "synthetic-calendar.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Title,Date\nSpring hydrangeas,2027-03-01\nNeeds review,bad\n",
      ),
    });
  await page.getByRole("button", { name: "Read selected sheet" }).click();
  await expect(page.getByText("Map 2 source rows")).toBeVisible();
  await page.getByLabel("Title column (required)").click();
  await page.getByRole("option", { name: "Title", exact: true }).click();
  await page.getByLabel("Date column (required)").click();
  await page.getByRole("option", { name: "Date", exact: true }).click();
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(
    page.getByText("1 ready · 0 duplicates · 1 need attention"),
  ).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirm calendar import" });
  await expect(confirm).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: /Import 1 accepted rows as planned tasks only/,
    })
    .check();
  await expect(confirm).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Leave 1 rejected rows out/ })
    .check();
  await confirm.click();
  await expect(page.getByText(/No messages scheduled/)).toBeVisible();
  await page.screenshot({
    path: `test-results/loyalty-calendar-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("saved-programme workspace retains the existing planner without automatic activation", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/e2e/loyalty/fixture.html?view=programmes");
  await page
    .getByRole("button", {
      name: /Loyalty programmes · Plan, rewards and results/,
    })
    .click();
  await page.getByRole("tab", { name: "Saved programmes & results" }).click();
  await expect(page.getByText("Start with one clear goal.")).toBeVisible();
  expect(actions.filter((a) => a !== "list")).toEqual([]);
  await page.screenshot({
    path: `test-results/loyalty-workspace-${test.info().project.name}.png`,
    fullPage: true,
  });
});
