// Quick automation templates for Clover integration setup wizard

export interface QuickAutomation {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  icon: 'gift' | 'star' | 'cake' | 'clock' | 'user' | 'heart';
  default_channel: 'email' | 'sms';
  recommended: boolean;
  delay_days?: number;
}

export const CLOVER_QUICK_AUTOMATIONS: QuickAutomation[] = [
  {
    id: 'first_purchase_welcome',
    name: 'First Purchase Thank You',
    description: 'Send a warm welcome email after their first purchase',
    trigger_type: 'first_purchase',
    icon: 'gift',
    default_channel: 'email',
    recommended: true,
  },
  {
    id: 'review_request',
    name: 'Review Request',
    description: 'Ask for a review 5 days after purchase',
    trigger_type: 'review_request',
    icon: 'star',
    default_channel: 'email',
    recommended: true,
    delay_days: 5,
  },
  {
    id: 'birthday_rewards',
    name: 'Birthday Rewards',
    description: 'Send special offers on customer birthdays',
    trigger_type: 'birthday',
    icon: 'cake',
    default_channel: 'email',
    recommended: true,
  },
  {
    id: 'win_back_90',
    name: 'Win-Back (90 Days)',
    description: 'Re-engage customers who haven\'t visited in 90 days',
    trigger_type: 'repeat_purchase_90d',
    icon: 'clock',
    default_channel: 'email',
    recommended: false,
  },
  {
    id: 'new_customer_welcome',
    name: 'New Customer Welcome',
    description: 'Welcome new customers when they\'re added to Clover',
    trigger_type: 'customer.created',
    icon: 'user',
    default_channel: 'email',
    recommended: false,
  },
  {
    id: 'loyalty_join',
    name: 'Loyalty Welcome',
    description: 'Celebrate when customers join your loyalty program',
    trigger_type: 'loyalty_join',
    icon: 'heart',
    default_channel: 'email',
    recommended: false,
  },
];

export const getRecommendedAutomations = () => 
  CLOVER_QUICK_AUTOMATIONS.filter(a => a.recommended);

export const getAutomationById = (id: string) => 
  CLOVER_QUICK_AUTOMATIONS.find(a => a.id === id);
