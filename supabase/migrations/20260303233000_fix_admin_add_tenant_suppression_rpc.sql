-- Ensure admin_add_tenant_suppression RPC exists and is visible to PostgREST.
-- Fixes: "Could not find the function public.admin_add_tenant_suppression(...) in the schema cache"

-- Ensure the ON CONFLICT target exists for suppression_list writes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppression_list_unique_email_channel_type
  ON public.suppression_list (tenant_id, email, channel, suppression_type);

-- Drop any stale variants so PostgREST can't get confused.
DROP FUNCTION IF EXISTS public.admin_add_tenant_suppression(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.admin_add_tenant_suppression(TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.admin_add_tenant_suppression(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.admin_add_tenant_suppression(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_add_tenant_suppression(
  p_tenant_id UUID,
  p_email TEXT,
  p_suppression_type TEXT,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_type TEXT := lower(btrim(COALESCE(p_suppression_type, '')));
  v_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.is_master_admin(v_actor) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'p_email is required';
  END IF;

  IF v_type NOT IN ('unsubscribed', 'bounced', 'hard_bounce', 'complaint', 'complained') THEN
    RAISE EXCEPTION 'Invalid p_suppression_type';
  END IF;

  INSERT INTO public.suppression_list (
    tenant_id,
    email,
    suppression_type,
    channel,
    reason,
    auto_suppressed,
    expires_at,
    suppressed_at,
    lifted_at,
    lifted_by
  ) VALUES (
    p_tenant_id,
    v_email,
    v_type,
    'email',
    NULLIF(btrim(p_reason), ''),
    false,
    p_expires_at,
    now(),
    NULL,
    NULL
  )
  ON CONFLICT (tenant_id, email, channel, suppression_type)
  DO UPDATE SET
    reason = EXCLUDED.reason,
    auto_suppressed = false,
    expires_at = EXCLUDED.expires_at,
    suppressed_at = now(),
    lifted_at = NULL,
    lifted_by = NULL,
    updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.email_governance_suppression_events (
    tenant_id,
    email,
    channel,
    suppression_type,
    reason,
    source,
    is_active,
    metadata,
    occurred_at
  ) VALUES (
    p_tenant_id,
    v_email,
    'email',
    v_type,
    NULLIF(btrim(p_reason), ''),
    'admin',
    true,
    jsonb_build_object('admin_user_id', v_actor),
    now()
  );

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    v_actor,
    p_tenant_id,
    'tenant_suppression_added',
    jsonb_build_object(
      'suppression_id', v_id,
      'email', v_email,
      'suppression_type', v_type,
      'expires_at', p_expires_at,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_suppression_add')
    )
  );

  RETURN jsonb_build_object(
    'id', v_id,
    'email', v_email,
    'suppression_type', v_type,
    'expires_at', p_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_tenant_suppression(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- Force PostgREST to pick up the repaired RPC.
NOTIFY pgrst, 'reload schema';
