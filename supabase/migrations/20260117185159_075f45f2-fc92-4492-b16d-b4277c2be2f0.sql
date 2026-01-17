-- Fix: Update both queued emails to send immediately
-- These emails were queued before the automation delay was updated to "Immediate"

UPDATE crm_outbox
SET scheduled_at = NOW()
WHERE automation_id = '08b67f27-b802-4499-bd3f-0e8925e0e11f'
  AND message_type = 'email'
  AND status = 'queued'
  AND step_index = 1;