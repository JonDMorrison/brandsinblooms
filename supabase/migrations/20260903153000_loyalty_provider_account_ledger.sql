-- Normalize provider loyalty balances without pretending imported balances are
-- native BloomSuite earn/redeem events. Current provider state and immutable
-- snapshots remain distinct from the native points transaction ledger.

CREATE TABLE public.loyalty_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider ~ '^[a-z0-9_-]{1,50}$'),
  external_account_id text NOT NULL CHECK (
    char_length(trim(external_account_id)) BETWEEN 1 AND 255
  ),
  external_program_id text CHECK (
    external_program_id IS NULL
    OR char_length(trim(external_program_id)) BETWEEN 1 AND 255
  ),
  program_name text CHECK (
    program_name IS NULL OR char_length(trim(program_name)) BETWEEN 1 AND 255
  ),
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_value numeric NOT NULL DEFAULT 0 CHECK (lifetime_value >= 0),
  balance_unit text NOT NULL CHECK (
    balance_unit IN ('points', 'currency', 'unknown')
  ),
  currency text CHECK (
    (balance_unit = 'currency' AND currency ~ '^[A-Z]{3}$')
    OR (balance_unit <> 'currency' AND currency IS NULL)
  ),
  enrolled_at timestamptz,
  last_synced_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'disconnected', 'archived')
  ),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (tenant_id, provider, external_account_id)
);

CREATE INDEX idx_loyalty_provider_accounts_customer
  ON public.loyalty_provider_accounts (tenant_id, customer_id, provider);

CREATE TABLE public.loyalty_provider_balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.loyalty_provider_accounts(id) ON DELETE CASCADE,
  balance numeric NOT NULL CHECK (balance >= 0),
  lifetime_value numeric NOT NULL CHECK (lifetime_value >= 0),
  balance_unit text NOT NULL CHECK (
    balance_unit IN ('points', 'currency', 'unknown')
  ),
  currency text CHECK (
    (balance_unit = 'currency' AND currency ~ '^[A-Z]{3}$')
    OR (balance_unit <> 'currency' AND currency IS NULL)
  ),
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (account_id, observed_at, balance, lifetime_value)
);

CREATE INDEX idx_loyalty_provider_snapshots_account_time
  ON public.loyalty_provider_balance_snapshots (account_id, observed_at DESC);
CREATE INDEX idx_loyalty_provider_snapshots_customer_time
  ON public.loyalty_provider_balance_snapshots (
    tenant_id, customer_id, observed_at DESC
  );

CREATE OR REPLACE FUNCTION public.validate_loyalty_provider_account_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_customers AS customer
    WHERE customer.id = NEW.customer_id
      AND customer.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Loyalty customer does not belong to tenant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_loyalty_provider_snapshot_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.loyalty_provider_accounts AS account
    WHERE account.id = NEW.account_id
      AND account.tenant_id = NEW.tenant_id
      AND account.customer_id = NEW.customer_id
      AND account.balance_unit = NEW.balance_unit
      AND account.currency IS NOT DISTINCT FROM NEW.currency
  ) THEN
    RAISE EXCEPTION 'Loyalty snapshot does not match its provider account'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_loyalty_provider_account_tenant
BEFORE INSERT OR UPDATE OF tenant_id, customer_id
ON public.loyalty_provider_accounts
FOR EACH ROW EXECUTE FUNCTION public.validate_loyalty_provider_account_tenant();

CREATE TRIGGER validate_loyalty_provider_snapshot_tenant
BEFORE INSERT ON public.loyalty_provider_balance_snapshots
FOR EACH ROW EXECUTE FUNCTION public.validate_loyalty_provider_snapshot_tenant();

ALTER TABLE public.loyalty_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_provider_balance_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.loyalty_provider_accounts
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.loyalty_provider_balance_snapshots
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.loyalty_provider_accounts TO authenticated;
GRANT SELECT ON TABLE public.loyalty_provider_balance_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.loyalty_provider_accounts TO service_role;
GRANT SELECT, INSERT
  ON TABLE public.loyalty_provider_balance_snapshots TO service_role;

CREATE POLICY "Tenant users can view provider loyalty accounts"
ON public.loyalty_provider_accounts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.tenant_id = loyalty_provider_accounts.tenant_id
  )
);

CREATE POLICY "Tenant users can view provider loyalty snapshots"
ON public.loyalty_provider_balance_snapshots
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.tenant_id = loyalty_provider_balance_snapshots.tenant_id
  )
);

CREATE OR REPLACE FUNCTION public.sync_loyalty_account_snapshot(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_provider text,
  p_external_account_id text,
  p_external_program_id text,
  p_program_name text,
  p_balance numeric,
  p_lifetime_value numeric,
  p_balance_unit text,
  p_currency text,
  p_enrolled_at timestamptz,
  p_observed_at timestamptz DEFAULT statement_timestamp()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account public.loyalty_provider_accounts%ROWTYPE;
  v_provider text := lower(trim(p_provider));
  v_external_account_id text := trim(p_external_account_id);
  v_currency text := upper(trim(p_currency));
  v_changed boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF v_provider !~ '^[a-z0-9_-]{1,50}$'
     OR char_length(v_external_account_id) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'Invalid loyalty provider identity';
  END IF;
  IF p_balance IS NULL OR p_balance < 0
     OR p_lifetime_value IS NULL OR p_lifetime_value < 0 THEN
    RAISE EXCEPTION 'Loyalty balances must be non-negative';
  END IF;
  IF p_balance_unit NOT IN ('points', 'currency', 'unknown') THEN
    RAISE EXCEPTION 'Invalid loyalty balance unit';
  END IF;
  IF p_balance_unit = 'currency' THEN
    IF v_currency !~ '^[A-Z]{3}$' THEN
      RAISE EXCEPTION 'Currency balances require an ISO currency code';
    END IF;
  ELSE
    v_currency := NULL;
  END IF;
  IF p_balance_unit = 'points'
     AND (p_balance <> trunc(p_balance) OR p_lifetime_value <> trunc(p_lifetime_value)
       OR p_balance > 2147483647 OR p_lifetime_value > 2147483647) THEN
    RAISE EXCEPTION 'Point balances must be whole 32-bit integers';
  END IF;
  IF p_observed_at IS NULL
     OR p_observed_at > statement_timestamp() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Invalid loyalty snapshot timestamp';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_customers AS customer
    WHERE customer.id = p_customer_id
      AND customer.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Loyalty customer does not belong to tenant'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_account
  FROM public.loyalty_provider_accounts AS account
  WHERE account.tenant_id = p_tenant_id
    AND account.provider = v_provider
    AND account.external_account_id = v_external_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.loyalty_provider_accounts (
      tenant_id, customer_id, provider, external_account_id,
      external_program_id, program_name, balance, lifetime_value,
      balance_unit, currency, enrolled_at, last_synced_at
    ) VALUES (
      p_tenant_id, p_customer_id, v_provider, v_external_account_id,
      nullif(trim(p_external_program_id), ''), nullif(trim(p_program_name), ''),
      p_balance, p_lifetime_value, p_balance_unit, v_currency,
      p_enrolled_at, p_observed_at
    )
    RETURNING * INTO v_account;
    v_changed := true;
  ELSE
    IF v_account.customer_id IS DISTINCT FROM p_customer_id THEN
      RAISE EXCEPTION 'Loyalty provider account is already linked to another customer'
        USING ERRCODE = '23505';
    END IF;

    v_changed := v_account.balance IS DISTINCT FROM p_balance
      OR v_account.lifetime_value IS DISTINCT FROM p_lifetime_value
      OR v_account.balance_unit IS DISTINCT FROM p_balance_unit
      OR v_account.currency IS DISTINCT FROM v_currency
      OR v_account.external_program_id IS DISTINCT FROM nullif(trim(p_external_program_id), '')
      OR v_account.program_name IS DISTINCT FROM nullif(trim(p_program_name), '');

    UPDATE public.loyalty_provider_accounts AS account
    SET external_program_id = nullif(trim(p_external_program_id), ''),
        program_name = nullif(trim(p_program_name), ''),
        balance = p_balance,
        lifetime_value = p_lifetime_value,
        balance_unit = p_balance_unit,
        currency = v_currency,
        enrolled_at = coalesce(account.enrolled_at, p_enrolled_at),
        last_synced_at = greatest(account.last_synced_at, p_observed_at),
        status = 'active',
        updated_at = statement_timestamp()
    WHERE account.id = v_account.id
    RETURNING * INTO v_account;
  END IF;

  IF v_changed THEN
    INSERT INTO public.loyalty_provider_balance_snapshots (
      tenant_id, customer_id, account_id, balance, lifetime_value,
      balance_unit, currency, observed_at
    ) VALUES (
      p_tenant_id, p_customer_id, v_account.id, p_balance,
      p_lifetime_value, p_balance_unit, v_currency, p_observed_at
    )
    ON CONFLICT (account_id, observed_at, balance, lifetime_value) DO NOTHING;
  END IF;

  UPDATE public.crm_customers AS customer
  SET loyalty_member = true,
      updated_at = statement_timestamp()
  WHERE customer.id = p_customer_id
    AND customer.tenant_id = p_tenant_id
    AND customer.loyalty_member IS DISTINCT FROM true;

  IF p_balance_unit = 'points' THEN
    INSERT INTO public.customer_loyalty_metrics (
      customer_id, tenant_id, is_perks_member, perks_enrolled_at,
      total_points_earned, current_points_balance
    ) VALUES (
      p_customer_id, p_tenant_id, true, p_enrolled_at,
      p_lifetime_value::integer, p_balance::integer
    )
    ON CONFLICT (customer_id) DO UPDATE SET
      is_perks_member = true,
      perks_enrolled_at = coalesce(
        public.customer_loyalty_metrics.perks_enrolled_at,
        excluded.perks_enrolled_at
      ),
      total_points_earned = greatest(
        coalesce(public.customer_loyalty_metrics.total_points_earned, 0),
        excluded.total_points_earned
      ),
      current_points_balance = excluded.current_points_balance,
      updated_at = statement_timestamp();
  END IF;

  RETURN jsonb_build_object(
    'accountId', v_account.id,
    'changed', v_changed,
    'balance', p_balance,
    'lifetimeValue', p_lifetime_value,
    'unit', p_balance_unit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_loyalty_account_snapshot(
  uuid, uuid, text, text, text, text, numeric, numeric,
  text, text, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_loyalty_account_snapshot(
  uuid, uuid, text, text, text, text, numeric, numeric,
  text, text, timestamptz, timestamptz
) TO service_role;
REVOKE ALL ON FUNCTION public.validate_loyalty_provider_account_tenant()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_loyalty_provider_snapshot_tenant()
  FROM PUBLIC, anon, authenticated;

-- Preserve current imported state with an explicit source and unit. This is a
-- baseline snapshot, not fabricated earn/redeem activity.
INSERT INTO public.loyalty_provider_accounts (
  tenant_id, customer_id, provider, external_account_id, program_name,
  balance, lifetime_value, balance_unit, enrolled_at, last_synced_at
)
SELECT
  metric.tenant_id, metric.customer_id, 'legacy_metrics', metric.id::text,
  'Imported loyalty metrics', greatest(coalesce(metric.current_points_balance, 0), 0),
  greatest(coalesce(metric.total_points_earned, 0), 0), 'points',
  metric.perks_enrolled_at, coalesce(metric.updated_at, metric.created_at, statement_timestamp())
FROM public.customer_loyalty_metrics AS metric
ON CONFLICT (tenant_id, provider, external_account_id) DO NOTHING;

INSERT INTO public.loyalty_provider_accounts (
  tenant_id, customer_id, provider, external_account_id, program_name,
  balance, lifetime_value, balance_unit, last_synced_at
)
SELECT
  customer.tenant_id, customer.id, 'crm_import', customer.id::text,
  'Imported POS loyalty balance', greatest(coalesce(customer.loyalty_rewards_balance, 0), 0),
  greatest(coalesce(customer.loyalty_rewards_balance, 0), 0), 'unknown',
  coalesce(customer.updated_at, customer.created_at, statement_timestamp())
FROM public.crm_customers AS customer
WHERE customer.loyalty_member = true
   OR coalesce(customer.loyalty_rewards_balance, 0) > 0
ON CONFLICT (tenant_id, provider, external_account_id) DO NOTHING;

INSERT INTO public.loyalty_provider_balance_snapshots (
  tenant_id, customer_id, account_id, balance, lifetime_value,
  balance_unit, currency, observed_at
)
SELECT
  account.tenant_id, account.customer_id, account.id, account.balance,
  account.lifetime_value, account.balance_unit, account.currency,
  account.last_synced_at
FROM public.loyalty_provider_accounts AS account
ON CONFLICT (account_id, observed_at, balance, lifetime_value) DO NOTHING;

COMMENT ON TABLE public.loyalty_provider_accounts IS
  'Current provider-specific loyalty account state linked to one resolved CRM customer.';
COMMENT ON TABLE public.loyalty_provider_balance_snapshots IS
  'Immutable history of imported provider loyalty balances with explicit units.';
COMMENT ON FUNCTION public.sync_loyalty_account_snapshot(
  uuid, uuid, text, text, text, text, numeric, numeric,
  text, text, timestamptz, timestamptz
) IS 'Atomically records a provider loyalty snapshot and updates normalized point metrics.';
