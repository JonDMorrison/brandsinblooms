
-- Update flow_state JSON: replace order.completed with payment.completed in all crm_automations
UPDATE public.crm_automations
SET flow_state = replace(flow_state::text, 'order.completed', 'payment.completed')::jsonb
WHERE flow_state::text LIKE '%order.completed%';

-- Update trigger_conditions JSON
UPDATE public.crm_automations
SET trigger_conditions = replace(trigger_conditions::text, 'order.completed', 'payment.completed')::jsonb
WHERE trigger_conditions::text LIKE '%order.completed%';
