-- Forward-only repair migration.
-- Restores campaign send preflight RPCs expected by Edge Functions.

CREATE TABLE IF NOT EXISTS public.campaign_hygiene_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  audience_total INTEGER NOT NULL DEFAULT 0,
  duplicate_emails_count INTEGER NOT NULL DEFAULT 0,
  invalid_emails_count INTEGER NOT NULL DEFAULT 0,
  invalid_emails_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  suppressed_count INTEGER NOT NULL DEFAULT 0,
  inactive_count INTEGER NOT NULL DEFAULT 0,
  inactive_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  deliverability JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_hygiene_reports_campaign_created
  ON public.campaign_hygiene_reports (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_hygiene_reports_tenant_created
  ON public.campaign_hygiene_reports (tenant_id, created_at DESC);

DO $$
BEGIN
  ALTER TABLE public.campaign_hygiene_reports ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END;
$$;

-- Best-effort policy (optional); ignore if auth/users objects aren't present yet.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view hygiene reports for their tenant" ON public.campaign_hygiene_reports;
  CREATE POLICY "Users can view hygiene reports for their tenant"
    ON public.campaign_hygiene_reports FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_reputation_policy(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  score INTEGER,
  tier TEXT,
  action TEXT,
  recipient_cap INTEGER,
  job_batch_size INTEGER,
  send_pacing_multiplier NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_score INTEGER := 100;
  v_tier TEXT := 'normal';
  v_action TEXT := 'allow';
  v_recipient_cap INTEGER := NULL;
  v_job_batch_size INTEGER := 50;
  v_send_pacing_multiplier NUMERIC := 1;
  v_is_throttled BOOLEAN := false;
BEGIN
  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    SELECT
      COALESCE(p.score, 100),
      COALESCE(NULLIF(p.tier, ''), 'normal'),
      COALESCE(NULLIF(p.action, ''), 'allow'),
      p.recipient_cap,
      COALESCE(p.job_batch_size, 50),
      COALESCE(p.send_pacing_multiplier, 1)
    INTO
      v_score,
      v_tier,
      v_action,
      v_recipient_cap,
      v_job_batch_size,
      v_send_pacing_multiplier
    FROM public.get_tenant_reputation_policy(v_tenant_id) p;
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;

  BEGIN
    SELECT COALESCE(s.is_throttled, false)
    INTO v_is_throttled
    FROM public.email_governance_campaign_throttle_states s
    WHERE s.campaign_id = p_campaign_id;
  EXCEPTION
    WHEN undefined_table THEN
      v_is_throttled := false;
  END;

  IF COALESCE(v_is_throttled, false) THEN
    v_job_batch_size := GREATEST(1, FLOOR(COALESCE(v_job_batch_size, 50) * 0.5)::INTEGER);
    v_send_pacing_multiplier := GREATEST(COALESCE(v_send_pacing_multiplier, 1), 2);

    IF v_action = 'allow' THEN
      v_tier := 'throttled';
      v_action := 'throttle';
    END IF;
  END IF;

  campaign_id := p_campaign_id;
  tenant_id := v_tenant_id;
  score := v_score;
  tier := v_tier;
  action := v_action;
  recipient_cap := v_recipient_cap;
  job_batch_size := v_job_batch_size;
  send_pacing_multiplier := v_send_pacing_multiplier;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_reputation_policy(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_campaign_intervention_state(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  admin_paused BOOLEAN,
  force_stopped BOOLEAN,
  autopause_override_enabled BOOLEAN,
  autopause_override_precedence TEXT,
  autopause_override_final BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_tenant_id UUID;
  v_admin_paused BOOLEAN := false;
  v_force_stopped BOOLEAN := false;
  v_override_enabled BOOLEAN := false;
  v_override_precedence TEXT := 'automation_allowed';
BEGIN
  SELECT c.tenant_id
  INTO v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_tenant_id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    SELECT
      COALESCE(s.admin_paused, false),
      COALESCE(s.force_stopped, false),
      COALESCE(s.autopause_override_enabled, false),
      COALESCE(NULLIF(s.autopause_override_precedence, ''), 'automation_allowed')
    INTO
      v_admin_paused,
      v_force_stopped,
      v_override_enabled,
      v_override_precedence
    FROM public.email_governance_campaign_intervention_state s
    WHERE s.campaign_id = p_campaign_id;
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
  END;

  campaign_id := p_campaign_id;
  tenant_id := v_campaign_tenant_id;
  admin_paused := COALESCE(v_admin_paused, false);
  force_stopped := COALESCE(v_force_stopped, false);
  autopause_override_enabled := COALESCE(v_override_enabled, false);
  autopause_override_precedence := COALESCE(v_override_precedence, 'automation_allowed');
  autopause_override_final := (
    COALESCE(v_override_enabled, false)
    AND COALESCE(v_override_precedence, 'automation_allowed') = 'final_override'
  );
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_intervention_state(UUID) TO service_role;

-- PostgREST does not support omitting optional RPC parameters.
-- Edge Functions call this RPC with only { p_campaign_id, p_source }.
CREATE OR REPLACE FUNCTION public.maybe_enforce_tenant_abuse_under_review(
  p_campaign_id UUID,
  p_source TEXT DEFAULT 'send_preflight'
)
RETURNS TABLE (
  campaign_id UUID,
  tenant_id UUID,
  was_blocked BOOLEAN,
  state_changed BOOLEAN,
  risk_level TEXT,
  reasons TEXT[],
  monitoring_severity TEXT,
  message TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_under_review BOOLEAN := false;
BEGIN
  -- If a 3-arg implementation exists, delegate to it.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'maybe_enforce_tenant_abuse_under_review'
      AND p.pronargs = 3
  ) THEN
    RETURN QUERY EXECUTE
      'SELECT * FROM public.maybe_enforce_tenant_abuse_under_review($1, $2, $3)'
      USING p_campaign_id, p_source, now();
    RETURN;
  END IF;

  SELECT c.tenant_id
  INTO v_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    SELECT COALESCE(t.email_under_review, false)
    INTO v_under_review
    FROM public.tenants t
    WHERE t.id = v_tenant_id;
  EXCEPTION
    WHEN undefined_column OR undefined_table THEN
      v_under_review := false;
  END;

  campaign_id := p_campaign_id;
  tenant_id := v_tenant_id;
  was_blocked := COALESCE(v_under_review, false);
  state_changed := false;
  risk_level := CASE WHEN COALESCE(v_under_review, false) THEN 'manual_review' ELSE 'none' END;
  reasons := CASE WHEN COALESCE(v_under_review, false) THEN ARRAY['tenant_email_under_review']::TEXT[] ELSE ARRAY[]::TEXT[] END;
  monitoring_severity := CASE WHEN COALESCE(v_under_review, false) THEN 'critical' ELSE 'normal' END;
  message := CASE WHEN COALESCE(v_under_review, false)
    THEN 'Tenant is under manual email review.'
    ELSE NULL
  END;
  details := jsonb_build_object(
    'source', COALESCE(NULLIF(p_source, ''), 'send_preflight'),
    'mode', 'basic_check'
  );
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maybe_enforce_tenant_abuse_under_review(UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
