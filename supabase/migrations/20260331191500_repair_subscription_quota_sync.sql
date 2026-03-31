-- Reconcile the org-level quota contract, wire budget synchronization to the
-- subscription model, and repair sync admission RPCs.

ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'seed';
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'thrive';

CREATE TABLE IF NOT EXISTS public.plan_definitions (
  plan TEXT PRIMARY KEY,
  max_automation_runs INTEGER NOT NULL DEFAULT 0,
  max_concurrent_jobs INTEGER NOT NULL DEFAULT 0,
  max_customers INTEGER NOT NULL DEFAULT 0,
  max_email_sends INTEGER NOT NULL DEFAULT 0,
  max_orders INTEGER NOT NULL DEFAULT 0,
  max_products INTEGER NOT NULL DEFAULT 0,
  max_rows_ingested INTEGER NOT NULL DEFAULT 0,
  max_sms_sends INTEGER NOT NULL DEFAULT 0,
  max_sync_jobs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_definitions
  ADD COLUMN IF NOT EXISTS max_automation_runs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_concurrent_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_customers INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_email_sends INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_orders INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_products INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_rows_ingested INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_sms_sends INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_sync_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_definitions_plan
  ON public.plan_definitions (plan);

INSERT INTO public.plan_definitions (
  plan,
  max_automation_runs,
  max_concurrent_jobs,
  max_customers,
  max_email_sends,
  max_orders,
  max_products,
  max_rows_ingested,
  max_sms_sends,
  max_sync_jobs
)
VALUES
  ('free_trial', 100, 1, 5000, 1000, 10000, 1000, 50000, 250, 25),
  ('seed', -1, 1, -1, 10000, -1, -1, -1, 1000, -1),
  ('sprout', -1, 2, -1, 20000, -1, -1, -1, 2000, -1),
  ('bloom', -1, 3, -1, 100000, -1, -1, -1, 5000, -1),
  ('thrive', -1, 4, -1, -1, -1, -1, -1, 50000, -1),
  ('expired', 0, 0, 0, 0, 0, 0, 0, 0, 0)
ON CONFLICT (plan) DO UPDATE SET
  max_automation_runs = EXCLUDED.max_automation_runs,
  max_concurrent_jobs = EXCLUDED.max_concurrent_jobs,
  max_customers = EXCLUDED.max_customers,
  max_email_sends = EXCLUDED.max_email_sends,
  max_orders = EXCLUDED.max_orders,
  max_products = EXCLUDED.max_products,
  max_rows_ingested = EXCLUDED.max_rows_ingested,
  max_sms_sends = EXCLUDED.max_sms_sends,
  max_sync_jobs = EXCLUDED.max_sync_jobs,
  updated_at = now();

ALTER TABLE public.org_usage_budgets
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS month DATE DEFAULT date_trunc('month', CURRENT_DATE)::date,
  ADD COLUMN IF NOT EXISTS plan TEXT,
  ADD COLUMN IF NOT EXISTS max_automation_runs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_customers INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_email_sends INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_orders INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_products INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_rows_ingested INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_sms_sends INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_sync_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.org_usage_budgets
SET id = gen_random_uuid()
WHERE id IS NULL;

UPDATE public.org_usage_budgets
SET month = date_trunc('month', CURRENT_DATE)::date
WHERE month IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.org_usage_budgets'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.org_usage_budgets
      ADD CONSTRAINT org_usage_budgets_pkey PRIMARY KEY (id);
  END IF;
END $$;

WITH ranked_budgets AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, month
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_number
  FROM public.org_usage_budgets
)
DELETE FROM public.org_usage_budgets
WHERE ctid IN (
  SELECT ctid
  FROM ranked_budgets
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_usage_budgets_tenant_month
  ON public.org_usage_budgets (tenant_id, month);

ALTER TABLE public.org_usage_counters
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS month DATE DEFAULT date_trunc('month', CURRENT_DATE)::date,
  ADD COLUMN IF NOT EXISTS automation_runs_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customers_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_sends_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orders_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS products_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rows_ingested INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_sends_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_jobs_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.org_usage_counters
SET id = gen_random_uuid()
WHERE id IS NULL;

UPDATE public.org_usage_counters
SET month = date_trunc('month', CURRENT_DATE)::date
WHERE month IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.org_usage_counters'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.org_usage_counters
      ADD CONSTRAINT org_usage_counters_pkey PRIMARY KEY (id);
  END IF;
END $$;

WITH ranked_counters AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, month
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_number
  FROM public.org_usage_counters
)
DELETE FROM public.org_usage_counters
WHERE ctid IN (
  SELECT ctid
  FROM ranked_counters
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_usage_counters_tenant_month
  ON public.org_usage_counters (tenant_id, month);

CREATE OR REPLACE FUNCTION public.resolve_effective_subscription_tier(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT COALESCE(
    NULLIF(lower(trim(s.tier)), ''),
    CASE
      WHEN s.plan::text IN ('seed', 'sprout', 'bloom', 'thrive') THEN s.plan::text
      WHEN s.plan::text IN ('free_trial', 'expired') THEN s.plan::text
      ELSE NULL
    END
  )
  INTO v_tier
  FROM public.subscriptions s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
    AND s.deleted_at IS NULL
  ORDER BY
    CASE
      WHEN s.plan::text = 'expired' THEN 2
      WHEN s.end_date >= CURRENT_DATE THEN 0
      ELSE 1
    END,
    COALESCE(s.updated_at, s.created_at) DESC,
    s.created_at DESC
  LIMIT 1;

  RETURN COALESCE(v_tier, 'free_trial');
END;
$function$;

UPDATE public.org_usage_budgets
SET plan = public.resolve_effective_subscription_tier(tenant_id)
WHERE plan IS NULL
   OR btrim(plan) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.org_usage_budgets'::regclass
      AND conname = 'org_usage_budgets_plan_fkey'
  ) THEN
    ALTER TABLE public.org_usage_budgets
      ADD CONSTRAINT org_usage_budgets_plan_fkey
      FOREIGN KEY (plan)
      REFERENCES public.plan_definitions(plan)
      ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE public.org_usage_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_usage_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'org_usage_budgets'
      AND policyname = 'Users can view their tenant org usage budgets'
  ) THEN
    CREATE POLICY "Users can view their tenant org usage budgets"
      ON public.org_usage_budgets
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND users.tenant_id = org_usage_budgets.tenant_id
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'org_usage_counters'
      AND policyname = 'Users can view their tenant org usage counters'
  ) THEN
    CREATE POLICY "Users can view their tenant org usage counters"
      ON public.org_usage_counters
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND users.tenant_id = org_usage_counters.tenant_id
        )
      );
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_plan_definitions_updated_at
  ON public.plan_definitions;

CREATE TRIGGER update_plan_definitions_updated_at
  BEFORE UPDATE ON public.plan_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_usage_budgets_updated_at
  ON public.org_usage_budgets;

CREATE TRIGGER update_org_usage_budgets_updated_at
  BEFORE UPDATE ON public.org_usage_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_usage_counters_updated_at
  ON public.org_usage_counters;

CREATE TRIGGER update_org_usage_counters_updated_at
  BEFORE UPDATE ON public.org_usage_counters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_subscription_to_org_budget(
  p_tenant_id UUID,
  p_month DATE DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_plan TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := COALESCE(p_month, date_trunc('month', CURRENT_DATE)::date);
  v_plan TEXT := COALESCE(NULLIF(btrim(p_plan), ''), public.resolve_effective_subscription_tier(p_tenant_id));
  v_definition public.plan_definitions%ROWTYPE;
BEGIN
  SELECT *
  INTO v_definition
  FROM public.plan_definitions
  WHERE plan = v_plan;

  IF NOT FOUND THEN
    v_plan := 'free_trial';
    SELECT *
    INTO v_definition
    FROM public.plan_definitions
    WHERE plan = v_plan;
  END IF;

  INSERT INTO public.org_usage_budgets (
    tenant_id,
    month,
    plan,
    max_automation_runs,
    max_customers,
    max_email_sends,
    max_orders,
    max_products,
    max_rows_ingested,
    max_sms_sends,
    max_sync_jobs
  )
  VALUES (
    p_tenant_id,
    v_month,
    v_plan,
    v_definition.max_automation_runs,
    v_definition.max_customers,
    v_definition.max_email_sends,
    v_definition.max_orders,
    v_definition.max_products,
    v_definition.max_rows_ingested,
    v_definition.max_sms_sends,
    v_definition.max_sync_jobs
  )
  ON CONFLICT (tenant_id, month) DO UPDATE SET
    plan = EXCLUDED.plan,
    max_automation_runs = EXCLUDED.max_automation_runs,
    max_customers = EXCLUDED.max_customers,
    max_email_sends = EXCLUDED.max_email_sends,
    max_orders = EXCLUDED.max_orders,
    max_products = EXCLUDED.max_products,
    max_rows_ingested = EXCLUDED.max_rows_ingested,
    max_sms_sends = EXCLUDED.max_sms_sends,
    max_sync_jobs = EXCLUDED.max_sync_jobs,
    updated_at = now();

  INSERT INTO public.org_usage_counters (tenant_id, month)
  VALUES (p_tenant_id, v_month)
  ON CONFLICT (tenant_id, month) DO NOTHING;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'month', v_month,
    'plan', v_plan,
    'max_sync_jobs', v_definition.max_sync_jobs,
    'max_concurrent_jobs', v_definition.max_concurrent_jobs,
    'max_email_sends', v_definition.max_email_sends,
    'max_sms_sends', v_definition.max_sms_sends
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_org_usage_initialized(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.sync_subscription_to_org_budget(
    p_tenant_id,
    date_trunc('month', CURRENT_DATE)::date,
    NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_resync_tenant_budget(
  p_tenant_id UUID,
  p_month DATE DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_plan TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_before_budget JSONB;
  v_after_budget JSONB;
BEGIN
  SELECT to_jsonb(oub)
  INTO v_before_budget
  FROM public.org_usage_budgets oub
  WHERE oub.tenant_id = p_tenant_id
    AND oub.month = COALESCE(p_month, date_trunc('month', CURRENT_DATE)::date);

  v_after_budget := public.sync_subscription_to_org_budget(p_tenant_id, p_month, p_plan);

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'month', COALESCE(p_month, date_trunc('month', CURRENT_DATE)::date),
    'before_budget', v_before_budget,
    'after_budget', v_after_budget
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reset_sync_usage_for_month(
  p_tenant_id UUID,
  p_month DATE DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_reset_value INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := COALESCE(p_month, date_trunc('month', CURRENT_DATE)::date);
  v_before_value INTEGER;
  v_after_value INTEGER;
BEGIN
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);

  SELECT sync_jobs_used
  INTO v_before_value
  FROM public.org_usage_counters
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  UPDATE public.org_usage_counters
  SET sync_jobs_used = GREATEST(COALESCE(p_reset_value, 0), 0),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT sync_jobs_used
  INTO v_after_value
  FROM public.org_usage_counters
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'month', v_month,
    'before', COALESCE(v_before_value, 0),
    'after', COALESCE(v_after_value, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_backfill_subscription_budgets(
  p_month DATE DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_results JSONB := '[]'::jsonb;
  v_record RECORD;
BEGIN
  FOR v_record IN
    WITH ranked_subscriptions AS (
      SELECT
        u.tenant_id,
        COALESCE(
          NULLIF(lower(trim(s.tier)), ''),
          CASE
            WHEN s.plan::text IN ('seed', 'sprout', 'bloom', 'thrive') THEN s.plan::text
            ELSE NULL
          END
        ) AS effective_plan,
        ROW_NUMBER() OVER (
          PARTITION BY u.tenant_id
          ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC
        ) AS row_number
      FROM public.subscriptions s
      JOIN public.users u ON u.id = s.user_id
      WHERE u.tenant_id IS NOT NULL
        AND s.deleted_at IS NULL
        AND (s.end_date IS NULL OR s.end_date >= CURRENT_DATE)
    )
    SELECT tenant_id, effective_plan
    FROM ranked_subscriptions
    WHERE row_number = 1
      AND effective_plan IN ('seed', 'sprout', 'bloom', 'thrive')
  LOOP
    v_results := v_results || jsonb_build_array(
      public.sync_subscription_to_org_budget(v_record.tenant_id, p_month, v_record.effective_plan)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'month', COALESCE(p_month, date_trunc('month', CURRENT_DATE)::date),
    'tenants_updated', jsonb_array_length(v_results),
    'results', v_results
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_run_sync(p_tenant_id UUID, p_estimated_rows INTEGER DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_budget RECORD;
  v_counter RECORD;
BEGIN
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);

  SELECT * INTO v_budget
  FROM public.org_usage_budgets
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT * INTO v_counter
  FROM public.org_usage_counters
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  IF v_budget.max_sync_jobs >= 0
     AND (v_counter.sync_jobs_used + 1) > v_budget.max_sync_jobs THEN
    RETURN 'deny';
  END IF;

  RETURN 'allow';
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_run_sync(p_org_id UUID, p_provider pos_provider)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_budget RECORD;
  v_counter RECORD;
  v_max_concurrent INTEGER;
  v_current_active INTEGER;
BEGIN
  PERFORM public.ensure_org_usage_initialized(p_org_id);

  SELECT * INTO v_budget
  FROM public.org_usage_budgets
  WHERE tenant_id = p_org_id
    AND month = v_month;

  SELECT * INTO v_counter
  FROM public.org_usage_counters
  WHERE tenant_id = p_org_id
    AND month = v_month;

  SELECT COALESCE(pd.max_concurrent_jobs, 1)
  INTO v_max_concurrent
  FROM public.plan_definitions pd
  WHERE pd.plan = v_budget.plan;

  SELECT COUNT(*)
  INTO v_current_active
  FROM public.pos_sync_jobs_v2
  WHERE tenant_id = p_org_id
    AND provider = p_provider
    AND status = 'in_progress'
    AND started_at > now() - INTERVAL '30 minutes';

  IF v_budget.max_sync_jobs >= 0
     AND (v_counter.sync_jobs_used + 1) > v_budget.max_sync_jobs THEN
    RETURN jsonb_build_object(
      'allow', false,
      'status', 'denied',
      'reason', 'monthly_limit_reached',
      'current', v_counter.sync_jobs_used,
      'max', v_budget.max_sync_jobs,
      'plan', v_budget.plan,
      'message', 'Monthly usage limit reached. Please upgrade your plan.'
    );
  END IF;

  IF v_max_concurrent >= 0
     AND v_current_active >= v_max_concurrent THEN
    RETURN jsonb_build_object(
      'allow', false,
      'status', 'denied',
      'reason', 'concurrent_limit_reached',
      'current', v_current_active,
      'max', v_max_concurrent,
      'plan', v_budget.plan,
      'message', 'Concurrent sync limit reached. Please wait for the active sync to finish.'
    );
  END IF;

  RETURN jsonb_build_object(
    'allow', true,
    'status', 'allow',
    'current', v_current_active,
    'max', v_max_concurrent,
    'plan', v_budget.plan,
    'message', 'Sync can be queued.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_pos_sync_job(
  p_tenant_id UUID,
  p_provider pos_provider,
  p_sync_type pos_sync_type DEFAULT 'full',
  p_estimated_rows INTEGER DEFAULT 0,
  p_triggered_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
  v_budget RECORD;
  v_counter RECORD;
  v_gate JSONB;
  v_existing_job public.pos_sync_jobs_v2;
  v_job public.pos_sync_jobs_v2;
BEGIN
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);

  SELECT * INTO v_budget
  FROM public.org_usage_budgets
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT * INTO v_counter
  FROM public.org_usage_counters
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  SELECT *
  INTO v_existing_job
  FROM public.pos_sync_jobs_v2
  WHERE tenant_id = p_tenant_id
    AND provider = p_provider
    AND sync_type = COALESCE(p_sync_type, 'full')
    AND status IN ('pending', 'in_progress', 'delayed')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_job.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_existing_job.id,
      'jobId', v_existing_job.id,
      'job_id', v_existing_job.id,
      'status', 'queued',
      'reason', 'already_queued',
      'message', 'A sync job is already queued for this tenant and sync type.',
      'success', true,
      'plan', v_budget.plan,
      'current', v_counter.sync_jobs_used,
      'max', v_budget.max_sync_jobs
    );
  END IF;

  v_gate := public.can_run_sync(p_tenant_id, p_provider);
  IF COALESCE((v_gate->>'allow')::boolean, false) = false THEN
    RETURN jsonb_build_object(
      'id', NULL,
      'jobId', NULL,
      'job_id', NULL,
      'status', 'denied',
      'reason', v_gate->>'reason',
      'message', COALESCE(v_gate->>'message', 'Sync could not be queued.'),
      'success', false,
      'plan', COALESCE(v_gate->>'plan', v_budget.plan),
      'current', COALESCE((v_gate->>'current')::integer, v_counter.sync_jobs_used),
      'max', COALESCE((v_gate->>'max')::integer, v_budget.max_sync_jobs)
    );
  END IF;

  INSERT INTO public.pos_sync_jobs_v2 (
    tenant_id,
    provider,
    sync_type,
    status,
    estimated_rows,
    triggered_by,
    scheduled_at,
    progress_message,
    batch_size,
    max_retries,
    created_at,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_provider,
    COALESCE(p_sync_type, 'full'),
    'pending',
    COALESCE(p_estimated_rows, 0),
    COALESCE(p_triggered_by, 'manual'),
    now(),
    'Queued - waiting to start',
    100,
    3,
    now(),
    now()
  )
  RETURNING * INTO v_job;

  UPDATE public.org_usage_counters
  SET sync_jobs_used = sync_jobs_used + 1,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND month = v_month;

  RETURN jsonb_build_object(
    'id', v_job.id,
    'jobId', v_job.id,
    'job_id', v_job.id,
    'status', 'queued',
    'reason', 'queued',
    'message', 'Sync job queued successfully.',
    'success', true,
    'plan', v_budget.plan,
    'current', v_counter.sync_jobs_used + 1,
    'max', v_budget.max_sync_jobs
  );
END;
$function$;

SELECT public.admin_backfill_subscription_budgets(
  date_trunc('month', CURRENT_DATE)::date
);

NOTIFY pgrst, 'reload schema';