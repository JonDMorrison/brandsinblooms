import { test as base, expect } from '@playwright/test';
import { TestDataFactory, TestDatabaseUtils, PageUtils } from '../utils/test-setup';

type AuthFixtures = {
  authenticatedUser: {
    userData: ReturnType<typeof TestDataFactory.generateTestUser>;
    userId: string;
  };
  pageUtils: PageUtils;
  dbUtils: TestDatabaseUtils;
};

export const test = base.extend<AuthFixtures>({
  dbUtils: async ({}, use) => {
    const dbUtils = new TestDatabaseUtils();
    await use(dbUtils);
  },

  pageUtils: async ({ page }, use) => {
    const pageUtils = new PageUtils(page);
    await use(pageUtils);
  },

  authenticatedUser: async ({ page, dbUtils }, use) => {
    const userData = TestDataFactory.generateTestUser();
    
    // Create test user
    const authData = await dbUtils.createTestUser(userData);
    
    if (!authData.user) {
      throw new Error('Failed to create test user');
    }

    // Login to the application
    const pageUtils = new PageUtils(page);
    await pageUtils.login(userData.email, userData.password);

    // Complete basic onboarding
    await page.goto('/app');
    
    // Check if onboarding is needed and complete it
    const onboardingExists = await page.locator('[data-testid="onboarding-form"]').isVisible().catch(() => false);
    
    if (onboardingExists) {
      await page.fill('[name="companyName"]', userData.companyName);
      await page.fill('[name="companyOverview"]', 'Test company for E2E testing');
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
    }

    await use({
      userData,
      userId: authData.user.id,
    });

    // Cleanup after test
    await dbUtils.cleanupTestData(userData.email);
  },
});

export { expect };