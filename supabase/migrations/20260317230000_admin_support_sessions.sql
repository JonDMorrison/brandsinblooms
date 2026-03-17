-- ==========================================
-- ADMIN SUPPORT SESSIONS
-- Secure, auditable impersonation flow for
-- authorized internal admins to enter a
-- customer tenant context for support.
-- ==========================================

-- 1. Create support sessions table
CREATE TABLE public.admin_support_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    tenant_name TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN GENERATED ALWAYS AS (ended_at IS NULL) STORED
);

ALTER TABLE public.admin_support_sessions ENABLE ROW LEVEL SECURITY;

-- Only master admins can see their own support sessions
CREATE POLICY "Master admins can view their own support sessions"
ON public.admin_support_sessions
FOR SELECT
TO authenticated
USING (
    auth.uid() = admin_user_id
    AND public.is_master_admin(auth.uid())
);

-- Only master admins can insert support sessions
CREATE POLICY "Master admins can insert support sessions"
ON public.admin_support_sessions
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = admin_user_id
    AND public.is_master_admin(auth.uid())
);

-- Only the owning master admin can update (end) their sessions
CREATE POLICY "Master admins can end their own support sessions"
ON public.admin_support_sessions
FOR UPDATE
TO authenticated
USING (
    auth.uid() = admin_user_id
    AND public.is_master_admin(auth.uid())
)
WITH CHECK (
    auth.uid() = admin_user_id
    AND public.is_master_admin(auth.uid())
);

-- 2. Index for fast lookup of active sessions per admin
CREATE INDEX idx_admin_support_sessions_admin_active
    ON public.admin_support_sessions (admin_user_id, ended_at)
    WHERE ended_at IS NULL;

-- 3. RPC: Start a support session
--    Returns the new session id on success.
CREATE OR REPLACE FUNCTION public.admin_start_support_session(
    p_tenant_id   UUID,
    p_tenant_name TEXT,
    p_reason      TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Authorisation: caller must be a master admin
    IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;

    -- Validate inputs
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'p_tenant_id is required';
    END IF;
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'A reason is required to start a support session';
    END IF;

    -- End any previously active session for this admin
    UPDATE public.admin_support_sessions
    SET ended_at = now()
    WHERE admin_user_id = auth.uid()
      AND ended_at IS NULL;

    -- Create the new session
    INSERT INTO public.admin_support_sessions (
        admin_user_id,
        tenant_id,
        tenant_name,
        reason
    ) VALUES (
        auth.uid(),
        p_tenant_id,
        coalesce(p_tenant_name, ''),
        trim(p_reason)
    )
    RETURNING id INTO v_session_id;

    -- Audit log
    INSERT INTO public.admin_audit_log (
        admin_user_id,
        target_tenant_id,
        action_type,
        action_details
    ) VALUES (
        auth.uid(),
        p_tenant_id,
        'support_session_started',
        jsonb_build_object(
            'session_id',   v_session_id,
            'tenant_id',    p_tenant_id,
            'tenant_name',  coalesce(p_tenant_name, ''),
            'reason',       trim(p_reason),
            'started_at',   now()
        )
    );

    RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_start_support_session(UUID, TEXT, TEXT) TO authenticated;

-- 4. RPC: End a support session
CREATE OR REPLACE FUNCTION public.admin_end_support_session(
    p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.admin_support_sessions%ROWTYPE;
BEGIN
    -- Authorisation: caller must be a master admin
    IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;

    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'p_session_id is required';
    END IF;

    -- Fetch session (must belong to this admin)
    SELECT * INTO v_session
    FROM public.admin_support_sessions
    WHERE id = p_session_id
      AND admin_user_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Support session not found or not owned by current user';
    END IF;

    -- End the session
    UPDATE public.admin_support_sessions
    SET ended_at = now()
    WHERE id = p_session_id
      AND admin_user_id = auth.uid();

    -- Audit log
    INSERT INTO public.admin_audit_log (
        admin_user_id,
        target_tenant_id,
        action_type,
        action_details
    ) VALUES (
        auth.uid(),
        v_session.tenant_id,
        'support_session_ended',
        jsonb_build_object(
            'session_id',   p_session_id,
            'tenant_id',    v_session.tenant_id,
            'tenant_name',  v_session.tenant_name,
            'reason',       v_session.reason,
            'started_at',   v_session.started_at,
            'ended_at',     now(),
            'duration_seconds',
                extract(epoch from (now() - v_session.started_at))::integer
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_end_support_session(UUID) TO authenticated;

-- 5. RPC: Get the current admin's active support session (if any)
CREATE OR REPLACE FUNCTION public.admin_get_active_support_session()
RETURNS TABLE (
    session_id    UUID,
    tenant_id     UUID,
    tenant_name   TEXT,
    reason        TEXT,
    started_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_master_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;

    RETURN QUERY
    SELECT
        s.id          AS session_id,
        s.tenant_id,
        s.tenant_name,
        s.reason,
        s.started_at
    FROM public.admin_support_sessions s
    WHERE s.admin_user_id = auth.uid()
      AND s.ended_at IS NULL
    ORDER BY s.started_at DESC
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_active_support_session() TO authenticated;

NOTIFY pgrst, 'reload schema';
