-- Milestone 10: Governance Audit & Internal Logging System
-- Internal, immutable, super-admin-only governance forensic log.

CREATE TABLE IF NOT EXISTS public.email_governance_internal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'system', 'automation', 'service', 'unknown')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  affected_table TEXT NOT NULL,
  affected_record_id TEXT,
  previous_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  automation_precedence_mode TEXT,
  expires_at TIMESTAMPTZ,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_internal_audit_tenant_time
  ON public.email_governance_internal_audit_log (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_internal_audit_action_time
  ON public.email_governance_internal_audit_log (action_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_internal_audit_actor_time
  ON public.email_governance_internal_audit_log (actor_type, occurred_at DESC);

ALTER TABLE public.email_governance_internal_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_gov_internal_audit_master_admin_select ON public.email_governance_internal_audit_log;
CREATE POLICY email_gov_internal_audit_master_admin_select
  ON public.email_governance_internal_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_master_admin(auth.uid()));

REVOKE UPDATE, DELETE, TRUNCATE ON public.email_governance_internal_audit_log FROM anon, authenticated, service_role;
GRANT SELECT ON public.email_governance_internal_audit_log TO authenticated;

CREATE OR REPLACE FUNCTION public.block_internal_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'email_governance_internal_audit_log is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_internal_audit_log_update ON public.email_governance_internal_audit_log;
CREATE TRIGGER trg_block_internal_audit_log_update
  BEFORE UPDATE ON public.email_governance_internal_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.block_internal_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_block_internal_audit_log_delete ON public.email_governance_internal_audit_log;
CREATE TRIGGER trg_block_internal_audit_log_delete
  BEFORE DELETE ON public.email_governance_internal_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.block_internal_audit_log_mutation();

CREATE OR REPLACE FUNCTION public.internal_audit_first_text(
  p_payload JSONB,
  p_keys TEXT[]
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key TEXT;
  v_val TEXT;
BEGIN
  IF p_payload IS NULL OR p_keys IS NULL THEN
    RETURN NULL;
  END IF;

  FOREACH v_key IN ARRAY p_keys
  LOOP
    v_val := NULLIF(btrim(p_payload ->> v_key), '');
    IF v_val IS NOT NULL THEN
      RETURN v_val;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_audit_first_timestamptz(
  p_payload JSONB,
  p_keys TEXT[]
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key TEXT;
  v_raw TEXT;
BEGIN
  IF p_payload IS NULL OR p_keys IS NULL THEN
    RETURN NULL;
  END IF;

  FOREACH v_key IN ARRAY p_keys
  LOOP
    v_raw := NULLIF(btrim(p_payload ->> v_key), '');
    IF v_raw IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      RETURN v_raw::timestamptz;
    EXCEPTION
      WHEN OTHERS THEN
        CONTINUE;
    END;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_email_governance_internal_audit(
  p_action_type TEXT,
  p_affected_table TEXT,
  p_affected_record_id TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_previous_value JSONB DEFAULT '{}'::jsonb,
  p_new_value JSONB DEFAULT '{}'::jsonb,
  p_automation_precedence_mode TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_occurred_at TIMESTAMPTZ DEFAULT now(),
  p_actor_type TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_actor_id UUID := COALESCE(p_actor_id, auth.uid());
  v_actor_type TEXT := lower(COALESCE(NULLIF(btrim(p_actor_type), ''), ''));
BEGIN
  IF NULLIF(btrim(COALESCE(p_action_type, '')), '') IS NULL THEN
    RAISE EXCEPTION 'p_action_type is required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_affected_table, '')), '') IS NULL THEN
    RAISE EXCEPTION 'p_affected_table is required';
  END IF;

  IF v_actor_type = '' THEN
    IF v_actor_id IS NOT NULL AND public.is_master_admin(v_actor_id) THEN
      v_actor_type := 'admin';
    ELSIF auth.role() = 'service_role' THEN
      v_actor_type := 'service';
    ELSIF v_actor_id IS NOT NULL THEN
      v_actor_type := 'unknown';
    ELSE
      v_actor_type := 'system';
    END IF;
  END IF;

  IF v_actor_type = 'admin' AND (v_actor_id IS NULL OR NOT public.is_master_admin(v_actor_id)) THEN
    RAISE EXCEPTION 'admin actor_type requires a master admin actor_id';
  END IF;

  INSERT INTO public.email_governance_internal_audit_log (
    tenant_id,
    actor_type,
    actor_id,
    action_type,
    affected_table,
    affected_record_id,
    previous_value,
    new_value,
    automation_precedence_mode,
    expires_at,
    reason,
    metadata,
    occurred_at
  ) VALUES (
    p_tenant_id,
    v_actor_type,
    v_actor_id,
    p_action_type,
    p_affected_table,
    p_affected_record_id,
    COALESCE(p_previous_value, '{}'::jsonb),
    COALESCE(p_new_value, '{}'::jsonb),
    NULLIF(btrim(p_automation_precedence_mode), ''),
    p_expires_at,
    NULLIF(btrim(p_reason), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_occurred_at, now())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_governance_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_row JSONB := COALESCE(to_jsonb(OLD), '{}'::jsonb);
  v_new_row JSONB := COALESCE(to_jsonb(NEW), '{}'::jsonb);
  v_effective_row JSONB;
  v_tenant_id UUID := NULL;
  v_record_id TEXT := NULL;
  v_tenant_key TEXT := COALESCE(NULLIF(TG_ARGV[0], ''), 'tenant_id');
  v_record_key TEXT := COALESCE(NULLIF(TG_ARGV[1], ''), 'id');
  v_action_namespace TEXT := COALESCE(NULLIF(TG_ARGV[2], ''), TG_TABLE_NAME);
  v_action_type TEXT;
  v_precedence TEXT;
  v_expires_at TIMESTAMPTZ;
  v_reason TEXT;
BEGIN
  v_effective_row := CASE WHEN TG_OP = 'DELETE' THEN v_old_row ELSE v_new_row END;

  IF v_tenant_key = 'none' THEN
    v_tenant_id := NULL;
  ELSE
    BEGIN
      v_tenant_id := NULLIF(v_effective_row ->> v_tenant_key, '')::UUID;
    EXCEPTION
      WHEN OTHERS THEN
        v_tenant_id := NULL;
    END;
  END IF;

  v_record_id := NULLIF(v_effective_row ->> v_record_key, '');

  v_precedence := public.internal_audit_first_text(
    v_effective_row,
    ARRAY[
      'autopause_override_precedence',
      'under_review_override_precedence',
      'reputation_override_precedence',
      'reputation_override_mode',
      'suppression_bypass_automation_mode'
    ]
  );

  v_expires_at := public.internal_audit_first_timestamptz(
    v_effective_row,
    ARRAY[
      'autopause_override_until',
      'under_review_override_until',
      'reputation_override_expires_at',
      'penalties_disabled_until',
      'suppression_bypass_until',
      'emergency_restriction_until',
      'boost_until',
      'expires_at'
    ]
  );

  v_reason := public.internal_audit_first_text(
    v_effective_row,
    ARRAY[
      'updated_reason',
      'reason',
      'autopause_override_reason',
      'under_review_override_reason',
      'reputation_override_reason',
      'suppression_bypass_reason',
      'campaign_creation_locked_reason',
      'emergency_restriction_reason',
      'boost_reason'
    ]
  );

  v_action_type := format('%s.%s', v_action_namespace, lower(TG_OP));

  PERFORM public.log_email_governance_internal_audit(
    p_action_type => v_action_type,
    p_affected_table => TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    p_affected_record_id => v_record_id,
    p_tenant_id => v_tenant_id,
    p_previous_value => CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE v_old_row END,
    p_new_value => CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE v_new_row END,
    p_automation_precedence_mode => v_precedence,
    p_expires_at => v_expires_at,
    p_reason => v_reason,
    p_metadata => jsonb_build_object(
      'trigger_operation', TG_OP,
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'txid', txid_current()
    ),
    p_occurred_at => now(),
    p_actor_type => NULL,
    p_actor_id => auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_email_gov_tenant_control_state ON public.email_governance_tenant_control_state;
CREATE TRIGGER trg_audit_email_gov_tenant_control_state
  AFTER INSERT OR UPDATE OR DELETE ON public.email_governance_tenant_control_state
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_governance_row_change('tenant_id', 'tenant_id', 'tenant_control_state');

DROP TRIGGER IF EXISTS trg_audit_email_gov_campaign_intervention_state ON public.email_governance_campaign_intervention_state;
CREATE TRIGGER trg_audit_email_gov_campaign_intervention_state
  AFTER INSERT OR UPDATE OR DELETE ON public.email_governance_campaign_intervention_state
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_governance_row_change('tenant_id', 'campaign_id', 'campaign_intervention_state');

DROP TRIGGER IF EXISTS trg_audit_tenants_governance_state ON public.tenants;
CREATE TRIGGER trg_audit_tenants_governance_state
  AFTER UPDATE OF email_under_review, email_under_review_at, email_under_review_reason, email_under_review_details ON public.tenants
  FOR EACH ROW
  WHEN (
    OLD.email_under_review IS DISTINCT FROM NEW.email_under_review
    OR OLD.email_under_review_at IS DISTINCT FROM NEW.email_under_review_at
    OR OLD.email_under_review_reason IS DISTINCT FROM NEW.email_under_review_reason
    OR OLD.email_under_review_details IS DISTINCT FROM NEW.email_under_review_details
  )
  EXECUTE FUNCTION public.audit_governance_row_change('id', 'id', 'tenant_under_review_state');

DROP TRIGGER IF EXISTS trg_audit_email_domains_governance_state ON public.email_domains;
CREATE TRIGGER trg_audit_email_domains_governance_state
  AFTER UPDATE OF investigation_mode, investigation_mode_at, investigation_mode_reason, investigation_mode_details, status, warmup_stage, daily_limit, healthy_days_counter, manual_pause ON public.email_domains
  FOR EACH ROW
  WHEN (
    OLD.investigation_mode IS DISTINCT FROM NEW.investigation_mode
    OR OLD.investigation_mode_at IS DISTINCT FROM NEW.investigation_mode_at
    OR OLD.investigation_mode_reason IS DISTINCT FROM NEW.investigation_mode_reason
    OR OLD.investigation_mode_details IS DISTINCT FROM NEW.investigation_mode_details
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.warmup_stage IS DISTINCT FROM NEW.warmup_stage
    OR OLD.daily_limit IS DISTINCT FROM NEW.daily_limit
    OR OLD.healthy_days_counter IS DISTINCT FROM NEW.healthy_days_counter
    OR OLD.manual_pause IS DISTINCT FROM NEW.manual_pause
  )
  EXECUTE FUNCTION public.audit_governance_row_change('tenant_id', 'id', 'email_domain_governance_state');

DROP TRIGGER IF EXISTS trg_audit_tenant_suppression_list ON public.suppression_list;
CREATE TRIGGER trg_audit_tenant_suppression_list
  AFTER INSERT OR UPDATE OR DELETE ON public.suppression_list
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_governance_row_change('tenant_id', 'id', 'tenant_suppression_list');

DROP TRIGGER IF EXISTS trg_audit_global_suppression_list ON public.global_email_suppression_list;
CREATE TRIGGER trg_audit_global_suppression_list
  AFTER INSERT OR UPDATE OR DELETE ON public.global_email_suppression_list
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_governance_row_change('none', 'id', 'global_suppression_list');

DROP TRIGGER IF EXISTS trg_audit_domain_crisis_actions ON public.email_governance_domain_crisis_actions;
CREATE TRIGGER trg_audit_domain_crisis_actions
  AFTER INSERT ON public.email_governance_domain_crisis_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_governance_row_change('tenant_id', 'id', 'domain_crisis_actions');

CREATE OR REPLACE FUNCTION public.admin_list_email_governance_internal_audit_log(
  p_tenant_id UUID DEFAULT NULL,
  p_action_type TEXT DEFAULT NULL,
  p_actor_type TEXT DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_page INTEGER := GREATEST(COALESCE(p_page, 0), 0);
  v_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
  v_offset INTEGER := v_page * v_page_size;
  v_count INTEGER := 0;
  v_data JSONB := '[]'::jsonb;
  v_action_filter TEXT := NULLIF(btrim(COALESCE(p_action_type, '')), '');
  v_actor_filter TEXT := NULLIF(lower(btrim(COALESCE(p_actor_type, ''))), '');
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  WITH filtered AS (
    SELECT l.*
    FROM public.email_governance_internal_audit_log l
    WHERE (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
      AND (v_action_filter IS NULL OR l.action_type ILIKE '%' || v_action_filter || '%')
      AND (v_actor_filter IS NULL OR lower(l.actor_type) = v_actor_filter)
      AND (p_from IS NULL OR l.occurred_at >= p_from)
      AND (p_to IS NULL OR l.occurred_at <= p_to)
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM filtered;

  WITH filtered AS (
    SELECT
      l.id,
      l.tenant_id,
      t.company_name,
      l.actor_type,
      l.actor_id,
      u.email AS actor_email,
      l.action_type,
      l.affected_table,
      l.affected_record_id,
      l.previous_value,
      l.new_value,
      l.automation_precedence_mode,
      l.expires_at,
      l.reason,
      l.metadata,
      l.occurred_at,
      l.created_at
    FROM public.email_governance_internal_audit_log l
    LEFT JOIN public.tenants t ON t.id = l.tenant_id
    LEFT JOIN public.users u ON u.id = l.actor_id
    WHERE (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
      AND (v_action_filter IS NULL OR l.action_type ILIKE '%' || v_action_filter || '%')
      AND (v_actor_filter IS NULL OR lower(l.actor_type) = v_actor_filter)
      AND (p_from IS NULL OR l.occurred_at >= p_from)
      AND (p_to IS NULL OR l.occurred_at <= p_to)
    ORDER BY l.occurred_at DESC, l.created_at DESC
    OFFSET v_offset
    LIMIT v_page_size
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(filtered)), '[]'::jsonb)
  INTO v_data
  FROM filtered;

  RETURN jsonb_build_object(
    'data', v_data,
    'count', COALESCE(v_count, 0),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_email_governance_internal_audit_log(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
