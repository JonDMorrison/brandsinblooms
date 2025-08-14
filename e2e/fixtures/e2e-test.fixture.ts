import { test as base, expect } from '@playwright/test';
import { E2EDataFactory } from '../factories/data-factory';
import { TestReporter } from '../utils/test-reporter';
import { ExternalServiceMocks } from '../utils/external-mocks';
import { AccessibilityTester } from '../utils/accessibility-tester';
import { PerformanceTester } from '../utils/performance-tester';

// Enhanced E2E test fixtures for comprehensive BloomSuite testing
type E2EFixtures = {
  dataFactory: E2EDataFactory;
  reporter: TestReporter;
  externalMocks: ExternalServiceMocks;
  a11yTester: AccessibilityTester;
  perfTester: PerformanceTester;
  testContext: {
    workspaceId: string;
    adminUser: {
      email: string;
      password: string;
    };
    editorUser: {
      email: string;
      password: string;
    };
    viewerUser: {
      email: string;
      password: string;
    };
  };
};

export const test = base.extend<E2EFixtures>({
  dataFactory: async ({}, use) => {
    const factory = new E2EDataFactory();
    await use(factory);
    // Cleanup after test suite
    await factory.cleanup();
  },

  reporter: async ({ page }, use) => {
    const reporter = new TestReporter(page);
    await use(reporter);
    await reporter.generateReport();
  },

  externalMocks: async ({ page }, use) => {
    const mocks = new ExternalServiceMocks(page);
    await mocks.setupMocks();
    await use(mocks);
  },

  a11yTester: async ({ page }, use) => {
    const tester = new AccessibilityTester(page);
    await use(tester);
  },

  perfTester: async ({ page }, use) => {
    const tester = new PerformanceTester(page);
    await use(tester);
  },

  testContext: async ({ dataFactory }, use) => {
    // Seed data once per test worker
    const { workspaceId } = await dataFactory.seedFullTestEnvironment();
    
    const context = {
      workspaceId,
      adminUser: {
        email: process.env.TEST_ADMIN_EMAIL!,
        password: process.env.TEST_ADMIN_PASSWORD!
      },
      editorUser: {
        email: process.env.TEST_EDITOR_EMAIL!,
        password: process.env.TEST_EDITOR_PASSWORD!
      },
      viewerUser: {
        email: process.env.TEST_VIEWER_EMAIL!,
        password: process.env.TEST_VIEWER_PASSWORD!
      }
    };

    await use(context);
  }
});

export { expect };