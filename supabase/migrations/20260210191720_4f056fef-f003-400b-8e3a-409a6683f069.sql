-- Drop old check constraint
ALTER TABLE public.crm_automations DROP CONSTRAINT crm_automations_trigger_type_check;

-- Migrate existing order.completed rows BEFORE adding new constraint
UPDATE public.crm_automations 
SET trigger_type = 'payment.completed' 
WHERE trigger_type = 'order.completed';

-- Update the specific automation
UPDATE public.crm_automations
SET trigger_type = 'payment.completed'
WHERE id = 'ab7bb144-086c-49a3-9bd8-a34e803d2b91';

-- Add updated constraint (without order.completed, with payment.completed and new types)
ALTER TABLE public.crm_automations ADD CONSTRAINT crm_automations_trigger_type_check 
CHECK (trigger_type = ANY (ARRAY[
  'welcome', 'segment_joined', 'purchase_delay', 'seasonal', 'manual',
  'segment.added', 'segment_added', 'persona.assigned', 'persona_assigned',
  'loyalty_join', 'loyalty.signup', 'first_purchase', 'payment.completed',
  'repeat_purchase_90d', 'birthday', 'purchase.anniversary', 'abandoned_cart',
  'review_request', 'contact.created', 'contact.updated', 'newsletter_signup',
  'loyalty_members_segment', 'refund.created', 'order.ready_for_pickup', 'order.shipped'
]));