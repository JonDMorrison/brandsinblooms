import {
  test,
  expect,
  type Browser,
  type Page,
  type Response,
} from "@playwright/test";
import { deleteMarkedCampaigns, deleteStudioTestUpload } from "../../scripts/ci/production-e2e-state.mjs";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "https://www.bloomsuite.app";
const DEMO_TENANT = "Greenfield Garden Centre";
const ARTIFACT_MARKER =
  process.env.E2E_ARTIFACT_MARKER ??
  `bloom-e2e-local-${process.pid}-${Date.now()}`;
let previousTenantLabel: string | null = null;
let tenantSetupAttempted = false;

function isAdminContextWrite(response: Response) {
  return (
    response.url().includes("/rest/v1/admin_session_context") &&
    response.request().method() !== "GET"
  );
}

async function openAdminManage(browser: Browser) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: "e2e/.auth/user.json",
  });
  const page = await context.newPage();
  await page.goto("/admin/manage", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Client tools", level: 2 }),
  ).toBeVisible({ timeout: 15_000 });
  return { context, page };
}

async function selectTenant(page: Page, tenantName: string) {
  const search = page.getByPlaceholder("Search by tenant name or ID...");
  await search.fill(tenantName);
  const row = page.getByRole("row").filter({ hasText: tenantName }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  const selectedButton = row.getByRole("button", {
    name: "Selected",
    exact: true,
  });
  if (!(await selectedButton.isVisible().catch(() => false))) {
    const contextWrite = page.waitForResponse(isAdminContextWrite, {
      timeout: 10_000,
    });
    await row.getByRole("button", { name: "Select", exact: true }).click();
    const response = await contextWrite;
    expect(
      response.ok(),
      `admin tenant context write failed: ${response.status()} ${response.url()}`,
    ).toBeTruthy();
  }

  await expect(
    page.getByText(`Managing ${tenantName}`, { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  if (new URL(page.url()).pathname !== "/admin/manage") {
    await page.goto("/admin/manage", { waitUntil: "domcontentloaded" });
  }
  await expect(
    page.getByText(`Managing ${tenantName}`, { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
}

async function clearTenant(page: Page) {
  const managing = page.getByText(/^Managing /).first();
  if (!(await managing.isVisible().catch(() => false))) {
    await expect(
      page.getByText("No tenant selected", { exact: true }),
    ).toBeVisible({
      timeout: 10_000,
    });
    return;
  }

  const clearSelection = page.getByRole("button", {
    name: "Clear Selection",
    exact: true,
  });
  await expect(clearSelection).toBeVisible({ timeout: 10_000 });
  const contextWrite = page.waitForResponse(isAdminContextWrite, {
    timeout: 10_000,
  });
  await clearSelection.click();
  const response = await contextWrite;
  expect(
    response.ok(),
    `admin tenant context clear failed: ${response.status()} ${response.url()}`,
  ).toBeTruthy();
  await expect(
    page.getByText("No tenant selected", { exact: true }),
  ).toBeVisible({
    timeout: 10_000,
  });
}

test.beforeAll(async ({ browser }) => {
  const { context, page } = await openAdminManage(browser);
  try {
    const managing = page.getByText(/^Managing /).first();
    if (await managing.isVisible().catch(() => false)) {
      previousTenantLabel =
        (await managing.innerText()).replace(/^Managing\s+/, "").trim() || null;
    }

    if (previousTenantLabel !== DEMO_TENANT) {
      tenantSetupAttempted = true;
      await selectTenant(page, DEMO_TENANT);
    }
  } finally {
    await context.close();
  }
});

test.afterAll(async ({ browser }) => {
  if (!tenantSetupAttempted) return;

  const { context, page } = await openAdminManage(browser);
  try {
    if (previousTenantLabel) {
      await selectTenant(page, previousTenantLabel);
    } else {
      await clearTenant(page);
    }
  } finally {
    await context.close();
  }
});

test("a new newsletter opens Design Studio and previews Graphic Hero, button and navigation edits", async ({
  page,
}) => {
  test.setTimeout(65_000);
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD are required for cleanup");
  }

  await page.goto("/crm/campaigns/new?type=newsletter");
  await page.getByRole("button", { name: /Campaign details/ }).click();
  await page
    .getByRole("textbox", { name: "Campaign name", exact: true })
    .fill(ARTIFACT_MARKER);
  const studioEntry = page.getByRole("button", {
    name: "Customize in Design Studio",
    exact: true,
  });
  await expect(studioEntry).toBeVisible();
  await expect(studioEntry).not.toHaveAttribute("aria-disabled", "true");
  let campaignId: string | null = null;
  let uploadedObjectPath: string | null = null;
  try {
    await studioEntry.click();
    await expect(page).toHaveURL(
      /\/crm\/campaigns\/[0-9a-f-]+\/studio(?:\?|$)/,
      { timeout: 30_000 },
    );
    campaignId = new URL(page.url()).pathname.split("/")[3] ?? null;
    await expect(
      page.getByText("Save the draft before opening Campaign Studio"),
    ).toHaveCount(0);
    await expect(
      page.getByText("Could not create your newsletter draft"),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Add Graphic Hero", exact: true }).click();
    const hero = page.locator("[data-studio-block-slot]").filter({
      has: page.getByRole("button", { name: "Upload Graphic Hero image" }),
    }).last();
    const uploaded = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.startsWith("/storage/v1/object/campaign-images/"),
    );
    const chooser = page.waitForEvent("filechooser");
    await hero.getByRole("button", { name: "Upload Graphic Hero image" }).click();
    await (await chooser).setFiles("public/images/newsletter-fallback.jpg");
    const upload = await uploaded;
    expect(upload.ok(), "Graphic Hero image upload").toBeTruthy();
    const path = new URL(upload.url()).pathname;
    uploadedObjectPath = path.slice("/storage/v1/object/campaign-images/".length);
    const selectedImage = page.locator(`.nl-preview td[background$="/${uploadedObjectPath}"]`).last();
    await expect(selectedImage).toBeVisible();
    await expect(selectedImage).toHaveCSS("background-size", "contain");

    await page.getByRole("button", { name: "Add Button / Call to Action" }).click();
    const buttonSlot = page.locator("[data-studio-block-slot]").filter({
      hasText: "Button / Call to Action",
    }).last();
    await buttonSlot.click({ position: { x: 8, y: 8 } });
    await page.getByPlaceholder("Get Started").fill("View opening hours");
    await page.getByLabel("Full Width", { exact: true }).check();
    await expect(buttonSlot.locator(".nl-preview").getByText("View opening hours", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add Navigation", exact: true }).click();
    const navigation = page.locator("[data-studio-block-slot]").filter({ hasText: "Navigation" }).last();
    await navigation.click({ position: { x: 8, y: 8 } });
    await page.getByRole("textbox", { name: "Label", exact: true }).first().fill("Visit the nursery");
    await expect(navigation.locator(".nl-preview").getByText("Visit the nursery", { exact: true })).toBeVisible();
  } finally {
    const navigatedCampaignId = page
      .url()
      .match(/\/crm\/campaigns\/([0-9a-f-]+)\/studio(?:\?|$)/)?.[1];
    try {
      if (uploadedObjectPath) {
        await deleteStudioTestUpload({ email, password, path: uploadedObjectPath });
      }
    } finally {
      await deleteMarkedCampaigns({
        email,
        password,
        marker: ARTIFACT_MARKER,
        expectedCampaignId: campaignId ?? navigatedCampaignId ?? null,
      });
    }
  }
});
