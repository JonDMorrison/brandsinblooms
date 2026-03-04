-- Cross-tenant global email suppression list.
-- Used to block known bad recipients across all tenants.

CREATE TABLE IF NOT EXISTS public.global_email_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  suppression_type TEXT NOT NULL DEFAULT 'global_block',
  reason TEXT,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  lifted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT global_email_suppression_list_email_normalized
    CHECK (email = lower(btrim(email)))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_email_suppression_unique_active
  ON public.global_email_suppression_list (lower(email), suppression_type)
  WHERE lifted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_global_email_suppression_active_email
  ON public.global_email_suppression_list (lower(email), suppressed_at DESC)
  WHERE lifted_at IS NULL;

ALTER TABLE public.global_email_suppression_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master admins can view global email suppression" ON public.global_email_suppression_list;
CREATE POLICY "Master admins can view global email suppression"
  ON public.global_email_suppression_list FOR SELECT
  USING (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admins can insert global email suppression" ON public.global_email_suppression_list;
CREATE POLICY "Master admins can insert global email suppression"
  ON public.global_email_suppression_list FOR INSERT
  WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admins can update global email suppression" ON public.global_email_suppression_list;
CREATE POLICY "Master admins can update global email suppression"
  ON public.global_email_suppression_list FOR UPDATE
  USING (public.is_master_admin(auth.uid()))
  WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admins can delete global email suppression" ON public.global_email_suppression_list;
CREATE POLICY "Master admins can delete global email suppression"
  ON public.global_email_suppression_list FOR DELETE
  USING (public.is_master_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_global_email_suppression_list_updated_at ON public.global_email_suppression_list;
CREATE TRIGGER update_global_email_suppression_list_updated_at
  BEFORE UPDATE ON public.global_email_suppression_list
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();