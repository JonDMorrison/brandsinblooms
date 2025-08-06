export type TriggerOpt = { id: string; label: string; icon: string };

export const triggerCatalog: TriggerOpt[] = [
  { id: 'loyalty_join', label: '🧑‍🤝‍🧑 Loyalty Program Sign-up', icon: '🤝' },
  { id: 'first_purchase', label: '🛒 First Purchase Completed', icon: '🛒' },
  { id: 'birthday', label: '🎂 Birthday (SMS)', icon: '🎂' },
  { id: 'lapse_90', label: '📅 90-Day Lapse', icon: '⏰' },
  { id: 'abandoned_cart', label: '🛍️ Abandoned Cart', icon: '🛍️' },
  { id: 'workshop_rsvp', label: '📅 Workshop RSVP', icon: '📅' },
  { id: 'review_request', label: '⭐ Review Request', icon: '⭐' },
  { id: 'custom_webhook', label: '🔗 Custom Webhook', icon: '🔗' }
];