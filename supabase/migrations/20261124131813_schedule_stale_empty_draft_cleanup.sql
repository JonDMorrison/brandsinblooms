-- #8: run the empty-draft clean-up nightly for every tenant.
--
-- public.delete_stale_empty_campaign_drafts (20261123174042) deletes only
-- drafts that were never scheduled or sent, have no subject, no visible
-- content, were not edited for 24 hours, and are not referenced by a copy,
-- a push message or a website review.
--
-- First run when written (dry run, 2026-11-24): 4 drafts at 3 tenants.

CREATE OR REPLACE FUNCTION public.run_stale_empty_campaign_draft_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant uuid;
  v_deleted integer := 0;
  v_count integer;
BEGIN
  FOR v_tenant IN
    SELECT DISTINCT c.tenant_id
      FROM public.crm_campaigns c
     WHERE c.status = 'draft'
       AND c.tenant_id IS NOT NULL
  LOOP
    SELECT count(*) FILTER (WHERE d.was_deleted)
      INTO v_count
      FROM public.delete_stale_empty_campaign_drafts(v_tenant, false) d;
    v_deleted := v_deleted + coalesce(v_count, 0);
  END LOOP;
  RETURN v_deleted;
END $$;

REVOKE ALL ON FUNCTION public.run_stale_empty_campaign_draft_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_stale_empty_campaign_draft_cleanup() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stale-empty-campaign-draft-cleanup') THEN
    PERFORM cron.unschedule('stale-empty-campaign-draft-cleanup');
  END IF;
  -- 07:17 UTC = 2:17 AM US Eastern, outside business hours.
  PERFORM cron.schedule(
    'stale-empty-campaign-draft-cleanup',
    '17 7 * * *',
    'SELECT public.run_stale_empty_campaign_draft_cleanup();'
  );
END $$;
