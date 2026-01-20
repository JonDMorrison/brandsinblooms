-- Automation email execution log for per-recipient tracking
CREATE TABLE IF NOT EXISTS automation_email_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES crm_automations(id) ON DELETE CASCADE,
  automation_node_id text NOT NULL,
  customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL, -- sent | skipped | failed
  reason text,          -- suppressed | opt_out | missing_email | render_error | send_error | already_sent
  resend_message_id text,
  error text,
  outbox_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_automation_email_exec_automation
  ON automation_email_executions(automation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_email_exec_node
  ON automation_email_executions(automation_node_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_email_exec_customer
  ON automation_email_executions(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_email_exec_tenant
  ON automation_email_executions(tenant_id, created_at DESC);

-- Unique constraint to prevent duplicate sends (automation + node + customer)
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_email_exec_unique_sent
  ON automation_email_executions(automation_id, automation_node_id, customer_id)
  WHERE status = 'sent';

-- Enable RLS
ALTER TABLE automation_email_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their tenant automation executions"
ON automation_email_executions FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Service can insert automation executions"
ON automation_email_executions FOR INSERT
WITH CHECK (true);