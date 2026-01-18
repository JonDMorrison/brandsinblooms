-- First, drop the existing check constraint
ALTER TABLE crm_automations DROP CONSTRAINT IF EXISTS crm_automations_trigger_type_check;

-- Add a new check constraint with all the trigger types (including newsletter_signup and loyalty_members_segment)
ALTER TABLE crm_automations ADD CONSTRAINT crm_automations_trigger_type_check 
CHECK (trigger_type = ANY (ARRAY[
  'welcome'::text, 
  'segment_joined'::text, 
  'purchase_delay'::text, 
  'seasonal'::text, 
  'manual'::text, 
  'segment.added'::text, 
  'segment_added'::text, 
  'persona.assigned'::text, 
  'persona_assigned'::text, 
  'loyalty_join'::text, 
  'loyalty.signup'::text, 
  'first_purchase'::text, 
  'order.completed'::text, 
  'repeat_purchase_90d'::text, 
  'birthday'::text, 
  'purchase.anniversary'::text, 
  'abandoned_cart'::text, 
  'review_request'::text, 
  'contact.created'::text, 
  'contact.updated'::text,
  'newsletter_signup'::text,
  'loyalty_members_segment'::text
]));

-- Now sync trigger_type column from flow_state for all automations where there's a mismatch
UPDATE crm_automations
SET trigger_type = flow_state->'nodes'->0->'data'->>'triggerType'
WHERE flow_state IS NOT NULL
  AND flow_state->'nodes'->0->'data'->>'triggerType' IS NOT NULL
  AND (trigger_type IS NULL OR trigger_type != (flow_state->'nodes'->0->'data'->>'triggerType'));