import { test, expect } from '../fixtures/auth.fixture';
import { TestDataFactory, TEST_CONFIG } from '../utils/test-setup';

test.describe('Twilio SMS Integration', () => {
  test('should send real SMS to test numbers', async ({ page, authenticatedUser, pageUtils }) => {
    // Navigate to SMS testing page
    await pageUtils.navigateTo('/demo');
    
    // Test individual SMS
    await page.fill('[data-testid="sms-phone"]', TEST_CONFIG.testPhoneNumbers[0]);
    await page.fill('[data-testid="sms-message"]', 'E2E Test Message - ' + new Date().toISOString());
    
    // Send SMS
    await page.click('[data-testid="send-sms-button"]');
    
    // Wait for response
    await expect(page.locator('[data-testid="sms-result"]')).toBeVisible({ timeout: 10000 });
    
    // Verify success response
    await expect(page.locator('[data-testid="sms-result"]')).toContainText('sent successfully');
    
    // Verify SMS ID is returned
    await expect(page.locator('[data-testid="message-sid"]')).toBeVisible();
  });

  test('should handle SMS delivery status updates', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/demo');
    
    // Send SMS and get message ID
    await page.fill('[data-testid="sms-phone"]', TEST_CONFIG.testPhoneNumbers[0]);
    await page.fill('[data-testid="sms-message"]', 'Delivery Status Test');
    
    await page.click('[data-testid="send-sms-button"]');
    
    await expect(page.locator('[data-testid="sms-result"]')).toBeVisible();
    
    // Extract message SID for tracking
    const messageSid = await page.locator('[data-testid="message-sid"]').textContent();
    
    // Navigate to message tracking
    await pageUtils.navigateTo('/app/messages/tracking');
    
    // Search for the message
    await page.fill('[data-testid="search-message"]', messageSid || '');
    await page.click('[data-testid="search-button"]');
    
    // Should show message details
    await expect(page.locator('[data-testid="message-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="delivery-status"]')).toContainText(/sent|delivered|queued/);
  });

  test('should handle MMS with media attachments', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/demo');
    
    // Switch to MMS test
    await page.click('[data-testid="mms-tab"]');
    
    // Fill MMS details
    await page.fill('[data-testid="mms-phone"]', TEST_CONFIG.testPhoneNumbers[0]);
    await page.fill('[data-testid="mms-message"]', 'E2E MMS Test with image');
    
    // Add test image URL
    await page.fill('[data-testid="media-url"]', 'https://via.placeholder.com/300x200.png?text=E2E+Test');
    
    // Send MMS
    await page.click('[data-testid="send-mms-button"]');
    
    // Verify MMS sent
    await expect(page.locator('[data-testid="mms-result"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="mms-result"]')).toContainText('sent successfully');
  });

  test('should handle carrier detection and fallback', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/demo');
    
    // Test with VoIP number (should detect and suggest fallback)
    await page.fill('[data-testid="sms-phone"]', '+15551234567'); // Common VoIP pattern
    await page.fill('[data-testid="sms-message"]', 'VoIP Test Message');
    
    // Should show carrier detection warning
    await expect(page.locator('[data-testid="carrier-warning"]')).toContainText('VoIP carrier detected');
    await expect(page.locator('[data-testid="fallback-suggestion"]')).toBeVisible();
    
    // Test with international number
    await page.fill('[data-testid="sms-phone"]', '+441234567890'); // UK number
    
    // Should show international carrier info
    await expect(page.locator('[data-testid="carrier-info"]')).toContainText('International');
  });

  test('should handle SMS errors gracefully', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/demo');
    
    // Test with invalid phone number
    await page.fill('[data-testid="sms-phone"]', 'invalid-phone');
    await page.fill('[data-testid="sms-message"]', 'Test message');
    
    await page.click('[data-testid="send-sms-button"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid phone number');
    
    // Test with empty message
    await page.fill('[data-testid="sms-phone"]', TEST_CONFIG.testPhoneNumbers[0]);
    await page.fill('[data-testid="sms-message"]', '');
    
    await page.click('[data-testid="send-sms-button"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Message cannot be empty');
  });

  test('should test webhook processing', async ({ page, authenticatedUser, pageUtils }) => {
    await pageUtils.navigateTo('/demo');
    
    // Send SMS first
    await page.fill('[data-testid="sms-phone"]', TEST_CONFIG.testPhoneNumbers[0]);
    await page.fill('[data-testid="sms-message"]', 'Webhook Test Message');
    
    await page.click('[data-testid="send-sms-button"]');
    
    const messageSid = await page.locator('[data-testid="message-sid"]').textContent();
    
    // Simulate webhook (in real implementation, this would be triggered by Twilio)
    await page.click('[data-testid="simulate-webhook"]');
    await page.fill('[data-testid="webhook-message-sid"]', messageSid || '');
    await page.selectOption('[data-testid="webhook-status"]', 'delivered');
    
    await page.click('[data-testid="send-webhook"]');
    
    // Verify webhook was processed
    await expect(page.locator('[data-testid="webhook-result"]')).toContainText('Webhook processed');
    
    // Check that message status was updated
    await pageUtils.navigateTo('/app/messages/tracking');
    await page.fill('[data-testid="search-message"]', messageSid || '');
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="delivery-status"]')).toContainText('delivered');
  });

  test('should handle bulk SMS sending', async ({ page, authenticatedUser, pageUtils, dbUtils }) => {
    // Seed customers for bulk test
    await dbUtils.seedTestData(authenticatedUser.userId);
    
    await pageUtils.navigateTo('/app/campaigns');
    
    // Create bulk SMS campaign
    await page.click('[data-testid="create-campaign-button"]');
    
    await page.fill('[name="campaignName"]', 'E2E Bulk Test');
    await page.fill('[name="message"]', 'Bulk SMS test from E2E - ' + new Date().toISOString());
    
    // Select all customers
    await page.click('[data-testid="select-all-customers"]');
    
    // Send immediately
    await page.click('[data-testid="send-campaign-button"]');
    
    // Should show sending progress
    await expect(page.locator('[data-testid="sending-progress"]')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('text=Campaign sent successfully')).toBeVisible({ timeout: 30000 });
    
    // Check campaign results
    await pageUtils.navigateTo('/app/campaigns/sent');
    await page.click('text=E2E Bulk Test');
    
    // Should show delivery statistics
    await expect(page.locator('[data-testid="sent-count"]')).toContainText('5');
    await expect(page.locator('[data-testid="delivery-stats"]')).toBeVisible();
  });
});