import { expect, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { E2E_BASE_URL } from "./runtime-config";

// Test environment configuration
const ONBOARDING_CACHE_KEY_PREFIX = "onboarding-completed:";

export const TEST_CONFIG = {
  supabaseUrl: "https://udldmkqwnxhdeztyqcau.supabase.co",
  supabaseKey: "sb_publishable_iKrafIfqem0wBWT51FqNpQ_KBHmF2El",
  testUserEmail: "test-user@example.com",
  testUserPassword: "testpassword123",
  testPhoneNumbers: ["6048393258", "6041234567"],
  baseUrl: E2E_BASE_URL,
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

// Test data factory
export class TestDataFactory {
  static generateTestUser() {
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).slice(2, 8);

    return {
      email: `playwright-${timestamp}-${nonce}@example.com`,
      password: "TestPassword123!",
      fullName: `Test User ${timestamp}`,
      companyName: `Test Company ${timestamp}`,
    };
  }

  static generateTestCustomer() {
    const timestamp = Date.now();
    return {
      firstName: `John-${timestamp}`,
      lastName: `Doe-${timestamp}`,
      email: `customer-${timestamp}@example.com`,
      phone: "+16048393258",
      tags: ["test-customer"],
    };
  }

  static generateTestCampaign() {
    const timestamp = Date.now();
    return {
      name: `Test Campaign ${timestamp}`,
      message: `Test message sent at ${new Date().toISOString()}`,
      scheduledFor: new Date(Date.now() + 60000), // 1 minute from now
    };
  }
}

// Database utilities for test setup and cleanup
export class TestDatabaseUtils {
  private supabase;

  constructor() {
    this.supabase = this.createSupabaseClient();
  }

  private createSupabaseClient() {
    return createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  private async waitForCompanyProfile(userId: string) {
    const timeoutAt = Date.now() + 15000;

    while (Date.now() < timeoutAt) {
      const { data, error } = await this.supabase
        .from("company_profiles")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data?.id) {
        return data.id;
      }

      await sleep(500);
    }

    throw new Error(`Timed out waiting for company profile for user ${userId}`);
  }

  async createTestUser(
    userData: ReturnType<typeof TestDataFactory.generateTestUser>,
  ) {
    const { data, error } = await this.supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.fullName,
          business_name: userData.companyName,
        },
      },
    });

    if (error) throw error;
    return data;
  }

  async completeOnboarding(
    userData: ReturnType<typeof TestDataFactory.generateTestUser>,
  ) {
    const { data: authData, error: signInError } =
      await this.supabase.auth.signInWithPassword({
        email: userData.email,
        password: userData.password,
      });

    if (signInError) {
      throw signInError;
    }

    if (!authData.user) {
      throw new Error("Failed to authenticate newly created user");
    }

    await this.waitForCompanyProfile(authData.user.id);

    const { error: updateError } = await this.supabase
      .from("company_profiles")
      .update({
        company_name: userData.companyName,
        first_content_generated: true,
      })
      .eq("user_id", authData.user.id);

    if (updateError) {
      throw updateError;
    }

    const { data: userRecord } = await this.supabase
      .from("users")
      .select("tenant_id")
      .eq("id", authData.user.id)
      .limit(1)
      .maybeSingle();

    await this.supabase.auth.signOut();

    return {
      userId: authData.user.id,
      tenantId: userRecord?.tenant_id ?? null,
    };
  }

  async cleanupTestData(
    userData: ReturnType<typeof TestDataFactory.generateTestUser>,
  ) {
    const cleanupClient = this.createSupabaseClient();
    const { data: authData } = await cleanupClient.auth.signInWithPassword({
      email: userData.email,
      password: userData.password,
    });

    if (authData.user) {
      await Promise.allSettled([
        cleanupClient
          .from("crm_outbox")
          .delete()
          .eq("user_id", authData.user.id),
        cleanupClient
          .from("crm_customers")
          .delete()
          .eq("user_id", authData.user.id),
        cleanupClient
          .from("crm_campaigns")
          .delete()
          .eq("user_id", authData.user.id),
        cleanupClient
          .from("crm_sms_campaigns")
          .delete()
          .eq("user_id", authData.user.id),
        cleanupClient
          .from("crm_automations")
          .delete()
          .eq("user_id", authData.user.id),
        cleanupClient
          .from("custom_segments")
          .delete()
          .eq("user_id", authData.user.id),
        cleanupClient
          .from("company_profiles")
          .delete()
          .eq("user_id", authData.user.id),
        cleanupClient.from("users").delete().eq("id", authData.user.id),
      ]);

      await cleanupClient.auth.signOut();
    }
  }

  async seedTestData(userId: string) {
    // Create test customers
    const testCustomers = Array.from({ length: 5 }, () =>
      TestDataFactory.generateTestCustomer(),
    );

    for (const customer of testCustomers) {
      await this.supabase.from("crm_customers").insert({
        user_id: userId,
        first_name: customer.firstName,
        last_name: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        tags: customer.tags,
      });
    }

    return { customers: testCustomers };
  }
}

// Page utilities for common operations
export class PageUtils {
  constructor(private page: Page) {}

  private normalizePath(path: string) {
    const legacyPathMap: Array<[string, string]> = [
      ["/app/settings/compliance", "/settings"],
      ["/app/customers", "/crm/customers"],
      ["/app/segments", "/crm/segments"],
      ["/app/personas", "/crm/personas"],
      ["/app/forms", "/crm/forms"],
      ["/app/campaigns", "/crm/campaigns"],
      ["/app/automations", "/crm/automations"],
      ["/app/messages/tracking", "/sms"],
      ["/app/settings", "/settings"],
      ["/app", "/dashboard"],
    ];

    const matchedPath = legacyPathMap.find(
      ([legacyPath]) =>
        path === legacyPath || path.startsWith(`${legacyPath}/`),
    );

    if (!matchedPath) {
      return path;
    }

    const [legacyPrefix, currentPrefix] = matchedPath;
    return path.replace(legacyPrefix, currentPrefix);
  }

  async waitForAuthenticatedRoute() {
    await this.page.waitForFunction(
      () =>
        Object.keys(window.localStorage).some((key) =>
          key.includes("-auth-token"),
        ),
      undefined,
      { timeout: 15000 },
    );

    await this.page.waitForFunction(
      () =>
        /^\/(dashboard|onboarding|settings)(?:\/.*)?$/.test(
          window.location.pathname,
        ),
      undefined,
      { timeout: 15000 },
    );

    await this.page.waitForLoadState("domcontentloaded");
    await sleep(3000);
  }

  async login(email: string, password: string, options?: { userId?: string }) {
    await this.page.goto("/auth");
    await expect(this.page.locator("#signin-email")).toBeVisible();

    if (options?.userId) {
      await this.page.evaluate(
        (cacheKey) => window.localStorage.setItem(cacheKey, "1"),
        `${ONBOARDING_CACHE_KEY_PREFIX}${options.userId}`,
      );
    }

    await this.page.fill("#signin-email", email);
    await this.page.fill("#signin-password", password);
    await this.page.getByRole("button", { name: "Sign In" }).click();
    await this.waitForAuthenticatedRoute();
  }

  async navigateTo(path: string) {
    const normalizedPath = this.normalizePath(path);

    const waitForTargetPath = async () => {
      await this.page.waitForFunction(
        ({ targetPath }) => {
          const currentPath = window.location.pathname;
          const hasPersistedAuthToken = Object.keys(window.localStorage).some(
            (key) => key.includes("-auth-token"),
          );

          if (hasPersistedAuthToken && currentPath === "/auth") {
            return false;
          }

          return (
            currentPath === targetPath ||
            currentPath.startsWith(`${targetPath}/`)
          );
        },
        { targetPath: normalizedPath },
        { timeout: 15000 },
      );
    };

    await this.page.goto(normalizedPath);

    if (normalizedPath !== "/auth") {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await waitForTargetPath();
          break;
        } catch (error) {
          const routeState = await this.page.evaluate(() => ({
            currentPath: window.location.pathname,
            hasPersistedAuthToken: Object.keys(window.localStorage).some(
              (key) => key.includes("-auth-token"),
            ),
          }));

          const shouldRetry =
            routeState.hasPersistedAuthToken &&
            routeState.currentPath === "/auth" &&
            attempt < 2;

          if (!shouldRetry) {
            throw error;
          }

          await sleep(2000);
          await this.page.goto(normalizedPath);
        }
      }
    }

    await this.page.waitForLoadState("domcontentloaded");
  }

  async fillForm(formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      await this.page.fill(
        `[name="${field}"], [data-testid="${field}"]`,
        value,
      );
    }
  }

  async clickAndWait(
    selector: string,
    waitFor: "navigation" | "response" | "selector" = "navigation",
  ) {
    const clickPromise = this.page.click(selector);

    switch (waitFor) {
      case "navigation":
        await Promise.all([this.page.waitForNavigation(), clickPromise]);
        break;
      case "response":
        await Promise.all([
          this.page.waitForResponse("**/api/**"),
          clickPromise,
        ]);
        break;
      case "selector":
        await clickPromise;
        break;
    }
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `e2e/screenshots/${name}-${Date.now()}.png`,
      fullPage: true,
    });
  }
}
