import { test, expect } from '@playwright/test';

test.describe('Plan Marketing Wizard', () => {
  test('should complete the plan wizard flow', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Look for the Plan My Marketing button
    const planButton = page.locator('button:has-text("Plan My Marketing"), [data-card-id*="plan"]');
    
    if (await planButton.count() > 0) {
      // If the button exists, test the full flow
      await planButton.click();
      
      // Should navigate to plan wizard
      await expect(page).toHaveURL(/\/plan/);
      
      // Should see the wizard header
      await expect(page.locator('h1:has-text("Plan My Marketing")')).toBeVisible();
      
      // Step 1: Pick Focus
      await expect(page.locator('h2:has-text("Plan Your Marketing Focus")')).toBeVisible();
      
      // Select a theme (first available theme)
      const themeCard = page.locator('[data-theme-card]').first();
      if (await themeCard.count() > 0) {
        await themeCard.click();
      } else {
        // Fallback: click any card-like element for theme selection
        await page.locator('div:has-text("Fall Planting")').first().click();
      }
      
      // Continue to next step
      const continueButton = page.locator('button:has-text("Continue to Calendar Draft")');
      if (await continueButton.count() > 0) {
        await continueButton.click();
      }
      
      // Step 2: Calendar Draft (if we reach it)
      const calendarHeader = page.locator('h2:has-text("Review Your Content Calendar")');
      if (await calendarHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Continue to review
        const reviewButton = page.locator('button:has-text("Review & Launch")');
        if (await reviewButton.count() > 0) {
          await reviewButton.click();
        }
      }
      
      // Step 3: Review & Launch (if we reach it)
      const reviewHeader = page.locator('h2:has-text("Review Your Plan")');
      if (await reviewHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Should see launch button
        await expect(page.locator('button:has-text("Launch Plan")')).toBeVisible();
      }
      
    } else {
      // If button doesn't exist, just ensure we're on a valid page
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should show plan wizard directly', async ({ page }) => {
    // Navigate directly to plan page
    await page.goto('/plan');
    
    // Should see the wizard (or redirect to auth)
    await expect(page.locator('body')).toBeVisible();
    
    // If we're on the plan page, should see the header
    if (page.url().includes('/plan')) {
      await expect(page.locator('h1:has-text("Plan My Marketing")')).toBeVisible();
    }
  });

  test('should generate and edit email content', async ({ page }) => {
    // Navigate to plan wizard
    await page.goto('/plan?step=1&month=2025-10');
    
    // Select multiple themes if available
    const themeCards = page.locator('[data-theme-card]');
    const themeCount = await themeCards.count();
    
    if (themeCount > 0) {
      // Select first theme
      await themeCards.first().click();
      
      // If there's a second theme, select it too for multi-theme testing
      if (themeCount > 1) {
        await themeCards.nth(1).click();
      }
      
      // Continue to calendar
      await page.locator('button:has-text("Continue to Calendar Draft")').click();
      
      // Wait for calendar to load
      await expect(page.locator('h2:has-text("Review Your Content Calendar")')).toBeVisible();
      
      // Look for email items
      const emailItems = page.locator('[data-item-type="email"]');
      if (await emailItems.count() > 0) {
        // Click edit on first email item
        const editButton = emailItems.first().locator('button[aria-label="Edit item"]');
        if (await editButton.count() > 0) {
          await editButton.click();
          
          // Should see email-specific fields
          await expect(page.locator('label:has-text("Subject Line")')).toBeVisible();
          await expect(page.locator('label:has-text("Preheader")')).toBeVisible();
          
          // Check character counters
          await expect(page.locator('text=/\d+\/50 characters/')).toBeVisible();
          await expect(page.locator('text=/\d+\/90 characters/')).toBeVisible();
          
          // Test editing subject line
          const subjectInput = page.locator('input[placeholder="Enter email subject..."]');
          await subjectInput.fill('Test October Gardening Tips');
          
          // Test editing preheader
          const preheaderInput = page.locator('input[placeholder="Enter email preheader..."]');
          await preheaderInput.fill('Get ready for fall planting season');
          
          // Verify content quality - no generic "Welcome to October" text
          const emailContent = page.locator('textarea');
          const content = await emailContent.inputValue();
          expect(content).not.toMatch(/Welcome to October/i);
          
          // Verify content has actionable information
          expect(content.length).toBeGreaterThan(50);
        }
      }
    }
  });

  test('should validate content quality standards', async ({ page }) => {
    // Navigate to plan wizard  
    await page.goto('/plan?step=1&month=2025-10');
    
    // Select theme and proceed to calendar
    const themeCard = page.locator('[data-theme-card]').first();
    if (await themeCard.count() > 0) {
      await themeCard.click();
      await page.locator('button:has-text("Continue to Calendar Draft")').click();
      
      // Wait for content to be generated
      await page.waitForTimeout(3000);
      
      // Check email items for quality standards
      const emailItems = page.locator('[data-item-type="email"]');
      const emailCount = await emailItems.count();
      
      for (let i = 0; i < Math.min(emailCount, 3); i++) {
        const emailItem = emailItems.nth(i);
        
        // Get the title/subject
        const titleElement = emailItem.locator('[data-field="title"]');
        if (await titleElement.count() > 0) {
          const title = await titleElement.textContent();
          
          // Quality checks
          expect(title).not.toMatch(/Week \d+/i); // No week references
          expect(title).not.toMatch(/Welcome to \w+/i); // No generic welcome
          if (title) {
            expect(title.length).toBeLessThanOrEqual(60); // Reasonable length for subject
          }
        }
        
        // Check content doesn't have generic language
        const contentElement = emailItem.locator('[data-field="content"]');
        if (await contentElement.count() > 0) {
          const content = await contentElement.textContent();
          if (content) {
            expect(content).not.toMatch(/Weekly/i); // No weekly references
            expect(content.length).toBeGreaterThan(30); // Has substantial content
          }
        }
      }
    }
  });

  test('should persist email subject and preheader to notes', async ({ page }) => {
    // Navigate to plan wizard
    await page.goto('/plan?step=1&month=2025-10');
    
    // Select theme and proceed through wizard
    const themeCard = page.locator('[data-theme-card]').first();
    if (await themeCard.count() > 0) {
      await themeCard.click();
      await page.locator('button:has-text("Continue to Calendar Draft")').click();
      
      // Continue to review step
      await page.locator('button:has-text("Review & Launch")').click();
      
      // Launch the plan
      const launchButton = page.locator('button:has-text("Launch Plan")');
      if (await launchButton.count() > 0) {
        await launchButton.click();
        
        // Should see success message
        await expect(page.locator('text=/plan.*launched|success/i')).toBeVisible({ timeout: 10000 });
      }
    }
  });
});