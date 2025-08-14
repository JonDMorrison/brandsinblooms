import { test, expect } from '../fixtures/e2e-test.fixture';

test.describe('BloomSuite Create & Post Something - Pre-Beta', () => {
  
  test('Event path: full workflow', async ({ page, testContext, a11yTester, perfTester }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    // Open Create and Post Something dialog
    await page.click('[data-testid="create-content"]');
    await expect(page.locator('[data-testid="create-content-modal"]')).toBeVisible();
    
    // Select Event path
    await page.click('[data-testid="event-option"]');
    
    // Select upcoming event
    await page.click('[data-testid="event-selector"]');
    await page.click('[data-testid="event-option"]:first-child');
    
    // Select channels: Instagram + Newsletter
    await page.click('[data-testid="channel-instagram"]');
    await page.click('[data-testid="channel-newsletter"]');
    
    // Generate content
    await page.click('[data-testid="generate-button"]');
    
    // Wait for generation
    await expect(page.locator('[data-testid="generated-items"]')).toBeVisible({ timeout: 30000 });
    
    // Should have exactly 2 items
    const items = await page.locator('[data-testid="generated-item"]').count();
    expect(items).toBe(2);
    
    // Test MediaSelector presence
    await expect(page.locator('[data-testid="media-selector"]').first()).toBeVisible();
    
    // Approve both items
    await page.click('[data-testid="approve-item"]:first-child');
    await page.click('[data-testid="approve-item"]:last-child');
    
    // Test handoff to Instagram (Publish Portal)
    await page.click('[data-testid="instagram-handoff"]');
    await expect(page.locator('[data-testid="publish-portal"]')).toBeVisible();
    
    // Go back and test newsletter handoff
    await page.goBack();
    await page.click('[data-testid="newsletter-handoff"]');
    await expect(page.locator('[data-testid="block-builder"]')).toBeVisible();
    
    // Performance check on modal
    const perfPassed = await perfTester.checkCoreWebVitals({ lcp: 3000 });
    expect(perfPassed).toBe(true);
  });

  test('Seasonal path: single channel', async ({ page, testContext }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.click('[data-testid="create-content"]');
    
    // Select Seasonal path
    await page.click('[data-testid="seasonal-option"]');
    
    // Choose holiday
    await page.click('[data-testid="holiday-selector"]');
    await page.click('[data-testid="holiday-option"]:first-child');
    
    // Select only Facebook
    await page.click('[data-testid="channel-facebook"]');
    
    // Generate content
    await page.click('[data-testid="generate-button"]');
    
    // Should have exactly 1 item
    await expect(page.locator('[data-testid="generated-items"]')).toBeVisible({ timeout: 30000 });
    const items = await page.locator('[data-testid="generated-item"]').count();
    expect(items).toBe(1);
    
    // Approve and handoff to Publish Portal
    await page.click('[data-testid="approve-item"]');
    await page.click('[data-testid="facebook-handoff"]');
    await expect(page.locator('[data-testid="publish-portal"]')).toBeVisible();
  });

  test('Custom path: multi-channel with disabled options', async ({ page, testContext }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.click('[data-testid="create-content"]');
    
    // Select Custom path
    await page.click('[data-testid="custom-option"]');
    
    // Enter custom idea
    await page.fill('[data-testid="custom-idea"]', 'Best practices for winter plant protection');
    
    // Select Video + Blog
    await page.click('[data-testid="channel-video"]');
    await page.click('[data-testid="channel-blog"]');
    
    // Generate content
    await page.click('[data-testid="generate-button"]');
    
    // Should have 2 items
    await expect(page.locator('[data-testid="generated-items"]')).toBeVisible({ timeout: 30000 });
    const items = await page.locator('[data-testid="generated-item"]').count();
    expect(items).toBe(2);
    
    // Test editing functionality
    await page.click('[data-testid="edit-item"]:first-child');
    await page.fill('[data-testid="content-editor"]', 'Edited content for winter protection');
    await page.click('[data-testid="save-edit"]');
    
    // Approve items
    await page.click('[data-testid="approve-item"]:first-child');
    await page.click('[data-testid="approve-item"]:last-child');
    
    // Test blog handoff (should be disabled)
    const blogButton = page.locator('[data-testid="blog-handoff"]');
    await expect(blogButton).toBeVisible();
    await expect(blogButton).toBeDisabled();
    
    // Should show "Coming Soon" tooltip
    await blogButton.hover();
    await expect(page.locator('text=Send to Website – Coming Soon')).toBeVisible();
  });

  test('MediaSelector functionality', async ({ page, testContext }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    await page.click('[data-testid="create-content"]');
    await page.click('[data-testid="event-option"]');
    
    // Select event and channel
    await page.click('[data-testid="event-selector"]');
    await page.click('[data-testid="event-option"]:first-child');
    await page.click('[data-testid="channel-instagram"]');
    
    await page.click('[data-testid="generate-button"]');
    await expect(page.locator('[data-testid="generated-items"]')).toBeVisible({ timeout: 30000 });
    
    // Test MediaSelector
    const mediaSelector = page.locator('[data-testid="media-selector"]').first();
    await expect(mediaSelector).toBeVisible();
    
    // Click to open media options
    await mediaSelector.click();
    await expect(page.locator('[data-testid="media-options"]')).toBeVisible();
    
    // Test image replacement
    const firstOption = page.locator('[data-testid="media-option"]').first();
    await firstOption.click();
    
    // Image should change
    await page.waitForTimeout(1000);
    
    // Changes should persist to bundle
    const newImageSrc = await page.locator('[data-testid="content-image"]').first().getAttribute('src');
    expect(newImageSrc).toBeTruthy();
  });

  test('Accessibility compliance', async ({ page, testContext, a11yTester }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', testContext.adminUser.email);
    await page.fill('input[type="password"]', testContext.adminUser.password);
    await page.click('button[type="submit"]');
    
    // Test modal accessibility
    await page.click('[data-testid="create-content"]');
    
    // Accessibility scan
    const a11yResult = await a11yTester.scanPage();
    await a11yTester.failOnCriticalViolations(a11yResult);
    
    // Test keyboard navigation
    const keyboardWorking = await a11yTester.checkKeyboardNavigation();
    expect(keyboardWorking).toBe(true);
    
    // Test focus management
    const focusWorking = await a11yTester.checkFocusManagement();
    expect(focusWorking).toBe(true);
    
    // Test escape key closes modal
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="create-content-modal"]')).not.toBeVisible();
  });
});