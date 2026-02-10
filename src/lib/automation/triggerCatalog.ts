export interface TriggerMeta {
  id: string;
  label: string;
  icon: string;
  defaultDelayMin: number;
  channels: ('sms' | 'email')[];
  goalHint: string;
  description: string;
  conditions?: Record<string, any>;
  /** 'event' = targets the triggering customer (no audience needed), 'batch' = needs audience selection */
  audienceType: 'event' | 'batch';
}

/** Returns true if the trigger requires audience selection */
export function triggerRequiresAudience(triggerId: string): boolean {
  const trigger = getTriggerById(triggerId);
  return trigger?.audienceType === 'batch';
}

export const triggerCatalog: TriggerMeta[] = [
  {
    id: 'loyalty_join',
    label: '🎖️ Loyalty Program Enrollment',
    icon: '🎖️',
    defaultDelayMin: 5,
    channels: ['sms', 'email'],
    goalHint: 'Welcome Series',
    description: 'Triggered when customer enrolls in Square Loyalty program',
    audienceType: 'event'
  },
  {
    id: 'first_purchase',
    label: '🛒 First Purchase Completed',
    icon: '🛒',
    defaultDelayMin: 60,
    channels: ['sms', 'email'],
    goalHint: 'Welcome Series',
    description: 'First POS transaction recorded for customer',
    audienceType: 'event'
  },
  {
    id: 'payment.completed',
    label: '🛍️ Any Purchase Completed',
    icon: '🛍️',
    defaultDelayMin: 30,
    channels: ['sms', 'email'],
    goalHint: 'Purchase Follow-up',
    description: 'Fires on payment.created or payment.updated (COMPLETED) or invoice.payment_made (PAID)',
    audienceType: 'event'
  },
  {
    id: 'order.ready_for_pickup',
    label: '🏪 Order Ready for Pickup',
    icon: '🏪',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Order Notifications',
    description: 'Order is ready for customer pickup at store',
    audienceType: 'event'
  },
  {
    id: 'order.shipped',
    label: '📬 Order Shipped',
    icon: '📬',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Order Notifications',
    description: 'Order has been shipped to customer',
    audienceType: 'event'
  },
  {
    id: 'refund.created',
    label: '💸 Refund Processed',
    icon: '💸',
    defaultDelayMin: 30,
    channels: ['sms', 'email'],
    goalHint: 'Service Recovery',
    description: 'Refund has been processed - opportunity for service recovery',
    audienceType: 'event'
  },
  {
    id: 'repeat_purchase_90d',
    label: '📅 90-Day Purchase Lapse',
    icon: '⏰',
    defaultDelayMin: 1440,
    channels: ['sms', 'email'],
    goalHint: 'Re-engagement',
    description: 'Customer hasn\'t purchased in 90 days (daily job)',
    audienceType: 'batch'
  },
  {
    id: 'plant_care_reminder',
    label: '🌱 Plant Care Reminder',
    icon: '🌱',
    defaultDelayMin: 14400,
    channels: ['sms', 'email'],
    goalHint: 'Care Tips',
    description: 'Tag-based reminder for plant care (e.g., tomato seedlings)',
    audienceType: 'batch'
  },
  {
    id: 'birthday',
    label: '🎂 Birthday',
    icon: '🎂',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Birthday Celebration',
    description: 'Customer\'s birthday matches today (daily job)',
    audienceType: 'batch'
  },
  {
    id: 'new_product_drop',
    label: '🆕 New Product Launch',
    icon: '🆕',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Product Announcement',
    description: 'Scheduled for manual product release date',
    audienceType: 'batch'
  },
  {
    id: 'event_registration',
    label: '📅 Workshop RSVP',
    icon: '📅',
    defaultDelayMin: 30,
    channels: ['sms', 'email'],
    goalHint: 'Event Confirmation',
    description: 'Customer signs up for workshop or event',
    audienceType: 'event'
  },
  {
    id: 'abandoned_cart',
    label: '🛍️ Abandoned Cart',
    icon: '🛍️',
    defaultDelayMin: 120,
    channels: ['sms', 'email'],
    goalHint: 'Cart Recovery',
    description: 'E-commerce cart abandoned for 2+ hours',
    audienceType: 'event'
  },
  {
    id: 'review_request',
    label: '⭐ Review Request',
    icon: '⭐',
    defaultDelayMin: 7200,
    channels: ['sms', 'email'],
    goalHint: 'Review Collection',
    description: 'Request review 5 days after purchase completion',
    audienceType: 'event'
  },
  {
    id: 'garden_tips_subscription',
    label: '💡 Garden Tips Subscription',
    icon: '💡',
    defaultDelayMin: 0,
    channels: ['email'],
    goalHint: 'Educational Content',
    description: 'Weekly garden tips subscription',
    audienceType: 'batch'
  },
  {
    id: 'holiday_promo',
    label: '🎄 Holiday Promotion',
    icon: '🎄',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Seasonal Marketing',
    description: 'Fixed calendar date range promotions',
    audienceType: 'batch'
  },
  {
    id: 'custom_webhook',
    label: '🔗 Custom Webhook',
    icon: '🔗',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Custom Integration',
    description: 'Triggered by POST to /webhooks/automation',
    audienceType: 'event'
  },
  {
    id: 'loyalty_members_segment',
    label: '🤝 Contact Added to Loyalty Members Segment',
    icon: '🤝',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Welcome Series',
    description: 'Triggered when a contact is added to the Loyalty Members segment via POS sync or manual addition',
    audienceType: 'event'
  },
  {
    id: 'segment.added',
    label: '📊 Added to Segment',
    icon: '📊',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Segmentation',
    description: 'Triggered when a contact is added to a specific segment. Select the target segment after choosing this trigger.',
    audienceType: 'event'
  },
  {
    id: 'persona.assigned',
    label: '👤 Persona Assigned',
    icon: '👤',
    defaultDelayMin: 0,
    channels: ['sms', 'email'],
    goalHint: 'Personalization',
    description: 'Triggered when a contact is assigned to a specific persona. Select the target persona after choosing this trigger.',
    audienceType: 'event'
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
