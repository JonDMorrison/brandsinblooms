-- Add one opt-in event type; preserve the existing allowed trigger types.
-- No automation is created, activated, enrolled, or sent by this migration.
ALTER TABLE public.crm_automations DROP CONSTRAINT crm_automations_trigger_type_check;
ALTER TABLE public.crm_automations ADD CONSTRAINT crm_automations_trigger_type_check
CHECK (trigger_type = ANY (ARRAY[
  'welcome', 'segment_joined', 'purchase_delay', 'seasonal', 'manual',
  'segment.added', 'segment_added', 'persona.assigned', 'persona_assigned',
  'loyalty_join', 'loyalty.signup', 'first_purchase', 'payment.completed',
  'repeat_purchase_90d', 'birthday', 'purchase.anniversary', 'abandoned_cart',
  'review_request', 'contact.created', 'contact.updated', 'newsletter_signup',
  'loyalty_members_segment', 'refund.created', 'order.ready_for_pickup', 'order.shipped',
  'ideal.coupon_issued'
]));
