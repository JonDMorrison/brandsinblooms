import { test, expect } from '../fixtures/auth.fixture';
import { TestDataFactory } from '../utils/test-setup';

test.describe('SMS Campaigns', () => {
  test('should create and send SMS campaign', async ({ page, authenticatedUser, pageUtils, dbUtils }) => {
    // Seed test customers
    await dbUtils.seedTestData(authenticatedUser.userId);
    
    const campaignData = TestDataFactory.generateTestCampaign();
    
    // Navigate to campaigns
    await pageUtils.navigateTo('/app/campaigns');
    
    // Create new campaign
    await page.click('[data-testid="create-campaign-button"]');
    
    // Fill campaign details
    await page.fill('[name="campaignName"]', campaignData.name);
    await page.fill('[name="message"]', campaignData.message);
    
    // Select recipients (all customers)
    await page.click('[data-testid="select-all-customers"]');
    
    // Verify recipient count
    await expect(page.locator('[data-testid="recipient-count"]')).toContainText('5');
    
    // Schedule for immediate sending
    await page.selectOption('[name="sendTiming"]', 'immediate');
    
    // Submit campaign
    await page.click('[data-testid="send-campaign-button"]');
    
    // Should show confirmation
    await expect(page.locator('text=Campaign sent successfully')).toBeVisible();
    
    // Verify campaign appears in sent campaigns
    await pageUtils.navigateTo('/app/campaigns/sent');
    await expect(page.locator('text=' + campaignData.name)).toBeVisible();
  });

  test('should schedule SMS campaign for future delivery', async ({ page, authenticatedUser, pageUtils, dbUtils }) => {
    await dbUtils.seedTestData(authenticatedUser.userId);
    
    const campaignData = TestDataFactory.generateTestCampaign();
    
    await pageUtils.navigateTo('/app/campaigns');
    await page.click('[data-testid="create-campaign-button"]');
    
    // Fill basic details
    await page.fill('[name="campaignName"]', campaignData.name);
    await page.fill('[name="message"]', campaignData.message);
    
    // Select recipients
    await page.click('[data-testid="select-all-customers"]');
    
    // Schedule for future
    await page.selectOption('[name="sendTiming"]', 'scheduled');
    
    // Set future date/time (1 hour from now)
    const futureDate = new Date(Date.now() + 3600000);
    await page.fill('[name="scheduledDate"]', futureDate.toISOString().split('T')[0]);
    await page.fill('[name="scheduledTime"]', futureDate.toTimeString().slice(0, 5));
    
    await page.click('[data-testid="schedule-campaign-button"]');
    
    // Should show scheduling confirmation
    await expect(page.locator('text=Campaign scheduled successfully')).toBeVisible();
    
    // Verify in scheduled campaigns
    await pageUtils.navigateTo('/app/campaigns/scheduled');
    await expect(page.locator('text=' + campaignData.name)).toBeVisible();
  });

  test('should handle message templates and personalization', async ({ page, authenticatedUser, pageUtils, dbUtils }) => {
    await dbUtils.seedTestData(authenticatedUser.userId);
    
    await pageUtils.navigateTo('/app/campaigns');
    await page.click('[data-testid="create-campaign-button"]');
    
    // Use template
    await page.click('[data-testid="use-template-button"]');
    await page.click('[data-testid="template-welcome"]');
    
    // Verify template content loaded
    await expect(page.locator('[name="message"]')).toContainText('Welcome');
    
    // Add personalization
    await page.click('[data-testid="add-personalization"]');
    await page.selectOption('[name="personalizeField"]', 'firstName');
    
    // Verify merge tag added
    await expect(page.locator('[name="message"]')).toContainText('{{firstName}}');
    
    // Preview personalization
    await page.click('[data-testid="preview-message"]');
    await expect(page.locator('[data-testid="message-preview"]')).toContainText('John'); // From seeded data
  });

  test('should respect quiet hours and compliance settings', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/app/settings/compliance');
    
    // Set quiet hours
    await page.fill('[name="quietHoursStart"]', '22:00');
    await page.fill('[name="quietHoursEnd"]', '08:00');
    await page.click('[data-testid="save-compliance"]');
    
    // Try to send campaign during quiet hours
    await pageUtils.navigateTo('/app/campaigns');
    await page.click('[data-testid="create-campaign-button"]');
    
    // Set time to during quiet hours (simulate)
    const quietTime = new Date();
    quietTime.setHours(23, 0, 0, 0); // 11 PM
    
    await page.fill('[name="scheduledTime"]', '23:00');
    
    // Should show warning
    await expect(page.locator('text=This message will be sent during quiet hours')).toBeVisible();
    
    // Should offer to reschedule
    await page.click('[data-testid="reschedule-button"]');
    
    // Should suggest next available time (8 AM next day)
    await expect(page.locator('[name="scheduledTime"]')).toHaveValue('08:00');
  });

  test('should track message delivery and responses', async ({ page, authenticatedUser, pageUtils, dbUtils }) => {
    await dbUtils.seedTestData(authenticatedUser.userId);
    
    // Send a campaign first
    await pageUtils.navigateTo('/app/campaigns');
    await page.click('[data-testid="create-campaign-button"]');
    
    const campaignData = TestDataFactory.generateTestCampaign();
    await page.fill('[name="campaignName"]', campaignData.name);
    await page.fill('[name="message"]', campaignData.message);
    await page.click('[data-testid="select-all-customers"]');
    await page.click('[data-testid="send-campaign-button"]');
    
    // Wait for campaign to be sent
    await expect(page.locator('text=Campaign sent successfully')).toBeVisible();
    
    // Navigate to campaign analytics
    await pageUtils.navigateTo('/app/campaigns/analytics');
    
    // Find and click on sent campaign
    await page.click(`text=${campaignData.name}`);
    
    // Should show delivery metrics
    await expect(page.locator('[data-testid="delivery-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="sent-count"]')).toContainText('5');
    
    // Should show individual message statuses
    await expect(page.locator('[data-testid="message-status-list"]')).toBeVisible();
  });

  test('should handle opt-out requests', async ({ page, authenticatedUser, pageUtils, dbUtils }) => {
    await dbUtils.seedTestData(authenticatedUser.userId);
    
    // Navigate to customers and mark one as opted out
    await pageUtils.navigateTo('/app/customers');
    
    // Click on first customer
    await page.click('[data-testid="customer-row"]:first-child');
    
    // Mark as opted out
    await page.click('[data-testid="opt-out-button"]');
    await page.fill('[name="optOutReason"]', 'Customer request');
    await page.click('[data-testid="confirm-opt-out"]');
    
    // Verify opt-out status
    await expect(page.locator('text=Opted Out')).toBeVisible();
    
    // Try to create campaign - opted out customer should be excluded
    await pageUtils.navigateTo('/app/campaigns');
    await page.click('[data-testid="create-campaign-button"]');
    
    await page.click('[data-testid="select-all-customers"]');
    
    // Should show 4 recipients (5 - 1 opted out)
    await expect(page.locator('[data-testid="recipient-count"]')).toContainText('4');
    
    // Should show opt-out warning
    await expect(page.locator('text=1 customer excluded due to opt-out')).toBeVisible();
  });
});