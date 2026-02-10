export interface CoreEvent {
  id: string;
  label: string;
  description: string;
}

export const CORE_EVENTS: CoreEvent[] = [
  {
    id: 'contact.created',
    label: 'New Contact Created',
    description: 'Triggers when a new contact is added to the system'
  },
  {
    id: 'contact.updated',
    label: 'Contact Updated',
    description: 'Triggers when contact information is modified'
  },
  {
    id: 'segment.added',
    label: 'Added to Segment',
    description: 'Triggers when a contact is added to any segment'
  },
  {
    id: 'persona.assigned',
    label: 'Persona Assigned',
    description: 'Triggers when a contact is assigned to any persona'
  },
  {
    id: 'loyalty.signup',
    label: 'Customer joins Loyalty Program',
    description: 'Triggers when a customer enrolls in the loyalty program'
  },
  {
    id: 'order.created',
    label: 'Order Created',
    description: 'Triggers when a new order is created in the POS system'
  },
  {
    id: 'payment.completed',
    label: 'Payment Completed',
    description: 'Triggers when a real payment/money movement is completed'
  },
  {
    id: 'email.opened',
    label: 'Email Opened',
    description: 'Triggers when a customer opens an email campaign'
  },
  {
    id: 'sms.replied',
    label: 'SMS Reply Received',
    description: 'Triggers when a customer replies to an SMS message'
  },
  {
    id: 'purchase.anniversary',
    label: 'Purchase Anniversary',
    description: 'Triggers on the anniversary of first purchase'
  },
  {
    id: 'loyalty_members.segment_added',
    label: 'Added to Loyalty Members Segment',
    description: 'Triggers when a contact is added to the Loyalty Members segment'
  }
];

export type CoreEventID = typeof CORE_EVENTS[number]['id'];

export function getEventByID(id: CoreEventID): CoreEvent | undefined {
  return CORE_EVENTS.find(event => event.id === id);
}