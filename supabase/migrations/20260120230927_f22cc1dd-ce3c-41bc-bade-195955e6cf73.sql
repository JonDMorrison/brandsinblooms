-- Add automation_node_id to crm_outbox for stable node identification
ALTER TABLE crm_outbox
ADD COLUMN IF NOT EXISTS automation_node_id TEXT;

-- Add index for efficient querying by node
CREATE INDEX IF NOT EXISTS idx_crm_outbox_automation_node
ON crm_outbox(automation_id, automation_node_id);

-- Add automation_run_id if missing (for step advancement tracking)
ALTER TABLE crm_outbox
ADD COLUMN IF NOT EXISTS automation_run_id UUID;

-- Add index for automation run queries
CREATE INDEX IF NOT EXISTS idx_crm_outbox_automation_run
ON crm_outbox(automation_run_id);

-- Comment explaining the columns
COMMENT ON COLUMN crm_outbox.automation_node_id IS 'Stable node ID from the automation flow canvas (node.id), not derived from step_index';
COMMENT ON COLUMN crm_outbox.automation_run_id IS 'References the automation_runs record for this customer journey';