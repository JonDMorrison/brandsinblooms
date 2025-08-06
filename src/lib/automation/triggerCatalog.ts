export interface TriggerMeta {
  id: string;
  label: string;
  icon: string;
  defaultDelayMin: number;
  channels: ('sms' | 'email')[];
  goalHint: string;
  description: string;
  conditions?: Record<string, any>;
}

export const triggerCatalog: TriggerMeta[] = [
  {
    id: 'loyalty_join',
    label: '🧑‍🤝‍🧑 Loyalty Program Sign-up',
    icon: '🤝',
    defaultDelayMin: 5,
    channels: ['sms', 'email'],
    goalHint: 'Welcome Series',
    description: 'Triggered when customer joins loyalty program'
  },
  {
    id: 'first_purchase',
    label: '🛒 First Purchase Completed',
    icon: '🛒',
    defaultDelayMin: 60,
    channels: ['sms', 'email'],
    goalHint: 'Welcome Series',
    description: 'First POS transaction recorded for customer'
  },
  {
    id: 'repeat_purchase_90d',
    label: '📅 90-Day Purchase Lapse',
    icon: '⏰',
    defaultDelayMin: 1440, // 24 hours
    channels: ['sms', 'email'],
    goalHint: 'Re-engagement',
    description: 'Customer hasn\'t purchased in 90 days'
  },
  {
    id: 'plant_care_reminder',
    label: '🌱 Plant Care Reminder',
    icon: '🌱',
    defaultDelayMin: 14400, // 10 days
    channels: ['sms', 'email'],
    goalHint: 'Care Tips',
    description: 'Tag-based reminder for plant care (e.g., tomato seedlings)'
  },
  {
    id: 'birthday',
    label: '🎂 Birthday (SMS)',
    icon: '🎂',
    defaultDelayMin: 0, // immediate
    channels: ['sms', 'email'],
    goalHint: 'Birthday Celebration',
    description: 'Customer\'s birthday matches today'
  },
  {
    id: 'new_product_drop',
    label: '🆕 New Product Launch',
    icon: '🆕',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Product Announcement',
    description: 'Scheduled for manual product release date'
  },
  {
    id: 'event_registration',
    label: '📅 Workshop RSVP',
    icon: '📅',
    defaultDelayMin: 30,
    channels: ['sms', 'email'],
    goalHint: 'Event Confirmation',
    description: 'Customer signs up for workshop or event'
  },
  {
    id: 'abandoned_cart',
    label: '🛍️ Abandoned Cart',
    icon: '🛍️',
    defaultDelayMin: 120, // 2 hours
    channels: ['sms', 'email'],
    goalHint: 'Cart Recovery',
    description: 'E-commerce cart abandoned for 2+ hours'
  },
  {
    id: 'review_request',
    label: '⭐ Review Request',
    icon: '⭐',
    defaultDelayMin: 7200, // 5 days
    channels: ['sms', 'email'],
    goalHint: 'Review Collection',
    description: 'Request review 5 days after purchase completion'
  },
  {
    id: 'garden_tips_subscription',
    label: '💡 Garden Tips Subscription',
    icon: '💡',
    defaultDelayMin: 0,
    channels: ['email'],
    goalHint: 'Educational Content',
    description: 'Weekly garden tips subscription'
  },
  {
    id: 'holiday_promo',
    label: '🎄 Holiday Promotion',
    icon: '🎄',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Seasonal Marketing',
    description: 'Fixed calendar date range promotions'
  },
  {
    id: 'custom_webhook',
    label: '🔗 Custom Webhook',
    icon: '🔗',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Custom Integration',
    description: 'Triggered by POST to /webhooks/automation'
  }
];

export function getTriggerById(id: string): TriggerMeta | null {
  return triggerCatalog.find(trigger => trigger.id === id) || null;
}

export function getTriggersByChannel(channel: 'sms' | 'email'): TriggerMeta[] {
  return triggerCatalog.filter(trigger => trigger.channels.includes(channel));
}

export function getTriggersByGoal(goalHint: string): TriggerMeta[] {
  return triggerCatalog.filter(trigger => trigger.goalHint === goalHint);
}