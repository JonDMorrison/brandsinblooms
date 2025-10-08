-- ==========================================
-- MASTER ADMIN SYSTEM
-- ==========================================

-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('master_admin', 'admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by_user_id UUID REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 4. Create function to check if user is master admin
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'master_admin');
$$;

-- 5. RLS policies for user_roles
CREATE POLICY "Master admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Master admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_master_admin(auth.uid()));

CREATE POLICY "Master admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 6. Create admin audit log table
CREATE TABLE public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
    target_tenant_id UUID REFERENCES public.tenants(id),
    target_user_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL,
    action_details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS for audit log
CREATE POLICY "Master admins can view audit log"
ON public.admin_audit_log
FOR SELECT
TO authenticated
USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Service role can insert audit log"
ON public.admin_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 7. Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action_type TEXT,
    p_target_tenant_id UUID DEFAULT NULL,
    p_target_user_id UUID DEFAULT NULL,
    p_action_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    log_id UUID;
BEGIN
    -- Only master admins can log actions
    IF NOT public.is_master_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Master admin required.';
    END IF;

    INSERT INTO public.admin_audit_log (
        admin_user_id,
        target_tenant_id,
        target_user_id,
        action_type,
        action_details
    ) VALUES (
        auth.uid(),
        p_target_tenant_id,
        p_target_user_id,
        p_action_type,
        p_action_details
    )
    RETURNING id INTO log_id;

    RETURN log_id;
END;
$$;

-- 8. Create admin session context table (for tracking which tenant admin is managing)
CREATE TABLE public.admin_session_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    active_tenant_id UUID REFERENCES public.tenants(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (admin_user_id)
);

ALTER TABLE public.admin_session_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their own session context"
ON public.admin_session_context
FOR ALL
TO authenticated
USING (auth.uid() = admin_user_id)
WITH CHECK (auth.uid() = admin_user_id);

-- 9. Add trigger for updated_at
CREATE TRIGGER update_admin_session_context_updated_at
BEFORE UPDATE ON public.admin_session_context
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();