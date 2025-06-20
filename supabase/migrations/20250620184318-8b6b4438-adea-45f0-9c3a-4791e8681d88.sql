
SELECT 
  t.id                         AS tenant_id,
  t.name                       AS tenant_name,
  (SELECT count(*) FROM users        u WHERE u.tenant_id = t.id) AS users,
  (SELECT count(*) FROM campaigns    c WHERE c.tenant_id = t.id) AS campaigns,
  (SELECT count(*) FROM content_tasks ct WHERE ct.tenant_id = t.id) AS tasks,
  (SELECT count(*) FROM holiday_tasks ht WHERE ht.tenant_id = t.id) AS holiday_tasks
FROM tenants t
ORDER BY t.name
LIMIT 3;
