-- FB-001: Form Builder schema hardening, retry RPC, and realtime publication

ALTER TABLE public.form_rate_limits
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.form_rate_limits
SET updated_at = COALESCE(updated_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.form_rate_limits
ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.form_rate_limits
ALTER COLUMN updated_at SET NOT NULL;

COMMENT ON COLUMN public.form_rate_limits.updated_at IS
'Last time the rate limit counter was updated. Required by upsert_rate_limit().';

CREATE OR REPLACE FUNCTION public.increment_trigger_event_retry(
  p_event_id UUID,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.automation_trigger_events
  SET retry_count = COALESCE(retry_count, 0) + 1,
      last_error_at = now(),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{last_error}',
        to_jsonb(COALESCE(p_error_message, 'Unknown error')),
        true
      )
  WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_trigger_event_retry(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.increment_trigger_event_retry(UUID, TEXT) IS
'Atomically increments automation_trigger_events.retry_count and records the last processing error.';

ALTER TABLE public.form_submissions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'form_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.form_submissions;
  END IF;
END $$;