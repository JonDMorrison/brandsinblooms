#!/usr/bin/env node

/**
 * Test script for Resend webhook endpoint
 * Usage: node scripts/test-webhook.js
 */

const testWebhook = async () => {
  const WEBHOOK_URL = 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/email-tracking-webhook';
  
  // Test payloads simulating Resend webhook events
  const testPayloads = [
    {
      name: 'Email Delivered',
      payload: {
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: {
          email_id: 'test-email-123',
          to: ['test@example.com'],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: {
            'X-Campaign-ID': 'test-campaign-uuid-123'
          },
          tags: ['campaign:test-campaign-uuid-123', 'type:bulk']
        }
      }
    },
    {
      name: 'Email Opened',
      payload: {
        type: 'email.opened',
        created_at: new Date().toISOString(),
        data: {
          email_id: 'test-email-123',
          to: ['test@example.com'],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: {
            'X-Campaign-ID': 'test-campaign-uuid-123'
          },
          tags: ['campaign:test-campaign-uuid-123', 'type:bulk'],
          open: {
            timestamp: new Date().toISOString()
          }
        }
      }
    },
    {
      name: 'Email Clicked',
      payload: {
        type: 'email.clicked',
        created_at: new Date().toISOString(),
        data: {
          email_id: 'test-email-123',
          to: ['test@example.com'],
          from: 'noreply@bloomsuite.email',
          subject: 'Test Campaign Email',
          headers: {
            'X-Campaign-ID': 'test-campaign-uuid-123'
          },
          tags: ['campaign:test-campaign-uuid-123', 'type:bulk'],
          click: {
            link: 'https://example.com/product',
            timestamp: new Date().toISOString()
          }
        }
      }
    }
  ];

  console.log('🧪 Testing Resend Webhook Endpoint');
  console.log('=' .repeat(50));

  for (const test of testPayloads) {
    try {
      console.log(`\n📬 Testing: ${test.name}`);
      console.log(`Campaign ID: ${test.payload.data.headers['X-Campaign-ID']}`);
      console.log(`Event Type: ${test.payload.type}`);
      console.log(`Recipient: ${test.payload.data.to[0]}`);

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Resend-Webhook-Test'
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
  console.log('- Verify that campaign metrics are updated in crm_campaigns table');
  console.log('- Monitor the edge function logs for any errors');
};

// Run the test
testWebhook().catch(console.error);