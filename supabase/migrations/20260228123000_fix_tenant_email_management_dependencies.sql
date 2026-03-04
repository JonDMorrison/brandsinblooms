-- Repair migration: dependencies for tenant email management.
--
-- Fixes runtime errors when calling tenant email management RPCs:
--   - relation "public.email_governance_campaign_intervention_state" does not exist
--   - function public.refresh_email_governance_tenant_reputation_score(uuid, timestamptz) does not exist

-- 1) Campaign intervention state table (milestone 8 canonical structure)
CREATE TABLE IF NOT EXISTS public.email_governance_campaign_intervention_state (
  campaign_id UUID PRIMARY KEY REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  admin_paused BOOLEAN NOT NULL DEFAULT false,
  force_stopped BOOLEAN NOT NULL DEFAULT false,
  autopause_override_enabled BOOLEAN NOT NULL DEFAULT false,
  autopause_override_precedence TEXT NOT NULL DEFAULT 'automation_allowed',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES auth.users(id),
  updated_reason TEXT NULL,
  CONSTRAINT email_governance_campaign_intervention_state_precedence_check
    CHECK (autopause_override_precedence IN ('final_override', 'automation_allowed'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_intervention_state_tenant
  ON public.email_governance_campaign_intervention_state(tenant_id);

CREATE INDEX IF NOT EXISTS idx_campaign_intervention_state_effective
  ON public.email_governance_campaign_intervention_state(tenant_id, admin_paused, force_stopped, autopause_override_enabled, autopause_override_precedence);

ALTER TABLE public.email_governance_campaign_intervention_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_intervention_state_master_admin_select ON public.email_governance_campaign_intervention_state;
CREATE POLICY campaign_intervention_state_master_admin_select
  ON public.email_governance_campaign_intervention_state
  FOR SELECT
  USING (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS campaign_intervention_state_master_admin_insert ON public.email_governance_campaign_intervention_state;
CREATE POLICY campaign_intervention_state_master_admin_insert
  ON public.email_governance_campaign_intervention_state
  FOR INSERT
  WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS campaign_intervention_state_master_admin_update ON public.email_governance_campaign_intervention_state;
CREATE POLICY campaign_intervention_state_master_admin_update
  ON public.email_governance_campaign_intervention_state
  FOR UPDATE
  USING (public.is_master_admin(auth.uid()))
  WITH CHECK (public.is_master_admin(auth.uid()));


-- 2) Reputation score storage tables (minimal, compatible with panel RPC)
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

ALTER TABLE public.email_governance_tenant_reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_tenant_reputation_score_history ENABLE ROW LEVEL SECURITY;

-- RLS: tenant can read their own scores; service_role can manage all.
DROP POLICY IF EXISTS email_gov_reputation_scores_select ON public.email_governance_tenant_reputation_scores;
CREATE POLICY email_gov_reputation_scores_select
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

DROP POLICY IF EXISTS email_gov_reputation_scores_service_all ON public.email_governance_tenant_reputation_scores;
CREATE POLICY email_gov_reputation_scores_service_all
  ON public.email_governance_tenant_reputation_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS email_gov_reputation_score_history_select ON public.email_governance_tenant_reputation_score_history;
CREATE POLICY email_gov_reputation_score_history_select
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

DROP POLICY IF EXISTS email_gov_reputation_score_history_service_all ON public.email_governance_tenant_reputation_score_history;
CREATE POLICY email_gov_reputation_score_history_service_all
  ON public.email_governance_tenant_reputation_score_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 3) Refresh function (lightweight implementation to avoid missing snapshot dependencies)
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
  v_window_end TIMESTAMPTZ := COALESCE(p_as_of, now());
  v_24_start TIMESTAMPTZ := COALESCE(p_as_of, now()) - INTERVAL '24 hours';
  v_30_start TIMESTAMPTZ := COALESCE(p_as_of, now()) - INTERVAL '30 days';

  v_sent_24h INTEGER := 0;
  v_hard_bounce_24h INTEGER := 0;
  v_complaint_24h INTEGER := 0;
  v_unsub_24h INTEGER := 0;

  v_sent_30d INTEGER := 0;
  v_unsub_30d INTEGER := 0;

  v_bounce_rate_24h NUMERIC := 0;
  v_complaint_rate_24h NUMERIC := 0;
  v_unsub_rate_24h NUMERIC := 0;
  v_unsub_rate_30d NUMERIC := 0;

  v_penalty_bounce NUMERIC := 0;
  v_penalty_complaint NUMERIC := 0;
  v_penalty_unsub_spike NUMERIC := 0;
  v_penalty_total NUMERIC := 0;

  v_score INTEGER := 100;
  v_status TEXT := 'healthy';
  v_inputs JSONB := '{}'::jsonb;
  v_penalties JSONB := '{}'::jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  -- 24h window
  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (
      WHERE e.event_type = 'bounced'
        AND COALESCE(e.event_data->>'bounce_severity', '') = 'hard'
    )::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'complained')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'unsubscribed')::INTEGER
  INTO
    v_sent_24h,
    v_hard_bounce_24h,
    v_complaint_24h,
    v_unsub_24h
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = p_tenant_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_24_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end;

  -- 30d window (only sent + unsub are needed for spike indicator)
  SELECT
    COUNT(*) FILTER (WHERE e.event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE e.event_type = 'unsubscribed')::INTEGER
  INTO
    v_sent_30d,
    v_unsub_30d
  FROM public.email_governance_email_events e
  WHERE e.tenant_id = p_tenant_id
    AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_30_start
    AND COALESCE(e.event_ts_provider, e.ingested_at) < v_window_end;

  v_bounce_rate_24h := COALESCE(v_hard_bounce_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1);
  v_complaint_rate_24h := COALESCE(v_complaint_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1);
  v_unsub_rate_24h := COALESCE(v_unsub_24h, 0)::NUMERIC / GREATEST(COALESCE(v_sent_24h, 0), 1);
  v_unsub_rate_30d := COALESCE(v_unsub_30d, 0)::NUMERIC / GREATEST(COALESCE(v_sent_30d, 0), 1);

  -- Simple, bounded penalties (keeps function stable even if upstream scoring engine isn't present).
  v_penalty_bounce := LEAST(60, GREATEST(0, (v_bounce_rate_24h * 1000)));      -- 1% => 10
  v_penalty_complaint := LEAST(80, GREATEST(0, (v_complaint_rate_24h * 5000))); -- 0.2% => 10
  v_penalty_unsub_spike := LEAST(
    40,
    GREATEST(0, ((v_unsub_rate_24h - v_unsub_rate_30d) * 2000))                -- 0.5% spike => 10
  );

  v_penalty_total := COALESCE(v_penalty_bounce, 0) + COALESCE(v_penalty_complaint, 0) + COALESCE(v_penalty_unsub_spike, 0);
  v_score := GREATEST(0, LEAST(100, (100 - CEIL(v_penalty_total))::INTEGER));

  v_status := CASE
    WHEN v_score >= 80 THEN 'healthy'
    WHEN v_score >= 60 THEN 'warning'
    WHEN v_score >= 40 THEN 'risk'
    ELSE 'critical'
  END;

  v_inputs := jsonb_build_object(
    'window_end', v_window_end,
    'sent_24h', COALESCE(v_sent_24h, 0),
    'hard_bounce_24h', COALESCE(v_hard_bounce_24h, 0),
    'complaint_24h', COALESCE(v_complaint_24h, 0),
    'unsub_24h', COALESCE(v_unsub_24h, 0),
    'sent_30d', COALESCE(v_sent_30d, 0),
    'unsub_30d', COALESCE(v_unsub_30d, 0),
    'bounce_rate_24h', v_bounce_rate_24h,
    'complaint_rate_24h', v_complaint_rate_24h,
    'unsub_rate_24h', v_unsub_rate_24h,
    'unsub_rate_30d', v_unsub_rate_30d
  );

  v_penalties := jsonb_build_object(
    'bounce_penalty', v_penalty_bounce,
    'complaint_penalty', v_penalty_complaint,
    'unsub_spike_penalty', v_penalty_unsub_spike,
    'total_penalty', v_penalty_total
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
    v_window_end,
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
    updated_at = EXCLUDED.updated_at;

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
    v_window_end,
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
    'as_of', v_window_end,
    'inputs', v_inputs,
    'penalties', v_penalties
  );
END;
$$;

-- Allow internal/admin usage; service_role always allowed.
GRANT EXECUTE ON FUNCTION public.refresh_email_governance_tenant_reputation_score(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_email_governance_tenant_reputation_score(UUID, TIMESTAMPTZ) TO service_role;

NOTIFY pgrst, 'reload schema';
