-- Backfill crm_campaigns tenant_id/user_id using related tables.
-- Purpose: fix legacy rows where tenant_id/user_id are NULL (causing RLS + schedule RPC authorization failures).

ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

-- 1) Backfill from linked content task (most reliable when present)
UPDATE public.crm_campaigns c
SET
  tenant_id = COALESCE(c.tenant_id, t.tenant_id),
  user_id = COALESCE(c.user_id, t.created_by_user_id, t.user_id)
FROM public.content_tasks t
WHERE c.source_content_task_id = t.id
  AND (c.tenant_id IS NULL OR c.user_id IS NULL)
  AND (t.tenant_id IS NOT NULL OR t.created_by_user_id IS NOT NULL OR t.user_id IS NOT NULL);

-- 2) Backfill tenant/user from single segment_id
UPDATE public.crm_campaigns c
SET
  tenant_id = COALESCE(c.tenant_id, s.tenant_id),
  user_id = COALESCE(c.user_id, s.user_id)
FROM public.crm_segments s
WHERE c.segment_id = s.id
  AND (c.tenant_id IS NULL OR c.user_id IS NULL)
  AND (s.tenant_id IS NOT NULL OR s.user_id IS NOT NULL);

-- 3) Backfill tenant/user from multi-segment links (campaign_segments)
UPDATE public.crm_campaigns c
SET
  tenant_id = COALESCE(c.tenant_id, s.tenant_id),
  user_id = COALESCE(c.user_id, s.user_id)
FROM public.campaign_segments cs
JOIN public.crm_segments s ON s.id = cs.segment_id
WHERE cs.campaign_id = c.id
  AND (c.tenant_id IS NULL OR c.user_id IS NULL)
  AND (s.tenant_id IS NOT NULL OR s.user_id IS NOT NULL);

-- 4) Last resort: if user_id is set but tenant_id is missing, infer tenant_id from public.users
UPDATE public.crm_campaigns c
SET tenant_id = COALESCE(c.tenant_id, u.tenant_id)
FROM public.users u
WHERE c.user_id = u.id
  AND c.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL;

-- Reload PostgREST schema cache
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;
