
-- How many orphan tasks still have no tenant_id?
SELECT count(*) FROM content_tasks WHERE tenant_id IS NULL;

-- Show a few tasks that _do_ have tenant_id but don't belong to your current tenant
SELECT ct.id, c.title, ct.tenant_id
FROM   content_tasks ct
LEFT JOIN campaigns c ON c.id = ct.campaign_id
WHERE  ct.tenant_id IS NOT NULL
AND    ct.tenant_id != (
       SELECT tenant_id FROM users WHERE id = auth.uid()
)
LIMIT 10;
