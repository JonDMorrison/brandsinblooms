-- Repair migration: recreate missing tenant control state table used by admin tenant email management.

CREATE TABLE IF NOT EXISTS public.email_governance_tenant_control_state (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  manual_reputation_score INTEGER CHECK (manual_reputation_score BETWEEN 0 AND 100),
  is_reputation_frozen BOOLEAN NOT NULL DEFAULT false,
  forgive_bounce_before TIMESTAMPTZ,
  forgive_complaint_before TIMESTAMPTZ,

  reputation_override_mode TEXT,
  reputation_override_expires_at TIMESTAMPTZ,
  reputation_override_reason TEXT,
  penalties_disabled_until TIMESTAMPTZ,
  penalties_disabled_reason TEXT,

  send_limit_monthly INTEGER,
  send_limit_daily INTEGER,
  send_limit_hourly INTEGER,
  unlimited_sending_enabled BOOLEAN NOT NULL DEFAULT false,
  emergency_restriction_enabled BOOLEAN NOT NULL DEFAULT false,
  emergency_restriction_until TIMESTAMPTZ,
  emergency_restriction_reason TEXT,
  boost_until TIMESTAMPTZ,
  boost_monthly INTEGER,
  boost_daily INTEGER,
  boost_hourly INTEGER,
  boost_reason TEXT,

  suppression_bypass_enabled BOOLEAN NOT NULL DEFAULT false,
  suppression_bypass_until TIMESTAMPTZ,
  suppression_bypass_reason TEXT,
  suppression_bypass_automation_mode TEXT NOT NULL DEFAULT 'campaign_only',

  campaign_creation_locked BOOLEAN NOT NULL DEFAULT false,
  campaign_creation_locked_reason TEXT,

  reputation_override_precedence TEXT NOT NULL DEFAULT 'final_override',
  under_review_override_enabled BOOLEAN NOT NULL DEFAULT false,
  under_review_override_precedence TEXT NOT NULL DEFAULT 'automation_allowed',
  under_review_override_until TIMESTAMPTZ,
  under_review_override_reason TEXT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_governance_tenant_control_state
  ADD COLUMN IF NOT EXISTS manual_reputation_score INTEGER,
  ADD COLUMN IF NOT EXISTS is_reputation_frozen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forgive_bounce_before TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forgive_complaint_before TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS reputation_override_mode TEXT,
  ADD COLUMN IF NOT EXISTS reputation_override_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reputation_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS penalties_disabled_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalties_disabled_reason TEXT,

  ADD COLUMN IF NOT EXISTS send_limit_monthly INTEGER,
  ADD COLUMN IF NOT EXISTS send_limit_daily INTEGER,
  ADD COLUMN IF NOT EXISTS send_limit_hourly INTEGER,
  ADD COLUMN IF NOT EXISTS unlimited_sending_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_restriction_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_restriction_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emergency_restriction_reason TEXT,
  ADD COLUMN IF NOT EXISTS boost_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_monthly INTEGER,
  ADD COLUMN IF NOT EXISTS boost_daily INTEGER,
  ADD COLUMN IF NOT EXISTS boost_hourly INTEGER,
  ADD COLUMN IF NOT EXISTS boost_reason TEXT,

  ADD COLUMN IF NOT EXISTS suppression_bypass_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppression_bypass_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppression_bypass_reason TEXT,
  ADD COLUMN IF NOT EXISTS suppression_bypass_automation_mode TEXT NOT NULL DEFAULT 'campaign_only',

  ADD COLUMN IF NOT EXISTS campaign_creation_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_creation_locked_reason TEXT,

  ADD COLUMN IF NOT EXISTS reputation_override_precedence TEXT NOT NULL DEFAULT 'final_override',
  ADD COLUMN IF NOT EXISTS under_review_override_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS under_review_override_precedence TEXT NOT NULL DEFAULT 'automation_allowed',
  ADD COLUMN IF NOT EXISTS under_review_override_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS under_review_override_reason TEXT,

  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_manual_score_range'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_manual_score_range
      CHECK (manual_reputation_score IS NULL OR manual_reputation_score BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_override_mode_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_override_mode_check
      CHECK (
        reputation_override_mode IS NULL
        OR reputation_override_mode IN ('final', 'temporary')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_override_expiration_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_override_expiration_check
      CHECK (
        reputation_override_mode <> 'temporary'
        OR reputation_override_expires_at IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_send_limit_monthly_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_send_limit_monthly_nonneg
      CHECK (send_limit_monthly IS NULL OR send_limit_monthly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_send_limit_daily_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_send_limit_daily_nonneg
      CHECK (send_limit_daily IS NULL OR send_limit_daily >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_send_limit_hourly_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_send_limit_hourly_nonneg
      CHECK (send_limit_hourly IS NULL OR send_limit_hourly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_boost_monthly_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_boost_monthly_nonneg
      CHECK (boost_monthly IS NULL OR boost_monthly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_boost_daily_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_boost_daily_nonneg
      CHECK (boost_daily IS NULL OR boost_daily >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_boost_hourly_nonneg'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_boost_hourly_nonneg
      CHECK (boost_hourly IS NULL OR boost_hourly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_boost_requires_until'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_boost_requires_until
      CHECK (
        (
          boost_monthly IS NULL
          AND boost_daily IS NULL
          AND boost_hourly IS NULL
          AND boost_until IS NULL
        )
        OR boost_until IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_suppression_bypass_mode_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_suppression_bypass_mode_check
      CHECK (suppression_bypass_automation_mode IN ('campaign_only', 'campaign_and_automation'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_reputation_override_precedence_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_reputation_override_precedence_check
      CHECK (reputation_override_precedence IN ('final_override', 'automation_allowed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_gov_tenant_control_under_review_override_precedence_check'
      AND conrelid = 'public.email_governance_tenant_control_state'::regclass
  ) THEN
    ALTER TABLE public.email_governance_tenant_control_state
      ADD CONSTRAINT email_gov_tenant_control_under_review_override_precedence_check
      CHECK (under_review_override_precedence IN ('final_override', 'automation_allowed'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tenant_control_under_review_override_expiry
  ON public.email_governance_tenant_control_state (tenant_id, under_review_override_until)
  WHERE under_review_override_enabled = true
    AND under_review_override_until IS NOT NULL;

ALTER TABLE public.email_governance_tenant_control_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_governance_tenant_control_state'
      AND policyname = 'Master admins can read tenant control state'
  ) THEN
    CREATE POLICY "Master admins can read tenant control state"
      ON public.email_governance_tenant_control_state
      FOR SELECT
      TO authenticated
      USING (public.is_master_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_governance_tenant_control_state'
      AND policyname = 'Master admins can insert tenant control state'
  ) THEN
    CREATE POLICY "Master admins can insert tenant control state"
      ON public.email_governance_tenant_control_state
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_master_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_governance_tenant_control_state'
      AND policyname = 'Master admins can update tenant control state'
  ) THEN
    CREATE POLICY "Master admins can update tenant control state"
      ON public.email_governance_tenant_control_state
      FOR UPDATE
      TO authenticated
      USING (public.is_master_admin(auth.uid()))
      WITH CHECK (public.is_master_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_governance_tenant_control_state'
      AND policyname = 'Master admins can delete tenant control state'
  ) THEN
    CREATE POLICY "Master admins can delete tenant control state"
      ON public.email_governance_tenant_control_state
      FOR DELETE
      TO authenticated
      USING (public.is_master_admin(auth.uid()));
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
