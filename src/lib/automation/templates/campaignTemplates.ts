import { convertFromMinutes } from '@/lib/delayUtils';

export interface AutomationStep {
  type: 'sms' | 'email';
  delayMin: number;
  text: string;
  subject?: string; // For email only
  template?: string;
}

export interface CampaignTemplate {
  goal: string;
  trigger: string;
  channels: string[];
  timeline: AutomationStep[];
  description: string;
}

export const campaignTemplates: Record<string, CampaignTemplate> = {
  // Welcome Series Templates
  'welcome-loyalty_join-sms': {
    goal: 'Welcome Series',
    trigger: 'loyalty_join',
    channels: ['sms'],
    timeline: [
      {
        type: 'sms',
        delayMin: 5,
        text: 'Welcome to {{business}} loyalty program! 🎉 Here\'s 10% off your next purchase: {{discount_code}}'
      },
      {
        type: 'sms',
        delayMin: 1440, // 1 day
        text: 'Don\'t forget to use your 10% discount! Valid for 30 days. Shop now: {{shop_url}}'
      }
    ],
    description: 'SMS-only welcome series for loyalty program signups'
  },
  
  'welcome-loyalty_join-mixed': {
    goal: 'Welcome Series',
    trigger: 'loyalty_join',
    channels: ['sms', 'email'],
    timeline: [
      {
        type: 'sms',
        delayMin: 5,
        text: 'Welcome to {{business}}! 🌱 Check your email for your welcome gift!'
      },
      {
        type: 'email',
        delayMin: 60, // 1 hour
        subject: 'Welcome to {{business}} - Your 10% Discount Inside!',
        text: 'Welcome to our garden center family! Here\'s your exclusive 10% discount code: {{discount_code}}. Use it on any purchase within the next 30 days.',
        template: 'welcome_email'
      },
      {
        type: 'sms',
        delayMin: 1440, // 1 day
        text: 'Ready to start your garden? Your 10% discount expires in 29 days! {{shop_url}}'
      }
    ],
    description: 'Mixed SMS and email welcome series'
  },

  'welcome-first_purchase-sms': {
    goal: 'Welcome Series',
    trigger: 'first_purchase',
    channels: ['sms'],
    timeline: [
      {
        type: 'sms',
        delayMin: 60, // 1 hour
        text: 'Thanks for your first purchase at {{business}}! 🛒 Show this text for 100 bonus loyalty points.'
      },
      {
        type: 'sms',
        delayMin: 10080, // 7 days
        text: 'How are your new plants doing? Reply with a photo for care tips! 📸🌱'
      }
    ],
    description: 'First purchase follow-up series'
  },

  // Product Drop Templates
  'product-new_product_drop-sms': {
    goal: 'Product Announcement',
    trigger: 'new_product_drop',
    channels: ['sms'],
    timeline: [
      {
        type: 'sms',
        delayMin: 0,
        text: '🆕 NEW ARRIVAL: {{product_name}} just dropped! Limited stock - get yours now: {{product_url}}'
      }
    ],
    description: 'Immediate SMS for new product launches'
  },

  'product-new_product_drop-email': {
    goal: 'Product Announcement',
    trigger: 'new_product_drop',
    channels: ['email'],
    timeline: [
      {
        type: 'email',
        delayMin: 0,
        subject: '🆕 NEW: {{product_name}} - Limited Stock!',
        text: 'We\'re excited to introduce {{product_name}}! This exclusive variety is now available in limited quantities.',
        template: 'product_announcement'
      }
    ],
    description: 'Detailed email for new product launches'
  },

  // Review Request Templates
  'reviews-review_request-sms': {
    goal: 'Review Collection',
    trigger: 'review_request',
    channels: ['sms'],
    timeline: [
      {
        type: 'sms',
        delayMin: 7200, // 5 days
        text: 'Hey {{first_name}}! How are your plants from {{business}}? Share a quick review: {{review_url}} 🌟'
      }
    ],
    description: 'Friendly SMS review request'
  },

  // Re-engagement Templates
  'reengagement-repeat_purchase_90d-sms': {
    goal: 'Re-engagement',
    trigger: 'repeat_purchase_90d',
    channels: ['sms'],
    timeline: [
      {
        type: 'sms',
        delayMin: 1440, // 24 hours after trigger
        text: 'We miss you at {{business}}! 😢 Come back with 15% off: {{comeback_code}}'
      },
      {
        type: 'sms',
        delayMin: 10080, // 7 days later
        text: 'Last chance! Your 15% comeback discount expires in 3 days. {{shop_url}}'
      }
    ],
    description: 'Win back lapsed customers'
  },

  // Care Tips Templates
  'care-plant_care_reminder-sms': {
    goal: 'Care Tips',
    trigger: 'plant_care_reminder',
    channels: ['sms'],
    timeline: [
      {
        type: 'sms',
        delayMin: 14400, // 10 days
        text: '🌱 Care reminder: Your {{plant_type}} needs {{care_action}}. Need help? Reply HELP for tips!'
      }
    ],
    description: 'Plant care reminders based on purchase tags'
  },

  // Birthday Templates
  'birthday-birthday-sms': {
    goal: 'Birthday Celebration',
    trigger: 'birthday',
    channels: ['sms'],
    timeline: [
      {
        type: 'sms',
        delayMin: 0,
        text: '🎂 Happy Birthday {{first_name}}! Enjoy 20% off today only with code: BIRTHDAY20'
      }
    ],
    description: 'Birthday celebration discount'
  },

  // Event Templates
  'event-event_registration-mixed': {
    goal: 'Event Confirmation',
    trigger: 'event_registration',
    channels: ['sms', 'email'],
    timeline: [
      {
        type: 'sms',
        delayMin: 30,
        text: '✅ You\'re registered for {{event_name}} on {{event_date}}! Details in your email.'
      },
      {
        type: 'email',
        delayMin: 60,
        subject: 'Workshop Confirmation: {{event_name}}',
        text: 'Thank you for registering for {{event_name}}. Here are the details and what to bring.',
        template: 'event_confirmation'
      }
    ],
    description: 'Event registration confirmation'
  },

  // Cart Recovery Templates
  'recovery-abandoned_cart-sms': {
    goal: 'Cart Recovery',
    trigger: 'abandoned_cart',
    channels: ['sms'],
    timeline: [
      {
        type: 'sms',
        delayMin: 120, // 2 hours
        text: 'You left some plants behind! 🌿 Complete your order in the next hour for free delivery: {{cart_url}}'
      }
    ],
    description: 'Abandoned cart recovery with urgency'
  },

  // Holiday Templates
  'holiday-holiday_promo-mixed': {
    goal: 'Seasonal Marketing',
    trigger: 'holiday_promo',
    channels: ['sms', 'email'],
    timeline: [
      {
        type: 'email',
        delayMin: 0,
        subject: '🎄 {{holiday_name}} Sale - {{discount}}% Off Everything!',
        text: 'Celebrate {{holiday_name}} with our biggest sale of the year!',
        template: 'holiday_promotion'
      },
      {
        type: 'sms',
        delayMin: 1440, // 1 day later
        text: '⏰ Last day for {{holiday_name}} sale! {{discount}}% off ends tonight: {{shop_url}}'
      }
    ],
    description: 'Holiday promotion with urgency follow-up'
  },

  // Educational Content Templates
  'education-garden_tips_subscription-email': {
    goal: 'Educational Content',
    trigger: 'garden_tips_subscription',
    channels: ['email'],
    timeline: [
      {
        type: 'email',
        delayMin: 0,
        subject: 'Weekly Garden Tips: {{tip_topic}}',
        text: 'This week\'s gardening tip: {{tip_content}}',
        template: 'weekly_tips'
      }
    ],
    description: 'Weekly educational content delivery'
  },

  // Custom Webhook Templates
  'custom-custom_webhook-sms': {
    goal: 'Custom Integration',
    trigger: 'custom_webhook',
    channels: ['sms'],
    timeline: [
      {
        type: 'sms',
        delayMin: 0,
        text: '{{custom_message}}'
      }
    ],
    description: 'Flexible webhook-triggered message'
  }
};

export function getTemplateByKey(key: string): CampaignTemplate | null {
  return campaignTemplates[key] || null;
}

export function getTemplatesByGoal(goal: string): CampaignTemplate[] {
  return Object.values(campaignTemplates).filter(template => template.goal === goal);
}

export function getTemplatesByTrigger(trigger: string): CampaignTemplate[] {
  return Object.values(campaignTemplates).filter(template => template.trigger === trigger);
}

export function getTemplatesByChannels(channels: string[]): CampaignTemplate[] {
  return Object.values(campaignTemplates).filter(template => 
    channels.every(channel => template.channels.includes(channel))
  );
}

export function generateTemplateKey(goal: string, trigger: string, channels: string[]): string {
  const channelSuffix = channels.length === 1 ? channels[0] : 
                       channels.includes('sms') && channels.includes('email') ? 'mixed' : 
                       channels.join('-');
  return `${goal.toLowerCase().replace(/\s+/g, '')}-${trigger}-${channelSuffix}`;
}