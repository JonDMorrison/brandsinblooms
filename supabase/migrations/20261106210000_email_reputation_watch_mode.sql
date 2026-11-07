-- Email reputation scores: restart scoring in watch mode.
--
-- refresh_email_governance_tenant_reputation_score() works in production
-- (it reads email_governance_email_events directly), but nothing has called
-- it since 2026-03-20: the 6-hourly cron job, the bulk refresh function it
-- called, and the hard-stop pieces are gone from production. Scores were
-- frozen and every other tenant reads as the default 100.
--
-- The score drives get_tenant_reputation_policy(), which the send paths use
-- to throttle (< 90) and pause (< 60) sending. Restarting scoring would
-- immediately start enforcing on live customers, so this migration adds an
-- explicit switch, system_config 'email_reputation_enforcement', created in
-- 'observe' mode (decided by the owner, 2026-11-06):
--   * observe: scores are computed every 6 hours and shown, the policy always
--     returns normal/allow, and tenants under 75 are raised to staff as a
--     Bloom Support alert (daily digest). No customer is emailed.
--   * enforce: the policy applies the score bands exactly as before.
-- Turning enforcement on is a one-row update:
--   UPDATE public.system_config SET value = '{"mode":"enforce"}' WHERE key = 'email_reputation_enforcement';

INSERT INTO public.system_config (key, value, description, updated_at)
VALUES (
  'email_reputation_enforcement',
  '{"mode":"observe"}'::jsonb,
  'observe: reputation scores are computed and shown but never throttle or pause sending. enforce: get_tenant_reputation_policy applies the score bands.',
  now()
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.email_reputation_enforcement_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT c.value->>'mode' = 'enforce' FROM public.system_config c WHERE c.key = 'email_reputation_enforcement'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.email_reputation_enforcement_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_reputation_enforcement_enabled() TO authenticated, service_role;

-- Same bands as the live production policy; in observe mode the real score is
-- returned but the tier/limits are always the normal ones.
CREATE OR REPLACE FUNCTION public.get_tenant_reputation_policy(p_tenant_id uuid)
RETURNS TABLE(tenant_id uuid, score integer, tier text, action text, recipient_cap integer, job_batch_size integer, send_pacing_multiplier numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_score INTEGER := 100;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'p_tenant_id is required'; END IF;
  SELECT s.score INTO v_score FROM public.email_governance_tenant_reputation_scores s WHERE s.tenant_id = p_tenant_id LIMIT 1;
  v_score := COALESCE(v_score, 100);
  tenant_id := p_tenant_id; score := v_score;
  IF NOT public.email_reputation_enforcement_enabled() OR v_score >= 90 THEN
    tier := 'normal'; action := 'allow'; recipient_cap := NULL; job_batch_size := 50; send_pacing_multiplier := 1;
  ELSIF v_score >= 75 THEN
    tier := 'throttled'; action := 'throttle'; recipient_cap := 10000; job_batch_size := 25; send_pacing_multiplier := 2;
  ELSIF v_score >= 60 THEN
    tier := 'restricted'; action := 'throttle'; recipient_cap := 2000; job_batch_size := 10; send_pacing_multiplier := 4;
  ELSE
    tier := 'critical'; action := 'pause'; recipient_cap := 0; job_batch_size := 10; send_pacing_multiplier := 4;
  END IF;
  RETURN NEXT;
END;
$function$;

-- Bulk refresh: every tenant that sent in the last 30 days or already has a
-- score. Tenants under 75 become one staff alert per run.
CREATE OR REPLACE FUNCTION public.refresh_email_governance_all_tenant_reputation_scores(
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_as_of TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_tenant UUID;
  v_result JSONB;
  v_refreshed INTEGER := 0;
  v_failed INTEGER := 0;
  v_low JSONB := '[]'::jsonb;
BEGIN
  FOR v_tenant IN
    SELECT DISTINCT e.tenant_id
    FROM public.email_governance_email_events e
    WHERE COALESCE(e.event_ts_provider, e.ingested_at) >= v_as_of - INTERVAL '30 days'
      AND e.tenant_id IS NOT NULL
    UNION
    SELECT s.tenant_id FROM public.email_governance_tenant_reputation_scores s
  LOOP
    BEGIN
      v_result := public.refresh_email_governance_tenant_reputation_score(v_tenant, v_as_of);
      v_refreshed := v_refreshed + 1;
      IF (v_result->>'score')::int < 75 THEN
        v_low := v_low || jsonb_build_array(jsonb_build_object(
          'tenant_id', v_tenant,
          'tenant_name', (SELECT t.name FROM public.tenants t WHERE t.id = v_tenant),
          'score', (v_result->>'score')::int,
          'status', v_result->>'status',
          'inputs', v_result->'inputs'
        ));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'reputation refresh failed for tenant %: %', v_tenant, SQLERRM;
    END;
  END LOOP;

  IF jsonb_array_length(v_low) > 0 THEN
    INSERT INTO bloom_support.alerts (condition, detail, dedupe_key)
    VALUES (
      'email_reputation_low',
      jsonb_build_object(
        'tenants', v_low,
        'enforcing', public.email_reputation_enforcement_enabled(),
        'summary', jsonb_array_length(v_low) || ' business(es) have an email reputation score under 75.'
      ),
      'email_reputation_low:' || to_char(v_as_of AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24')
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('as_of', v_as_of, 'refreshed', v_refreshed, 'failed', v_failed, 'low', v_low);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_email_governance_all_tenant_reputation_scores(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_email_governance_all_tenant_reputation_scores(TIMESTAMPTZ) TO service_role;

-- Every 6 hours, in the database (the old edge-function job also emailed
-- customers about hard stops; that path is not restarted).
DO $$
BEGIN
  PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'email-reputation-refresh-6h';
  PERFORM cron.schedule(
    'email-reputation-refresh-6h',
    '17 */6 * * *',
    $cron$SELECT public.refresh_email_governance_all_tenant_reputation_scores(now());$cron$
  );
END $$;
