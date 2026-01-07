
-- Update Christine's 4 manual automations to trigger on order.completed events (Square purchases)
UPDATE crm_automations 
SET trigger_type = 'order.completed', 
    trigger_conditions = '{}',
    updated_at = now()
WHERE tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62' 
  AND trigger_type = 'manual'
  AND is_active = true;
