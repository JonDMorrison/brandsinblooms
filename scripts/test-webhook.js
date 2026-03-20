#!/usr/bin/env node

/**
 * Test script for Resend webhook endpoint
 * Usage: node scripts/test-webhook.js
 */

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/email-tracking-webhook';
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || '00000000-0000-0000-0000-000000000001';
const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000002';
const DOMAIN_ID = process.env.DOMAIN_ID || '00000000-0000-0000-0000-000000000003';
const TEST_RECIPIENT = process.env.TEST_RECIPIENT || 'test@example.com';

const buildHeaders = () => ([
  { name: 'X-Campaign-ID', value: CAMPAIGN_ID },
  { name: 'X-Tenant-ID', value: TENANT_ID },
  { name: 'X-Domain-ID', value: DOMAIN_ID },
]);

const buildTags = () => ({
  campaign_id: CAMPAIGN_ID,
  tenant_id: TENANT_ID,
  domain_id: DOMAIN_ID,
  source: 'manual-webhook-test',
});

const testWebhook = async () => {
  const now = new Date();
  const providerMessageId = `test-email-${now.getTime()}`;
  const openedDeliveryId = `delivery-opened-${now.getTime()}`;

  // Test payloads simulating Resend webhook events
  const testPayloads = [
    {
      name: 'Email Delivered',
      headers: {
        'svix-id': `delivery-delivered-${now.getTime()}`,
      },
      payload: {
        type: 'email.delivered',
        created_at: now.toISOString(),
        data: {
          email_id: providerMessageId,
          to: [TEST_RECIPIENT],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: buildHeaders(),
          tags: buildTags(),
        }
      }
    },
    {
      name: 'Email Opened',
      headers: {
        'svix-id': openedDeliveryId,
      },
      payload: {
        type: 'email.opened',
        created_at: new Date(now.getTime() + 15_000).toISOString(),
        data: {
          email_id: providerMessageId,
          to: [TEST_RECIPIENT],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: buildHeaders(),
          tags: buildTags(),
          open: {
            timestamp: new Date(now.getTime() + 15_000).toISOString(),
            ipAddress: '17.58.100.12',
            userAgent: 'Apple Mail',
          }
        }
      }
    },
    {
      name: 'Email Clicked',
      headers: {
        'svix-id': `delivery-clicked-${now.getTime()}`,
      },
      payload: {
        type: 'email.clicked',
        created_at: new Date(now.getTime() + 30_000).toISOString(),
        data: {
          email_id: providerMessageId,
          to: [TEST_RECIPIENT],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: buildHeaders(),
          tags: buildTags(),
          click: {
            link: 'https://example.com/product',
            timestamp: new Date(now.getTime() + 30_000).toISOString(),
            ipAddress: '203.0.113.55',
            userAgent: 'Mozilla/5.0',
          }
        }
      }
    },
    {
      name: 'Email Opened Replay Same Delivery',
      headers: {
        'svix-id': openedDeliveryId,
      },
      payload: {
        type: 'email.opened',
        created_at: new Date(now.getTime() + 15_000).toISOString(),
        data: {
          email_id: providerMessageId,
          to: [TEST_RECIPIENT],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: buildHeaders(),
          tags: buildTags(),
          open: {
            timestamp: new Date(now.getTime() + 15_000).toISOString(),
          }
        }
      }
    },
    {
      name: 'Email Opened Second Unique Delivery',
      headers: {
        'svix-id': `delivery-opened-repeat-${now.getTime()}`,
      },
      payload: {
        type: 'email.opened',
        created_at: new Date(now.getTime() + 45_000).toISOString(),
        data: {
          email_id: providerMessageId,
          to: [TEST_RECIPIENT],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: buildHeaders(),
          tags: buildTags(),
          open: {
            timestamp: new Date(now.getTime() + 45_000).toISOString(),
          }
        }
      }
    },
    {
      name: 'Email Bounced',
      headers: {
        'svix-id': `delivery-bounced-${now.getTime()}`,
      },
      payload: {
        type: 'email.bounced',
        created_at: new Date(now.getTime() + 60_000).toISOString(),
        data: {
          email_id: providerMessageId,
          to: [TEST_RECIPIENT],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: buildHeaders(),
          tags: buildTags(),
          bounce: {
            type: 'hard_bounce',
            message: 'Recipient not found',
          },
        },
      },
    },
    {
      name: 'Email Complained',
      headers: {
        'svix-id': `delivery-complained-${now.getTime()}`,
      },
      payload: {
        type: 'email.complained',
        created_at: new Date(now.getTime() + 75_000).toISOString(),
        data: {
          email_id: providerMessageId,
          to: [TEST_RECIPIENT],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: buildHeaders(),
          tags: buildTags(),
          complaint: {
            feedback_type: 'abuse',
          },
        },
      },
    },
    {
      name: 'Email Delivery Delayed Fallback Timestamp',
      headers: {
        'svix-id': `delivery-delayed-${now.getTime()}`,
      },
      payload: {
        type: 'email.delivery_delayed',
        data: {
          email_id: providerMessageId,
          to: [TEST_RECIPIENT],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: buildHeaders(),
          tags: buildTags(),
        },
      },
    }
  ];

  console.log('🧪 Testing Resend Webhook Endpoint');
  console.log('='.repeat(50));

  for (const test of testPayloads) {
    try {
      console.log(`\n📬 Testing: ${test.name}`);
      console.log(`Campaign ID: ${CAMPAIGN_ID}`);
      console.log(`Event Type: ${test.payload.type}`);
      console.log(`Recipient: ${test.payload.data.to[0]}`);
      console.log(`Provider Message ID: ${providerMessageId}`);
      console.log(`Delivery ID: ${test.headers['svix-id']}`);

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Resend-Webhook-Test',
          ...test.headers,
        },
        body: JSON.stringify(test.payload)
      });

      const result = await response.text();

      console.log(`Status: ${response.status}`);
      console.log(`Response: ${result}`);

      if (response.ok) {
        console.log('✅ Success');
      } else {
        console.log('❌ Failed');
      }

    } catch (error) {
      console.error(`❌ Error testing ${test.name}:`, error.message);
    }
  }

  console.log('\n🎯 Test Summary:');
  console.log('- Check your database for new entries in email_tracking_events table');
  console.log('- Confirm the replayed opened event returns duplicate=true on webhook_delivery_id');
  console.log('- Confirm the second unique opened event follows the first-occurrence-only policy');
  console.log('- Verify that campaign metrics are updated in crm_campaigns table');
  console.log('- Monitor the edge function logs for any errors');
};

// Run the test
testWebhook().catch(console.error);