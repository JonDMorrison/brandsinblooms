import { Page } from '@playwright/test';

export class ExternalServiceMocks {
  constructor(private page: Page) {}

  async setupMocks() {
    // Mock Twilio SMS/MMS API
    await this.mockTwilioAPI();
    
    // Mock Resend Email API
    await this.mockResendAPI();
    
    // Mock POS webhook handlers
    await this.mockPOSWebhooks();
    
    // Mock link shortener
    await this.mockLinkShortener();
    
    console.log('🎭 External service mocks configured');
  }

  private async mockTwilioAPI() {
    await this.page.route('**/api.twilio.com/**', async route => {
      const url = route.request().url();
      const method = route.request().method();
      
      if (method === 'POST' && url.includes('/Messages')) {
        // Mock SMS/MMS send
        const body = route.request().postData();
        const isQuietHours = this.isQuietHours();
        
        if (isQuietHours) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 21610,
              message: 'Cannot send SMS during quiet hours'
            })
          });
          return;
        }

        const mockResponse = {
          sid: `SM${this.generateMockId()}`,
          status: 'queued',
          from: process.env.TWILIO_TEST_PHONE,
          to: this.extractPhoneFromBody(body),
          body: this.extractMessageFromBody(body),
          date_created: new Date().toISOString(),
          date_sent: null,
          price: null,
          price_unit: 'USD'
        };

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        });

        // Simulate webhook callback after a delay
        setTimeout(() => this.simulateDeliveryWebhook(mockResponse.sid), 2000);
        
      } else if (method === 'GET' && url.includes('/Messages/')) {
        // Mock message status check
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sid: this.extractSidFromUrl(url),
            status: 'delivered',
            date_sent: new Date().toISOString()
          })
        });
      }
    });
  }

  private async mockResendAPI() {
    await this.page.route('**/api.resend.com/**', async route => {
      const url = route.request().url();
      const method = route.request().method();
      
      if (method === 'POST' && url.includes('/emails')) {
        const body = JSON.parse(route.request().postData() || '{}');
        
        // Validate verified sender
        const fromEmail = body.from;
        const verifiedSenders = [
          'noreply@bloomsuite-test.com',
          process.env.RESEND_FROM_ADDRESS
        ];
        
        if (!verifiedSenders.some(sender => fromEmail?.includes(sender))) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              name: 'validation_error',
              message: 'From email not verified'
            })
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: `email_${this.generateMockId()}`,
            from: body.from,
            to: body.to,
            subject: body.subject,
            created_at: new Date().toISOString()
          })
        });
      }
    });
  }

  private async mockPOSWebhooks() {
    // Mock Shopify webhook
    await this.page.route('**/functions/v1/shopify-sync', async route => {
      const webhook = this.generateShopifyWebhook();
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          processed: {
            customers: webhook.customers_count,
            orders: webhook.orders_count
          }
        })
      });
    });

    // Mock Square webhook
    await this.page.route('**/functions/v1/square-sync', async route => {
      const webhook = this.generateSquareWebhook();
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          processed: {
            customers: webhook.customers_count,
            orders: webhook.orders_count
          }
        })
      });
    });
  }

  private async mockLinkShortener() {
    await this.page.route('**/functions/v1/link-redirect/**', async route => {
      const url = route.request().url();
      const linkId = this.extractLinkIdFromUrl(url);
      
      // Log click to integration_logs
      const logEntry = {
        link_id: linkId,
        clicked_at: new Date().toISOString(),
        user_agent: route.request().headers()['user-agent'],
        ip_address: '127.0.0.1'
      };

      await route.fulfill({
        status: 302,
        headers: {
          'Location': 'https://bloomsuite-test.com/landing'
        }
      });

      console.log('🔗 Mock link click logged:', logEntry);
    });
  }

  private isQuietHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const quietStart = 22; // 10 PM
    const quietEnd = 8;    // 8 AM
    
    return hour >= quietStart || hour < quietEnd;
  }

  private generateMockId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private extractPhoneFromBody(body: string | null): string {
    if (!body) return '+15551234567';
    const match = body.match(/To=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '+15551234567';
  }

  private extractMessageFromBody(body: string | null): string {
    if (!body) return 'Test message';
    const match = body.match(/Body=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : 'Test message';
  }

  private extractSidFromUrl(url: string): string {
    const match = url.match(/Messages\/([^\/]+)/);
    return match ? match[1] : 'SM' + this.generateMockId();
  }

  private extractLinkIdFromUrl(url: string): string {
    const match = url.match(/link-redirect\/([^\/\?]+)/);
    return match ? match[1] : 'link_' + this.generateMockId();
  }

  private generateShopifyWebhook() {
    return {
      customers_count: Math.floor(Math.random() * 10) + 1,
      orders_count: Math.floor(Math.random() * 20) + 5,
      webhook_data: {
        shop_domain: 'test-shop.myshopify.com',
        webhook_id: 'shopify_' + this.generateMockId(),
        created_at: new Date().toISOString()
      }
    };
  }

  private generateSquareWebhook() {
    return {
      customers_count: Math.floor(Math.random() * 8) + 1,
      orders_count: Math.floor(Math.random() * 15) + 3,
      webhook_data: {
        location_id: 'square_location_' + this.generateMockId(),
        webhook_id: 'square_' + this.generateMockId(),
        created_at: new Date().toISOString()
      }
    };
  }

  private async simulateDeliveryWebhook(messageSid: string) {
    // Simulate Twilio delivery webhook
    const webhookData = {
      MessageSid: messageSid,
      MessageStatus: 'delivered',
      From: process.env.TWILIO_TEST_PHONE,
      To: '+15551234567',
      EventType: 'message-status-update'
    };

    try {
      await fetch('/api/webhooks/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(webhookData).toString()
      });
    } catch (error) {
      console.log('Mock webhook simulation (would normally POST to /api/webhooks/twilio)');
    }
  }

  async simulateSTOPResponse(phoneNumber: string) {
    const stopWebhook = {
      MessageSid: 'SM' + this.generateMockId(),
      From: phoneNumber,
      To: process.env.TWILIO_TEST_PHONE,
      Body: 'STOP',
      EventType: 'message-received'
    };

    console.log('📱 Simulating STOP response from:', phoneNumber);
    return stopWebhook;
  }

  async simulateHELPResponse(phoneNumber: string) {
    const helpWebhook = {
      MessageSid: 'SM' + this.generateMockId(),
      From: phoneNumber,
      To: process.env.TWILIO_TEST_PHONE,
      Body: 'HELP',
      EventType: 'message-received'
    };

    console.log('📱 Simulating HELP response from:', phoneNumber);
    return helpWebhook;
  }
}