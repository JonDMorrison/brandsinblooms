-- Super Admin: Domain management controls
-- Objective: allow master admins to view and unpause tenant email domains from the dashboard.

CREATE OR REPLACE FUNCTION public.admin_list_tenant_email_domains(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  RETURN jsonb_build_object(
    'data', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', d.id,
            'tenant_id', d.tenant_id,
            'domain', d.domain,
            'status', d.status,
            'manual_pause', COALESCE(d.manual_pause, false),
            'bounce_rate_30d', d.bounce_rate_30d,
            'complaint_rate_30d', d.complaint_rate_30d,
            'total_sent_30d', d.total_sent_30d,
            'total_bounces_30d', d.total_bounces_30d,
            'total_complaints_30d', d.total_complaints_30d,
            'updated_at', d.updated_at,
            'notes', d.notes
          )
          ORDER BY d.domain
        )
        FROM public.email_domains d
        WHERE d.tenant_id = p_tenant_id
      ),
      '[]'::jsonb
    ),
    'count', COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM public.email_domains d
        WHERE d.tenant_id = p_tenant_id
      ),
      0
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_tenant_email_domains(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_unpause_tenant_email_domain(
  p_tenant_id UUID,
  p_domain_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_domain RECORD;
  v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), 'dashboard_unpause');
  v_note_line TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF p_domain_id IS NULL THEN
    RAISE EXCEPTION 'p_domain_id is required';
  END IF;

  SELECT
    d.id,
    d.tenant_id,
    d.domain,
    d.status,
    COALESCE(d.manual_pause, false) AS manual_pause,
    d.notes
  INTO v_domain
  FROM public.email_domains d
  WHERE d.id = p_domain_id
    AND d.tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_domain IS NULL THEN
    RAISE EXCEPTION 'Domain not found for tenant';
  END IF;

  IF v_domain.status = 'blocked' THEN
    RAISE EXCEPTION 'Domain is blocked and cannot be unpaused via dashboard';
  END IF;

  IF v_domain.status <> 'paused' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'domain_id', v_domain.id,
      'status', v_domain.status,
      'message', 'Domain is not paused'
    );
  END IF;

  v_note_line := format(
    '[%s] Unpaused by master admin (%s).',
    to_char(now(), 'YYYY-MM-DD'),
    v_reason
  );

  UPDATE public.email_domains
  SET
    status = 'active',
    manual_pause = false,
    error = NULL,
    notes = CASE
      WHEN v_domain.notes IS NULL OR btrim(v_domain.notes) = '' THEN v_note_line
      ELSE v_domain.notes || E'\n' || v_note_line
    END,
    updated_at = now()
  WHERE id = v_domain.id;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'email_domain_unpaused',
    jsonb_build_object(
      'domain_id', v_domain.id,
      'domain', v_domain.domain,
      'previous_status', v_domain.status,
      'previous_manual_pause', v_domain.manual_pause,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'domain_id', v_domain.id,
    'tenant_id', p_tenant_id,
    'domain', v_domain.domain,
    'status', 'active',
    'reason', v_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unpause_tenant_email_domain(UUID, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
