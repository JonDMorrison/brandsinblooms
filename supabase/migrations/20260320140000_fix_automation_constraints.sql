-- FIX: [A4] - Update CHECK constraints to match statuses actually used by the code

-- crm_outbox: code writes 'skipped' and 'cancelled' which are not in the current CHECK
ALTER TABLE crm_outbox DROP CONSTRAINT IF EXISTS crm_outbox_status_check;
ALTER TABLE crm_outbox ADD CONSTRAINT crm_outbox_status_check
  CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'retrying', 'skipped', 'cancelled'));

-- crm_automation_logs: code writes 'skipped_no_channel', 'skipped_no_recipient', 'soft_failed'
ALTER TABLE crm_automation_logs DROP CONSTRAINT IF EXISTS crm_automation_logs_status_check;
ALTER TABLE crm_automation_logs ADD CONSTRAINT crm_automation_logs_status_check
  CHECK (status IN ('queued', 'sent', 'failed', 'skipped_no_channel', 'skipped_no_recipient', 'soft_failed'));

-- FIX: [A14] - Replace dead partial indexes (used WHERE status='pending' which doesn't exist)
DROP INDEX IF EXISTS idx_crm_outbox_pending;
DROP INDEX IF EXISTS idx_crm_outbox_locked;

CREATE INDEX idx_crm_outbox_queued ON crm_outbox (scheduled_at, priority, status)
  WHERE status IN ('queued', 'retrying');

CREATE INDEX idx_crm_outbox_locked_queued ON crm_outbox (locked_until)
  WHERE status IN ('queued', 'retrying') AND locked_until IS NOT NULL;

-- FIX: [A16] - Add UNIQUE constraint on crm_automation_logs for upsert to work correctly
ALTER TABLE crm_automation_logs ADD CONSTRAINT uq_automation_logs_step
  UNIQUE (automation_id, customer_id, step_index);
