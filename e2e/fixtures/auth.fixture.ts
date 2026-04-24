import { test as base, expect } from "@playwright/test";
import {
  TestDataFactory,
  TestDatabaseUtils,
  PageUtils,
} from "../utils/test-setup";

type AuthFixtures = {
  authenticatedUser: {
    userData: ReturnType<typeof TestDataFactory.generateTestUser>;
    userId: string;
    tenantId: string | null;
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

  authenticatedUser: [
    async ({ page, dbUtils }, use) => {
      const userData = TestDataFactory.generateTestUser();
      let createdUserId: string | null = null;

      try {
        const authData = await dbUtils.createTestUser(userData);

        if (!authData.user) {
          throw new Error("Failed to create test user");
        }

        createdUserId = authData.user.id;
        const onboardingState = await dbUtils.completeOnboarding(userData);

        const pageUtils = new PageUtils(page);
        await pageUtils.login(userData.email, userData.password, {
          userId: createdUserId,
        });

        await use({
          userData,
          userId: createdUserId,
          tenantId: onboardingState.tenantId,
        });
      } finally {
        if (createdUserId) {
          await dbUtils.cleanupTestData(userData);
        }
      }
    },
    { auto: true },
  ],
});

export { expect };
