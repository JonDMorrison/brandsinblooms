
-- Step 1: Schema sanity check - Verify tenant_id columns exist and are properly configured
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'campaigns', 'content_tasks', 'holiday_tasks')
  AND column_name = 'tenant_id'
ORDER BY table_name;

-- Step 2: Check foreign key constraints to tenants table
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('users', 'campaigns', 'content_tasks', 'holiday_tasks')
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'tenant_id';

-- Step 3: Null/orphan scan - Check for NULL tenant_id values
SELECT 
  'users' AS table_name, 
  COUNT(*) AS null_tenant_rows
FROM users 
WHERE tenant_id IS NULL
UNION ALL
SELECT 
  'campaigns', 
  COUNT(*)
FROM campaigns 
WHERE tenant_id IS NULL
UNION ALL
SELECT 
  'content_tasks', 
  COUNT(*)
FROM content_tasks 
WHERE tenant_id IS NULL
UNION ALL
SELECT 
  'holiday_tasks', 
  COUNT(*)
FROM holiday_tasks 
WHERE tenant_id IS NULL;

-- Step 4: Check for orphaned records (tenant_id references non-existent tenants)
SELECT 
  'users' AS table_name,
  COUNT(*) AS orphaned_rows
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.tenant_id IS NOT NULL AND t.id IS NULL
UNION ALL
SELECT 
  'campaigns',
  COUNT(*)
FROM campaigns c
LEFT JOIN tenants t ON c.tenant_id = t.id
WHERE c.tenant_id IS NOT NULL AND t.id IS NULL
UNION ALL
SELECT 
  'content_tasks',
  COUNT(*)
FROM content_tasks ct
LEFT JOIN tenants t ON ct.tenant_id = t.id
WHERE ct.tenant_id IS NOT NULL AND t.id IS NULL
UNION ALL
SELECT 
  'holiday_tasks',
  COUNT(*)
FROM holiday_tasks ht
LEFT JOIN tenants t ON ht.tenant_id = t.id
WHERE ht.tenant_id IS NOT NULL AND t.id IS NULL;

-- Step 5: Verify tenants table has data
SELECT 
  COUNT(*) AS total_tenants,
  COUNT(CASE WHEN is_active = true THEN 1 END) AS active_tenants
FROM tenants;

-- Step 6: Show sample data distribution across tenants
SELECT 
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  t.is_active,
  COUNT(DISTINCT u.id) AS user_count,
  COUNT(DISTINCT c.id) AS campaign_count,
  COUNT(DISTINCT ct.id) AS content_task_count,
  COUNT(DISTINCT ht.id) AS holiday_task_count
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id
LEFT JOIN campaigns c ON c.tenant_id = t.id
LEFT JOIN content_tasks ct ON ct.tenant_id = t.id
LEFT JOIN holiday_tasks ht ON ht.tenant_id = t.id
GROUP BY t.id, t.name, t.slug, t.is_active
ORDER BY t.name;
