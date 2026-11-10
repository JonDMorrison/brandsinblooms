-- Retire BloomSuite's legacy social-media subsystem while preserving historical
-- records for audit and support purposes.

UPDATE public.social_connections
SET
  access_token = 'RETIRED',
  refresh_token = NULL,
  is_active = false,
  expires_at = now(),
  deleted_at = COALESCE(deleted_at, now()),
  updated_at = now()
WHERE access_token <> 'RETIRED'
   OR refresh_token IS NOT NULL
   OR is_active
   OR deleted_at IS NULL;

UPDATE public.scheduled_posts
SET
  status = 'ERROR'::public.post_status,
  error_message = 'Social media management retired from BloomSuite',
  updated_at = now()
WHERE status = 'QUEUED'::public.post_status;

UPDATE public.social_posts
SET
  status = 'failed',
  error_message = 'Social media management retired from BloomSuite',
  updated_at = now()
WHERE status = 'queued';

UPDATE public.content_tasks
SET
  status = CASE
    WHEN lower(COALESCE(status, '')) IN ('pending', 'planned', 'review', 'approved')
      THEN 'failed'
    ELSE status
  END,
  posting_disabled_at = COALESCE(posting_disabled_at, now()),
  last_posting_error = 'Social media management retired from BloomSuite'
WHERE lower(COALESCE(post_type, '')) IN (
  'facebook',
  'instagram',
  'social',
  'social_post',
  'social_caption'
);

ALTER TABLE public.content_tasks
  DROP CONSTRAINT IF EXISTS content_tasks_social_media_retired;

CREATE OR REPLACE FUNCTION public.reject_retired_social_content_task()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF lower(COALESCE(NEW.post_type, '')) IN (
    'facebook',
    'instagram',
    'social',
    'social_post',
    'social_caption'
  ) THEN
    RAISE EXCEPTION 'Social media management has been retired from BloomSuite'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_retired_social_content_task() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_retired_social_content_task() FROM anon, authenticated;

DROP TRIGGER IF EXISTS reject_retired_social_content_task
  ON public.content_tasks;
CREATE TRIGGER reject_retired_social_content_task
  BEFORE INSERT OR UPDATE OF post_type ON public.content_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_retired_social_content_task();

DROP POLICY IF EXISTS "Users can manage their own social connections"
  ON public.social_connections;
DROP POLICY IF EXISTS "Users can create their own scheduled posts"
  ON public.scheduled_posts;
DROP POLICY IF EXISTS "Users can delete their own scheduled posts"
  ON public.scheduled_posts;
DROP POLICY IF EXISTS "Users can update their own scheduled posts"
  ON public.scheduled_posts;
DROP POLICY IF EXISTS "Users can view their own scheduled posts"
  ON public.scheduled_posts;
DROP POLICY IF EXISTS "Users can create their own social posts"
  ON public.social_posts;
DROP POLICY IF EXISTS "Users can delete their own social posts"
  ON public.social_posts;
DROP POLICY IF EXISTS "Users can update their own social posts"
  ON public.social_posts;
DROP POLICY IF EXISTS "Users can view their own social posts"
  ON public.social_posts;

REVOKE ALL ON TABLE public.social_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.scheduled_posts FROM anon, authenticated;
REVOKE ALL ON TABLE public.social_posts FROM anon, authenticated;

REVOKE INSERT, UPDATE ON TABLE public.social_connections FROM service_role;
REVOKE INSERT, UPDATE ON TABLE public.scheduled_posts FROM service_role;
REVOKE INSERT, UPDATE ON TABLE public.social_posts FROM service_role;
GRANT SELECT, DELETE ON TABLE public.social_connections TO service_role;
GRANT SELECT, DELETE ON TABLE public.scheduled_posts TO service_role;
GRANT SELECT, DELETE ON TABLE public.social_posts TO service_role;

COMMENT ON TABLE public.social_connections IS
  'Archived social-media connections. BloomSuite retired social management on 2026-09-03; credentials were invalidated and new writes are disabled.';
COMMENT ON TABLE public.scheduled_posts IS
  'Archived legacy social publishing schedule. New social publishing is disabled.';
COMMENT ON TABLE public.social_posts IS
  'Archived social publishing history. New social publishing is disabled.';
COMMENT ON FUNCTION public.reject_retired_social_content_task() IS
  'Prevents new Facebook, Instagram, and generic social content tasks while allowing unrelated maintenance of historical rows.';
