-- Fix: Update automation email step delay from "24 hours" to "Immediate"
-- Automation: "Perks Program: SMS + Email Welcome" (ID: 08b67f27-b802-4499-bd3f-0e8925e0e11f)

-- 1. Update the workflow_steps to change email delay to Immediate
UPDATE crm_automations
SET workflow_steps = jsonb_set(
  workflow_steps,
  '{1,delay}',
  '"Immediate"'::jsonb
),
updated_at = NOW()
WHERE id = '08b67f27-b802-4499-bd3f-0e8925e0e11f';

-- 2. Update the currently queued email to send immediately
UPDATE crm_outbox
SET scheduled_at = NOW()
WHERE automation_run_id = '3af625f7-0a27-44f6-a6d7-4b33cdf43cf0'
  AND step_index = 1
  AND status = 'queued';