-- Milestone 5: Tenant Reputation Score Engine (advisory-only)
-- Adds current + historical reputation score storage and scoring RPCs.

-- 1) Spamtrap signal on governance events (derived from webhook payload heuristics)
ALTER TABLE public.email_governance_email_events
  ADD COLUMN IF NOT EXISTS is_spam_trap BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_gov_events_tenant_spamtrap_time
  ON public.email_governance_email_events (tenant_id, is_spam_trap, event_ts_provider DESC, ingested_at DESC)
  WHERE is_spam_trap = true;

-- 2) Current reputation score table (one row per tenant)
CREATE TABLE IF NOT EXISTS public.email_governance_tenant_reputation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'risk', 'critical')),
  as_of TIMESTAMPTZ NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  penalties JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_email_gov_reputation_scores_status
  ON public.email_governance_tenant_reputation_scores (status, score, computed_at DESC);

-- 3) Historical trend table (append-only)
CREATE TABLE IF NOT EXISTS public.email_governance_tenant_reputation_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'risk', 'critical')),
  as_of TIMESTAMPTZ NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  penalties JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, as_of)
);

CREATE INDEX IF NOT EXISTS idx_email_gov_reputation_score_history_tenant_asof
  ON public.email_governance_tenant_reputation_score_history (tenant_id, as_of DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_reputation_score_history_tenant_computed
  ON public.email_governance_tenant_reputation_score_history (tenant_id, computed_at DESC);

-- 4) RLS
ALTER TABLE public.email_governance_tenant_reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_tenant_reputation_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_gov_reputation_scores_select" ON public.email_governance_tenant_reputation_scores;
CREATE POLICY "email_gov_reputation_scores_select"
  ON public.email_governance_tenant_reputation_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_tenant_reputation_scores.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_reputation_scores_service_all" ON public.email_governance_tenant_reputation_scores;
CREATE POLICY "email_gov_reputation_scores_service_all"
  ON public.email_governance_tenant_reputation_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "email_gov_reputation_score_history_select" ON public.email_governance_tenant_reputation_score_history;
CREATE POLICY "email_gov_reputation_score_history_select"
  ON public.email_governance_tenant_reputation_score_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_tenant_reputation_score_history.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_reputation_score_history_service_all" ON public.email_governance_tenant_reputation_score_history;
CREATE POLICY "email_gov_reputation_score_history_service_all"
  ON public.email_governance_tenant_reputation_score_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_gov_reputation_scores_updated_at') THEN
    CREATE TRIGGER update_email_gov_reputation_scores_updated_at
      BEFORE UPDATE ON public.email_governance_tenant_reputation_scores
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 5) Compute + persist one tenant score
CREATE OR REPLACE FUNCTION public.refresh_email_governance_tenant_reputation_score(
  p_tenant_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_24h RECORD;
  v_snapshot_30d RECORD;
  v_sent_24h INTEGER := 0;
  v_sent_30d INTEGER := 0;
  v_bounce_rate_24h NUMERIC := 0;
  v_complaint_rate_24h NUMERIC := 0;
  v_unsub_rate_24h NUMERIC := 0;
  v_unsub_rate_30d NUMERIC := 0;
  v_spamtrap_hits_24h INTEGER := 0;
  v_spamtrap_hits_30d INTEGER := 0;
  v_suppressed_attempts_24h INTEGER := 0;
  v_suppressed_attempts_30d INTEGER := 0;
  v_bounce_pct NUMERIC := 0;
  v_complaint_pct NUMERIC := 0;
  v_unsub_spike_pct NUMERIC := 0;
  v_penalty_bounce NUMERIC := 0;
  v_penalty_complaint NUMERIC := 0;
  v_penalty_spamtrap NUMERIC := 0;
  v_penalty_suppressed NUMERIC := 0;
  v_penalty_unsub_spike NUMERIC := 0;
  v_penalty_total NUMERIC := 0;
  v_score INTEGER := 100;
  v_status TEXT := 'healthy';
  v_inputs JSONB;
  v_penalties JSONB;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  -- Ensure 24h and 30d snapshots are up to date at the same as_of anchor.
  PERFORM public.refresh_email_governance_tenant_reputation_snapshot(p_tenant_id, p_as_of);

  SELECT * INTO v_snapshot_24h
  FROM public.email_governance_tenant_reputation_snapshots s
  WHERE s.tenant_id = p_tenant_id
    AND s.window_key = '24h'
    AND s.as_of <= p_as_of
  ORDER BY s.as_of DESC
  LIMIT 1;

  SELECT * INTO v_snapshot_30d
  FROM public.email_governance_tenant_reputation_snapshots s
  WHERE s.tenant_id = p_tenant_id
    AND s.window_key = '30d'
    AND s.as_of <= p_as_of
  ORDER BY s.as_of DESC
  LIMIT 1;

  v_sent_24h := COALESCE(v_snapshot_24h.sent_count, 0);
  v_sent_30d := COALESCE(v_snapshot_30d.sent_count, 0);

  v_bounce_rate_24h := COALESCE(v_snapshot_24h.bounce_rate, 0);
  v_complaint_rate_24h := COALESCE(v_snapshot_24h.complaint_rate, 0);

  v_unsub_rate_24h := COALESCE(v_snapshot_24h.unsubscribed_count, 0)::NUMERIC / GREATEST(v_sent_24h, 1);
  v_unsub_rate_30d := COALESCE(v_snapshot_30d.unsubscribed_count, 0)::NUMERIC / GREATEST(v_sent_30d, 1);

  -- Spam trap signal is derived from webhook payload heuristics and stored in governance events.
  SELECT COUNT(*)::INTEGER INTO v_spamtrap_hits_24h
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = p_tenant_id
    AND e.is_spam_trap = true
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= (p_as_of - INTERVAL '24 hours')
    AND COALESCE(e.event_ts_provider, e.ingested_at) <= p_as_of;

  SELECT COUNT(*)::INTEGER INTO v_spamtrap_hits_30d
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = p_tenant_id
    AND e.is_spam_trap = true
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= (p_as_of - INTERVAL '30 days')
    AND COALESCE(e.event_ts_provider, e.ingested_at) <= p_as_of;

  -- Suppressed-send attempts: blocked before send in campaign/queue pathways.
  SELECT COUNT(*)::INTEGER INTO v_suppressed_attempts_24h
  FROM public.email_send_skips s
  WHERE s.tenant_id = p_tenant_id
    AND s.reason IN ('unsubscribed', 'bounced', 'complained', 'globally_blocked', 'suppressed')
    AND s.created_at >= (p_as_of - INTERVAL '24 hours')
    AND s.created_at <= p_as_of;

  SELECT COUNT(*)::INTEGER INTO v_suppressed_attempts_30d
  FROM public.email_send_skips s
  WHERE s.tenant_id = p_tenant_id
    AND s.reason IN ('unsubscribed', 'bounced', 'complained', 'globally_blocked', 'suppressed')
    AND s.created_at >= (p_as_of - INTERVAL '30 days')
    AND s.created_at <= p_as_of;

  -- Convert rates (stored as fractions) into percentages.
  v_bounce_pct := v_bounce_rate_24h * 100;
  v_complaint_pct := v_complaint_rate_24h * 100;

  -- Deductions from policy:
  -- bounce: -2 points per 1%
  -- complaint: -5 points per 0.1% (== 50 points per 1%)
  -- spam trap: -25 if any hit in last 30d
  -- suppressed-send attempts: -10 per event (24h)
  -- unsubscribe spike: -5 per 2% above baseline (24h vs 30d)
  v_penalty_bounce := GREATEST(v_bounce_pct, 0) * 2;
  v_penalty_complaint := GREATEST(v_complaint_pct, 0) * 50;
  v_penalty_spamtrap := CASE WHEN v_spamtrap_hits_30d > 0 THEN 25 ELSE 0 END;
  v_penalty_suppressed := GREATEST(v_suppressed_attempts_24h, 0) * 10;

  v_unsub_spike_pct := GREATEST((v_unsub_rate_24h - v_unsub_rate_30d) * 100, 0);
  v_penalty_unsub_spike := v_unsub_spike_pct * 2.5;

  v_penalty_total :=
    COALESCE(v_penalty_bounce, 0) +
    COALESCE(v_penalty_complaint, 0) +
    COALESCE(v_penalty_spamtrap, 0) +
    COALESCE(v_penalty_suppressed, 0) +
    COALESCE(v_penalty_unsub_spike, 0);

  v_score := LEAST(100, GREATEST(0, ROUND(100 - v_penalty_total)::INTEGER));

  v_status := CASE
    WHEN v_score >= 90 THEN 'healthy'
    WHEN v_score >= 75 THEN 'warning'
    WHEN v_score >= 60 THEN 'risk'
    ELSE 'critical'
  END;

  v_inputs := jsonb_build_object(
    'as_of', p_as_of,
    'window_24h', jsonb_build_object(
      'sent_count', v_sent_24h,
      'bounce_rate', v_bounce_rate_24h,
      'complaint_rate', v_complaint_rate_24h,
      'unsub_rate', v_unsub_rate_24h,
      'spamtrap_hits', v_spamtrap_hits_24h,
      'suppressed_send_attempts', v_suppressed_attempts_24h
    ),
    'window_30d', jsonb_build_object(
      'sent_count', v_sent_30d,
      'unsub_rate', v_unsub_rate_30d,
      'spamtrap_hits', v_spamtrap_hits_30d,
      'suppressed_send_attempts', v_suppressed_attempts_30d
    )
  );

  v_penalties := jsonb_build_object(
    'bounce', ROUND(v_penalty_bounce, 4),
    'complaint', ROUND(v_penalty_complaint, 4),
    'spam_trap', ROUND(v_penalty_spamtrap, 4),
    'suppressed_send_attempts', ROUND(v_penalty_suppressed, 4),
    'unsubscribe_spike', ROUND(v_penalty_unsub_spike, 4),
    'unsubscribe_spike_pct', ROUND(v_unsub_spike_pct, 4),
    'total', ROUND(v_penalty_total, 4)
  );

  INSERT INTO public.email_governance_tenant_reputation_scores (
    tenant_id,
    score,
    status,
    as_of,
    inputs,
    penalties,
    computed_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    v_score,
    v_status,
    p_as_of,
    v_inputs,
    v_penalties,
    now(),
    now()
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    status = EXCLUDED.status,
    as_of = EXCLUDED.as_of,
    inputs = EXCLUDED.inputs,
    penalties = EXCLUDED.penalties,
    computed_at = EXCLUDED.computed_at,
    updated_at = now();

  INSERT INTO public.email_governance_tenant_reputation_score_history (
    tenant_id,
    score,
    status,
    as_of,
    inputs,
    penalties,
    computed_at
  ) VALUES (
    p_tenant_id,
    v_score,
    v_status,
    p_as_of,
    v_inputs,
    v_penalties,
    now()
  )
  ON CONFLICT (tenant_id, as_of)
  DO UPDATE SET
    score = EXCLUDED.score,
    status = EXCLUDED.status,
    inputs = EXCLUDED.inputs,
    penalties = EXCLUDED.penalties,
    computed_at = EXCLUDED.computed_at;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'score', v_score,
    'status', v_status,
    'as_of', p_as_of,
    'inputs', v_inputs,
    'penalties', v_penalties
  );
END;
$$;

-- 6) Bulk refresh helper for cron jobs
CREATE OR REPLACE FUNCTION public.refresh_email_governance_all_tenant_reputation_scores(
  p_as_of TIMESTAMPTZ DEFAULT now(),
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  tenant_id UUID,
  score INTEGER,
  status TEXT,
  as_of TIMESTAMPTZ,
  computed_at TIMESTAMPTZ,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_result JSONB;
BEGIN
  FOR v_tenant IN
    SELECT t.id
    FROM public.tenants t
    ORDER BY t.id
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    LIMIT COALESCE(p_limit, 1000000)
  LOOP
    BEGIN
      v_result := public.refresh_email_governance_tenant_reputation_score(v_tenant.id, p_as_of);

      tenant_id := v_tenant.id;
      score := COALESCE((v_result->>'score')::INTEGER, 0);
      status := COALESCE(v_result->>'status', 'critical');
      as_of := COALESCE((v_result->>'as_of')::timestamptz, p_as_of);
      computed_at := now();
      error := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      tenant_id := v_tenant.id;
      score := NULL;
      status := NULL;
      as_of := p_as_of;
      computed_at := now();
      error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_email_governance_tenant_reputation_score(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_email_governance_tenant_reputation_score(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_email_governance_all_tenant_reputation_scores(TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_email_governance_all_tenant_reputation_scores(TIMESTAMPTZ, INTEGER, INTEGER) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN NULL;
END;
$$;
