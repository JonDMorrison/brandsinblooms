-- Repair legacy calendar event rows that still have null tenant_id values.
-- These backfills align stored data with the tenant-scoped RLS and client filters.

UPDATE public.campaigns c
SET tenant_id = u.tenant_id
FROM public.users u
WHERE c.user_id = u.id
  AND c.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL;

UPDATE public.content_tasks t
SET tenant_id = c.tenant_id
FROM public.campaigns c
WHERE t.campaign_id = c.id
  AND c.tenant_id IS NOT NULL
  AND t.tenant_id IS NULL;

UPDATE public.content_tasks t
SET tenant_id = u.tenant_id
FROM public.users u
WHERE t.user_id = u.id
  AND t.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL;

UPDATE public.scheduled_posts sp
SET tenant_id = t.tenant_id
FROM public.content_tasks t
WHERE sp.content_id = t.id
  AND sp.tenant_id IS NULL
  AND t.tenant_id IS NOT NULL;

UPDATE public.scheduled_posts sp
SET tenant_id = u.tenant_id
FROM public.users u
WHERE sp.user_id = u.id
  AND sp.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL;