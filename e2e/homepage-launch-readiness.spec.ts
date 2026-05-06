import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const homepageSections = [
  { slug: "hero", index: 0, heading: "Grow Your Green Business" },
  { slug: "features", index: 1, heading: "Everything You Need to Grow" },
  { slug: "customer-growth", index: 2, heading: "A CRM That Actually Works" },
  { slug: "ai", index: 3, heading: "Intelligence Built In" },
  { slug: "automation", index: 4, heading: "Why Teams Choose BloomSuite" },
  { slug: "integrations", index: 5, heading: "Works With Your Favorite Tools" },
  { slug: "testimonials", index: 6, heading: "Real Results. Real Impact." },
  { slug: "start", index: 7, heading: "Plans That Grow With You" },
] as const;

const monitorPageHealth = (page: Page) => {
  const issues: string[] = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      if (message.text().includes("Automatic fallback to software WebGL")) {
        return;
      }

      issues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    if (failure?.errorText.includes("ERR_ABORTED")) {
      return;
    }

    issues.push(`requestfailed: ${request.url()} ${failure?.errorText ?? ""}`);
  });

  return issues;
};

const fulfillRollout = (page: Page, enabled = true) =>
  page.route("**/homepage-rollout.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ enabled, rolloutPercent: enabled ? 100 : 0 }),
    }),
  );

const gotoHomepage = async (page: Page, slug = "hero") => {
  await page.goto(`/#${slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="homepage-shell"]', {
    state: "attached",
  });
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(
    Math.max(overflow.documentWidth, overflow.bodyWidth),
    `No horizontal overflow at ${overflow.viewportWidth}px viewport`,
  ).toBeLessThanOrEqual(overflow.viewportWidth + 2);
};

const waitForIdleTransition = async (page: Page) => {
  await expect(page.getByTestId("homepage-shell")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
};

test.describe("HP-M13 homepage launch readiness", () => {
  test.beforeEach(async ({ page }) => {
    await fulfillRollout(page, true);
  });

  test("renders every deep-linked section without console or asset failures", async ({
    page,
  }) => {
    const issues = monitorPageHealth(page);

    for (const section of homepageSections) {
      await gotoHomepage(page, section.slug);

      const shell = page.getByTestId("homepage-shell");
      await expect(shell).toHaveAttribute(
        "data-current-section",
        String(section.index),
      );
      await expect(
        page.locator(`section#${section.slug}[data-active="true"]`),
      ).toHaveAttribute("aria-hidden", "false");
      await expect(
        page.getByRole("heading", { name: section.heading }),
      ).toBeVisible();
      await expect(
        page.getByRole("main", { name: "BloomSuite homepage" }),
      ).toHaveCount(1);
      await expectNoHorizontalOverflow(page);
    }

    await expect(
      page.getByRole("navigation", { name: "Homepage section progress" }),
    ).toBeVisible();
    expect(issues).toEqual([]);
  });

  test("captures wheel, keyboard, and touch-style navigation without scroll leak", async ({
    page,
    isMobile,
  }) => {
    const issues = monitorPageHealth(page);
    await gotoHomepage(page, "hero");
    const shell = page.getByTestId("homepage-shell");

    await expect(shell).toHaveAttribute("data-current-section", "0");
    await expect(
      page.evaluate(() => ({
        bodyOverflow: getComputedStyle(document.body).overflow,
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
        bodyOverscroll: getComputedStyle(document.body).overscrollBehavior,
      })),
    ).resolves.toMatchObject({
      bodyOverflow: "hidden",
      htmlOverflow: "hidden",
      bodyOverscroll: "none",
    });

    if (isMobile) {
      await page.evaluate(() => {
        const shellElement = document.querySelector(
          '[data-testid="homepage-shell"]',
        );
        if (!shellElement) {
          return;
        }

        const dispatchTouch = (type: string, clientY: number) => {
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(event, "touches", {
            value: type === "touchend" ? [] : [{ clientX: 160, clientY }],
          });
          Object.defineProperty(event, "changedTouches", {
            value: [{ clientX: 160, clientY }],
          });
          shellElement.dispatchEvent(event);
        };

        dispatchTouch("touchstart", 620);
        dispatchTouch("touchmove", 420);
        dispatchTouch("touchend", 420);
      });

      await expect(shell).toHaveAttribute("data-current-section", "1");
      expect(issues).toEqual([]);
      return;
    }

    await page.mouse.wheel(0, 140);
    await expect(shell).toHaveAttribute("data-current-section", "1");

    for (let index = 0; index < 5; index += 1) {
      await page.mouse.wheel(0, 18);
    }
    await expect(shell).toHaveAttribute("data-current-section", "1");
    await waitForIdleTransition(page);

    await page.keyboard.press("ArrowDown");
    await expect(shell).toHaveAttribute("data-current-section", "2");
    await page.keyboard.press("End");
    await expect(shell).toHaveAttribute("data-current-section", "7");
    await page.keyboard.press("Home");
    await expect(shell).toHaveAttribute("data-current-section", "0");

    expect(issues).toEqual([]);
  });

  test("supports reduced motion, forced-colors fallback, and 200 percent zoom", async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== "chromium",
      "forced-colors is validated in Chromium",
    );

    const issues = monitorPageHealth(page);
    await page.emulateMedia({ forcedColors: "active" });
    await gotoHomepage(page, "hero");

    await expect(page.getByTestId("homepage-shell")).toBeVisible();
    await expect(
      page.evaluate(() => window.matchMedia("(forced-colors: active)").matches),
    ).resolves.toBe(true);
    await expect(
      page.evaluate(() => {
        const nav = document.querySelector(".hp-nav");
        return nav ? getComputedStyle(nav).boxShadow : "missing";
      }),
    ).resolves.toBe("none");

    await page.emulateMedia({ forcedColors: "none", reducedMotion: "reduce" });
    await gotoHomepage(page, "ai");
    await expect(page.getByTestId("homepage-shell")).toHaveAttribute(
      "data-device-tier",
      "fallback",
    );
    await expect(page.locator(".hp-particle-canvas")).toHaveCount(0);
    await expect(page.getByTestId("ai-chat-demo")).toHaveAttribute(
      "data-static",
      "true",
    );

    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await page.evaluate(() => {
      document.documentElement.dataset.darkreaderMode = "dynamic";
    });
    await expect(
      page.getByRole("heading", { name: "Intelligence Built In" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await client.detach();

    expect(issues).toEqual([]);
  });

  test("has no serious or critical axe violations", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", "axe scan is run once in Chromium");

    await gotoHomepage(page, "hero");
    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrCritical = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );

    expect(seriousOrCritical).toEqual([]);
  });

  test("supports server-controlled rollback to the legacy homepage", async ({
    page,
  }) => {
    await page.unroute("**/homepage-rollout.json");
    await fulfillRollout(page, false);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("homepage-shell")).toHaveCount(0);
    await expect(page.locator(".theme-core-home")).toBeVisible();
  });

  test("fires public homepage analytics only after consent", async ({
    isMobile,
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("bloomsuite.analyticsConsent", "granted");
      window.dataLayer = [];
    });

    await gotoHomepage(page, "hero");
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
    }

    await page
      .getByRole("button", { name: "Start Free Trial" })
      .first()
      .click();

    const events = await page.evaluate(() => window.dataLayer ?? []);

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "homepage_page_view",
          section: "hero",
        }),
        expect.objectContaining({
          event: "homepage_section_view",
          section: "hero",
        }),
        expect.objectContaining({
          event: "homepage_cta_click",
          label: "Start Free Trial",
          href: "/auth",
        }),
      ]),
    );
  });
});
