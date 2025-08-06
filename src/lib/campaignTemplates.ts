import { DelayConfig, convertToMinutes, convertFromMinutes } from './delayUtils';

export interface Step {
  delayValue: number;
  delayUnit: 'minutes' | 'hours' | 'days';
  channel: 'sms' | 'email';
  body: string;
  template_id: string;
  // Legacy field for backward compatibility
  delayHours?: number;
}

// Helper functions for Step interface
export function getStepDelayMinutes(step: Step): number {
  // Use new format if available, otherwise fall back to legacy
  if (step.delayValue !== undefined && step.delayUnit !== undefined) {
    return convertToMinutes(step.delayValue, step.delayUnit);
  }
  return (step.delayHours || 0) * 60;
}

export function createStepWithDelay(delayValue: number, delayUnit: 'minutes' | 'hours' | 'days', channel: 'sms' | 'email', body: string, template_id: string): Step {
  return {
    delayValue,
    delayUnit,
    channel,
    body,
    template_id,
    // Set legacy field for compatibility
    delayHours: convertToMinutes(delayValue, delayUnit) / 60
  };
}

export interface Template {
  name: string;
  trigger: string;
  steps: Step[];
}

export const TEMPLATES = {
  loyalty_join_sms: {
    name: 'Instant Loyalty SMS',
    trigger: 'loyalty_join',
    steps: [{
      delayValue: 0,
      delayUnit: 'minutes' as const,
      channel: 'sms' as const,
      body: '🎉 Thanks for joining Bloom Rewards! Reply BUD to get 10% off your next bouquet.',
      template_id: 'loyalty_join_sms-0',
      delayHours: 0
    }]
  },
  welcome_series_email: {
    name: 'Welcome Email Series',
    trigger: 'newsletter_opt_in',
    steps: [
      {
        delayValue: 0,
        delayUnit: 'minutes' as const,
        channel: 'email' as const,
        body: 'Hi {{first_name}}, thanks for joining our community! We\'re excited to help you grow beautiful gardens.',
        template_id: 'welcome_series_email-0',
        delayHours: 0
      },
      {
        delayValue: 1,
        delayUnit: 'days' as const,
        channel: 'email' as const,
        body: 'Day-2: Our top planting guides for this season are now available in your member area.',
        template_id: 'welcome_series_email-1',
        delayHours: 24
      },
      {
        delayValue: 3,
        delayUnit: 'days' as const,
        channel: 'email' as const,
        body: 'Day-4: Member-only promo - 15% off all flowering plants this week!',
        template_id: 'welcome_series_email-2',
        delayHours: 72
      }
    ]
  },
  first_purchase_sms: {
    name: 'First-Purchase Thank-You SMS',
    trigger: 'first_purchase',
    steps: [{
      delayValue: 1,
      delayUnit: 'hours' as const,
      channel: 'sms' as const,
      body: '🌱 Thanks for your first order! Show this text for 100 bonus points.',
      template_id: 'first_purchase_sms-0',
      delayHours: 1
    }]
  },
  birthday_sms: {
    name: 'Birthday SMS',
    trigger: 'customer_birthday',
    steps: [{
      delayValue: 0,
      delayUnit: 'minutes' as const,
      channel: 'sms' as const,
      body: '🎂 Happy Birthday {{first_name}}! Here\'s a special 20% off coupon: BLOOM20',
      template_id: 'birthday_sms-0',
      delayHours: 0
    }]
  },
  vip_welcome_email: {
    name: 'VIP Customer Welcome',
    trigger: 'big_spender',
    steps: [{
      delayValue: 0,
      delayUnit: 'minutes' as const,
      channel: 'email' as const,
      body: 'Welcome to our VIP program! As a valued customer, you now get exclusive access to rare plants and priority support.',
      template_id: 'vip_welcome_email-0',
      delayHours: 0
    }]
  },
  cart_recovery_sms: {
    name: 'Cart Recovery SMS',
    trigger: 'abandoned_cart',
    steps: [{
      delayValue: 2,
      delayUnit: 'hours' as const,
      channel: 'sms' as const,
      body: 'Don\'t forget your plants! Complete your order in the next hour for free delivery: {{cart_link}}',
      template_id: 'cart_recovery_sms-0',
      delayHours: 2
    }]
  }
} satisfies Record<string, Template>;

export function getTemplatesForTrigger(triggerId: string): Template[] {
  return Object.values(TEMPLATES).filter(template => template.trigger === triggerId);
}

export function getAllTemplates(): Template[] {
  return Object.values(TEMPLATES);
}