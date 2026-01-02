-- Update the trigger_type check constraint to allow new trigger types
ALTER TABLE crm_automations DROP CONSTRAINT IF EXISTS crm_automations_trigger_type_check;

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
  'contact.updated'::text
]));

-- Fix the existing "Perks Program" automation to have correct trigger_conditions
UPDATE crm_automations
SET 
  trigger_type = 'segment.added',
  trigger_conditions = jsonb_build_object(
    'segment_id', (flow_state->'nodes'->0->'data'->'conditions'->>'segment_id')
  )
WHERE id = '08b67f27-b802-4499-bd3f-0e8925e0e11f'
  AND flow_state->'nodes'->0->'data'->'conditions'->>'segment_id' IS NOT NULL;