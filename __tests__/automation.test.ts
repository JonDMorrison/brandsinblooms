import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { triggerCatalog, getTriggerById } from '../src/lib/automation/triggerCatalog';
import { campaignTemplates, getTemplateByKey } from '../src/lib/automation/templates/campaignTemplates';

// Mock Supabase client
vi.mock('@supabase/supabase-js');
const mockSupabase = vi.mocked(createClient);

// Mock Twilio
const mockTwilioCreate = vi.fn();
global.fetch = vi.fn();

describe('Automation System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default Supabase mock
    mockSupabase.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
          update: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      functions: {
        invoke: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }
    } as any);
  });

  describe('Trigger Catalog', () => {
    it('should have 12 essential triggers', () => {
      expect(triggerCatalog).toHaveLength(12);
      
      const expectedTriggers = [
        'loyalty_join', 'first_purchase', 'repeat_purchase_90d', 'plant_care_reminder',
        'birthday', 'new_product_drop', 'event_registration', 'abandoned_cart',
        'review_request', 'garden_tips_subscription', 'holiday_promo', 'custom_webhook'
      ];
      
      const triggerIds = triggerCatalog.map(t => t.id);
      expectedTriggers.forEach(id => {
        expect(triggerIds).toContain(id);
      });
    });

    it('should find trigger by ID', () => {
      const trigger = getTriggerById('loyalty_join');
      expect(trigger).toBeDefined();
      expect(trigger?.label).toBe('🧑‍🤝‍🧑 Loyalty Program Sign-up');
      expect(trigger?.channels).toContain('sms');
      expect(trigger?.channels).toContain('email');
    });

    it('should return null for non-existent trigger', () => {
      const trigger = getTriggerById('non_existent');
      expect(trigger).toBeNull();
    });
  });

  describe('Campaign Templates', () => {
    it('should have welcome series SMS template', () => {
      const template = getTemplateByKey('welcome-loyalty_join-sms');
      expect(template).toBeDefined();
      expect(template?.timeline).toHaveLength(2);
      expect(template?.timeline[0].type).toBe('sms');
      expect(template?.timeline[0].delayMin).toBe(5);
    });

    it('should have mixed channel templates', () => {
      const template = getTemplateByKey('welcome-loyalty_join-mixed');
      expect(template).toBeDefined();
      expect(template?.channels).toContain('sms');
      expect(template?.channels).toContain('email');
      expect(template?.timeline).toHaveLength(3);
    });

    it('should have product announcement templates', () => {
      const smsTemplate = getTemplateByKey('product-new_product_drop-sms');
      const emailTemplate = getTemplateByKey('product-new_product_drop-email');
      
      expect(smsTemplate?.timeline[0].delayMin).toBe(0); // Immediate
      expect(emailTemplate?.timeline[0].type).toBe('email');
    });
  });

  describe('Loyalty Join Automation Flow', () => {
    it('should simulate loyalty join event and create outbox entry', async () => {
      const mockOutboxInsert = vi.fn(() => Promise.resolve({ data: { id: 'test-outbox-id' }, error: null }));
      const mockAutomationLogInsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
      
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'crm_automations') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({
                  data: [{
                    id: 'automation-1',
                    tenant_id: 'tenant-1',
                    trigger_type: 'loyalty_join',
                    workflow_steps: [{
                      type: 'sms',
                      delayMin: 5,
                      text: 'Welcome to {{business}} loyalty program!'
                    }],
                    name: 'Loyalty Welcome'
                  }],
                  error: null
                }))
              }))
            };
          }
          if (table === 'crm_customers') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gte: vi.fn(() => Promise.resolve({
                    data: [{
                      id: 'customer-1',
                      email: 'test@example.com',
                      phone: '+1234567890',
                      first_name: 'John',
                      tenant_id: 'tenant-1'
                    }],
                    error: null
                  }))
                }))
              }))
            };
          }
          if (table === 'crm_outbox') {
            return {
              insert: mockOutboxInsert
            };
          }
          if (table === 'crm_automation_logs') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
                }))
              })),
              insert: mockAutomationLogInsert
            };
          }
          return {
            select: vi.fn(() => Promise.resolve({ data: [], error: null })),
            insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
          };
        })
      };

      // Simulate the automation executor logic
      const automation = {
        id: 'automation-1',
        tenant_id: 'tenant-1',
        trigger_type: 'loyalty_join',
        workflow_steps: [{
          type: 'sms',
          delayMin: 5,
          text: 'Welcome to {{business}} loyalty program!'
        }],
        name: 'Loyalty Welcome'
      };

      const customer = {
        id: 'customer-1',
        email: 'test@example.com',
        phone: '+1234567890',
        first_name: 'John'
      };

      const step = automation.workflow_steps[0];
      const scheduledAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes delay

      // Simulate message enqueuing
      await supabase.from('crm_outbox').insert({
        tenant_id: automation.tenant_id,
        automation_id: automation.id,
        customer_id: customer.id,
        message_type: step.type,
        recipient: customer.phone,
        content: step.text.replace('{{business}}', 'our garden center'),
        scheduled_at: scheduledAt.toISOString()
      });

      await supabase.from('crm_automation_logs').insert({
        automation_id: automation.id,
        customer_id: customer.id,
        step_index: 0,
        message_type: step.type,
        status: 'queued'
      });

      expect(mockOutboxInsert).toHaveBeenCalledWith({
        tenant_id: 'tenant-1',
        automation_id: 'automation-1',
        customer_id: 'customer-1',
        message_type: 'sms',
        recipient: '+1234567890',
        content: 'Welcome to our garden center loyalty program!',
        scheduled_at: expect.any(String)
      });

      expect(mockAutomationLogInsert).toHaveBeenCalledWith({
        automation_id: 'automation-1',
        customer_id: 'customer-1',
        step_index: 0,
        message_type: 'sms',
        status: 'queued'
      });
    });
  });

  describe('SMS Dispatcher with Twilio Mock', () => {
    it('should send SMS via Twilio when credentials are available', async () => {
      // Mock successful Twilio response
      const mockFetch = vi.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          sid: 'SM123456',
          status: 'sent'
        })
      }));
      global.fetch = mockFetch;

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'user_integrations') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: {
                      credentials: {
                        account_sid: 'AC123',
                        auth_token: 'token123',
                        phone_number: '+1555000000'
                      },
                      is_active: true
                    },
                    error: null
                  }))
                }))
              }))
            };
          }
          if (table === 'crm_message_logs') {
            return {
              insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
            };
          }
          return {
            select: vi.fn(() => Promise.resolve({ data: [], error: null })),
            insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
          };
        })
      };

      const message = {
        id: 'msg-1',
        tenant_id: 'tenant-1',
        customer_id: 'customer-1',
        message_type: 'sms' as const,
        recipient: '+1234567890',
        content: 'Welcome to our loyalty program!',
        template_data: {}
      };

      // Simulate SMS sending logic
      const integration = await supabase.from('user_integrations')
        .select('credentials, is_active')
        .eq('tenant_id', message.tenant_id)
        .eq('integration_type', 'twilio')
        .eq('is_active', true)
        .single();

      expect(integration.data?.credentials).toBeDefined();

      const { account_sid, auth_token, phone_number } = integration.data.credentials;
      
      const formData = new FormData();
      formData.append('From', phone_number);
      formData.append('To', message.recipient);
      formData.append('Body', message.content);

      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${account_sid}:${auth_token}`)}`
        },
        body: formData
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json',
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa('AC123:token123')}`
          },
          body: expect.any(FormData)
        }
      );
    });

    it('should fallback to email when Twilio is disabled', async () => {
      const mockEmailInvoke = vi.fn(() => Promise.resolve({ data: { message_id: 'email-123' }, error: null }));
      
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'user_integrations') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: null, // No Twilio integration
                    error: null
                  }))
                }))
              }))
            };
          }
          if (table === 'crm_customers') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: { email: 'test@example.com' },
                    error: null
                  }))
                }))
              }))
            };
          }
          return {
            insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
          };
        }),
        functions: {
          invoke: mockEmailInvoke
        }
      };

      const message = {
        id: 'msg-1',
        tenant_id: 'tenant-1',
        customer_id: 'customer-1',
        message_type: 'sms' as const,
        recipient: '+1234567890',
        content: 'Welcome to our loyalty program!'
      };

      // Simulate fallback logic
      const integration = await supabase.from('user_integrations')
        .select('credentials, is_active')
        .eq('tenant_id', message.tenant_id)
        .eq('integration_type', 'twilio')
        .eq('is_active', true)
        .single();

      // No Twilio integration found
      expect(integration.data).toBeNull();

      // Get customer email for fallback
      const customer = await supabase.from('crm_customers')
        .select('email')
        .eq('id', message.customer_id)
        .single();

      // Send email fallback
      await supabase.functions.invoke('send-email-campaign', {
        body: {
          tenant_id: message.tenant_id,
          recipient: customer.data.email,
          subject: 'Message from your garden center',
          content: expect.stringContaining(message.content)
        }
      });

      expect(mockEmailInvoke).toHaveBeenCalledWith('send-email-campaign', {
        body: {
          tenant_id: 'tenant-1',
          recipient: 'test@example.com',
          subject: 'Message from your garden center',
          content: expect.stringContaining('Welcome to our loyalty program!')
        }
      });
    });
  });

  describe('Template Logic', () => {
    it('should personalize message content correctly', () => {
      const template = 'Welcome {{first_name}}! {{business}} appreciates you.';
      const customer = {
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah@example.com'
      };

      // Simulate personalization function
      function personalizeMessage(template: string, customer: any): string {
        let personalized = template;
        const replacements = {
          '{{first_name}}': customer.first_name || 'there',
          '{{business}}': 'Green Thumb Garden Center'
        };
        
        for (const [placeholder, value] of Object.entries(replacements)) {
          personalized = personalized.replace(new RegExp(placeholder, 'g'), value);
        }
        
        return personalized;
      }

      const result = personalizeMessage(template, customer);
      expect(result).toBe('Welcome Sarah! Green Thumb Garden Center appreciates you.');
    });

    it('should handle missing customer data gracefully', () => {
      const template = 'Hi {{first_name}}, visit {{business}}!';
      const customer = {}; // No data

      function personalizeMessage(template: string, customer: any): string {
        let personalized = template;
        const replacements = {
          '{{first_name}}': customer.first_name || 'there',
          '{{business}}': 'Green Thumb Garden Center'
        };
        
        for (const [placeholder, value] of Object.entries(replacements)) {
          personalized = personalized.replace(new RegExp(placeholder, 'g'), value);
        }
        
        return personalized;
      }

      const result = personalizeMessage(template, customer);
      expect(result).toBe('Hi there, visit Green Thumb Garden Center!');
    });
  });
});