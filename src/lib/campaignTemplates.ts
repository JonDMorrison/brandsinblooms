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
  },
  customer_loyalty_program: {
    name: 'Customer Loyalty Program: Ongoing Nurture Series',
    trigger: 'loyalty_members_segment',
    steps: [
      {
        delayValue: 0,
        delayUnit: 'minutes' as const,
        channel: 'sms' as const,
        body: 'Thanks for joining our Loyalty Program at {{garden_center_name}}! Enjoy 10% off your next visit. Just show this message at checkout. We\'re glad you\'re part of our community! Reply STOP to opt out.',
        template_id: 'customer_loyalty_program-0',
        delayHours: 0
      },
      {
        delayValue: 24,
        delayUnit: 'hours' as const,
        channel: 'email' as const,
        body: 'Thanks for visiting {{garden_center_name}} — enjoy your reward!\n\nHi there!\n\nThanks so much for visiting our garden center and joining our loyalty program. We hope you found exactly what you were looking for!\n\nDon\'t forget about your 10% off reward — just show the text message we sent you at checkout on your next visit.\n\n{{seasonal_tip}}\n\nWe love helping fellow gardeners grow beautiful spaces. See what\'s fresh this week on our website!\n\nHappy gardening,\nThe {{garden_center_name}} Team\n\nP.S. Follow us on social media for daily garden inspiration and tips!',
        template_id: 'customer_loyalty_program-1',
        delayHours: 24
      },
      {
        delayValue: 7,
        delayUnit: 'days' as const,
        channel: 'email' as const,
        body: 'A quick tip for your garden this week\n\nHi {{first_name}}!\n\nHere\'s a quick gardening tip to help you make the most of this season:\n\n{{seasonal_tip}}\n\nAs a loyal member, you still have that 10% off reward waiting for you at {{garden_center_name}}. We\'re always here to help with any questions about your garden!\n\nHappy gardening,\nThe {{garden_center_name}} Team',
        template_id: 'customer_loyalty_program-2',
        delayHours: 168
      },
      {
        delayValue: 14,
        delayUnit: 'days' as const,
        channel: 'sms' as const,
        body: 'Hi {{first_name}}, just a reminder you\'ve got 10% off waiting for you at {{garden_center_name}}. Stop by soon and see what\'s new! Reply STOP to opt out.',
        template_id: 'customer_loyalty_program-3',
        delayHours: 336
      },
      {
        delayValue: 30,
        delayUnit: 'days' as const,
        channel: 'email' as const,
        body: 'Why we love serving gardeners like you\n\nHi {{first_name}}!\n\nWe wanted to take a moment to share why {{garden_center_name}} exists. Our mission is simple: to help every gardener in our community grow beautiful, thriving spaces that bring joy and connection to nature.\n\nWhether you\'re just starting out or you\'ve been gardening for years, we believe everyone deserves access to healthy plants, expert advice, and a supportive community of fellow plant lovers.\n\nThat\'s why we offer:\n• Expert plant care guidance from our knowledgeable staff\n• Community workshops and seasonal events\n• Locally-sourced plants that thrive in our climate\n• Support for sustainable gardening practices\n\nAs a loyalty member, you\'re part of this growing community! Keep an eye out for our upcoming workshops and seasonal events.\n\nThank you for being part of the {{garden_center_name}} family!\n\nWith gratitude,\nThe {{garden_center_name}} Team\n\nP.S. Follow us on social media for daily inspiration and connect with fellow gardeners!',
        template_id: 'customer_loyalty_program-4',
        delayHours: 720
      }
    ]
  }
} satisfies Record<string, Template>;

export function getTemplatesForTrigger(triggerId: string): Template[] {
  return Object.values(TEMPLATES).filter(template => template.trigger === triggerId);
}

export function getAllTemplates(): Template[] {
  return Object.values(TEMPLATES);
}