import { 
  UsersRound, 
  ShoppingCart, 
  Cake, 
  DollarSign, 
  ShoppingBag, 
  Star, 
  CalendarCheck, 
  MailOpen,
  LucideIcon
} from 'lucide-react';

export interface Trigger {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const TRIGGERS: Trigger[] = [
  {
    id: 'loyalty_join',
    label: 'Customer joins Loyalty Program',
    description: 'Contact created with tag = loyalty',
    icon: UsersRound
  },
  {
    id: 'first_purchase',
    label: 'First Purchase Completed',
    description: 'order_count == 1',
    icon: ShoppingCart
  },
  {
    id: 'customer_birthday',
    label: 'Customer Birthday (SMS)',
    description: 'birthdate matches today',
    icon: Cake
  },
  {
    id: 'big_spender',
    label: 'Lifetime Spend > $500',
    description: 'total_spend>=500',
    icon: DollarSign
  },
  {
    id: 'abandoned_cart',
    label: 'Abandoned Cart',
    description: 'checkout started but not paid',
    icon: ShoppingBag
  },
  {
    id: 'review_request',
    label: 'Product Delivered',
    description: 'fulfillment_status=delivered',
    icon: Star
  },
  {
    id: 'event_rsvp',
    label: 'Workshop RSVP',
    description: 'event.signup=true',
    icon: CalendarCheck
  },
  {
    id: 'newsletter_opt_in',
    label: 'Email Opt-in',
    description: 'marketing_status=subscribed',
    icon: MailOpen
  }
];

export function getTriggerById(id: string): Trigger | undefined {
  return TRIGGERS.find(trigger => trigger.id === id);
}