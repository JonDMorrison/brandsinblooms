-- Add pg_cron scheduling for automation executor
SELECT cron.schedule(
    'run-automation-executor-5m',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://your-project.supabase.co/functions/v1/automation-executor',
        headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '", "Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    ) AS request_id;
    $$
);

-- Add RLS policies for automation tables
ALTER TABLE IF EXISTS crm_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_outbox ENABLE ROW LEVEL SECURITY;

-- Ensure tenant-scoped access for automations
DROP POLICY IF EXISTS "Users can access automations in their tenant" ON crm_automations;
CREATE POLICY "Users can access automations in their tenant" ON crm_automations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.tenant_id = crm_automations.tenant_id 
            AND u.id = auth.uid()
        )
    );

-- Automation logs access via automation relationship
DROP POLICY IF EXISTS "Users can access automation logs in their tenant" ON crm_automation_logs;
CREATE POLICY "Users can access automation logs in their tenant" ON crm_automation_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM crm_automations a
            JOIN users u ON u.tenant_id = a.tenant_id
            WHERE a.id = crm_automation_logs.automation_id
            AND u.id = auth.uid()
        )
    );

-- Outbox access via tenant
DROP POLICY IF EXISTS "Users can access outbox in their tenant" ON crm_outbox;
CREATE POLICY "Users can access outbox in their tenant" ON crm_outbox
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.tenant_id = crm_outbox.tenant_id 
            AND u.id = auth.uid()
        )
    );