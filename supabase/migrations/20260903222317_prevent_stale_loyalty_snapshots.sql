-- Provider retries can arrive out of order. A late, stale response must not
-- roll a current rewards balance backward while retaining the newer
-- last_synced_at timestamp.

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_provider_snapshot_observation_unique
  ON public.loyalty_provider_balance_snapshots (account_id, observed_at);

CREATE OR REPLACE FUNCTION public.prevent_stale_loyalty_account_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.last_synced_at < OLD.last_synced_at
     AND (
       NEW.balance IS DISTINCT FROM OLD.balance
       OR NEW.lifetime_value IS DISTINCT FROM OLD.lifetime_value
       OR NEW.balance_unit IS DISTINCT FROM OLD.balance_unit
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.external_program_id IS DISTINCT FROM OLD.external_program_id
       OR NEW.program_name IS DISTINCT FROM OLD.program_name
     ) THEN
    RAISE EXCEPTION 'Stale loyalty snapshot cannot replace newer provider state'
      USING ERRCODE = '22000';
  END IF;

  IF NEW.last_synced_at = OLD.last_synced_at
     AND (
       NEW.balance IS DISTINCT FROM OLD.balance
       OR NEW.lifetime_value IS DISTINCT FROM OLD.lifetime_value
       OR NEW.balance_unit IS DISTINCT FROM OLD.balance_unit
       OR NEW.currency IS DISTINCT FROM OLD.currency
     ) THEN
    RAISE EXCEPTION 'Conflicting loyalty snapshots share an observation time'
      USING ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_stale_loyalty_account_update
  ON public.loyalty_provider_accounts;
CREATE TRIGGER prevent_stale_loyalty_account_update
BEFORE UPDATE OF balance, lifetime_value, balance_unit, currency,
  external_program_id, program_name, last_synced_at
ON public.loyalty_provider_accounts
FOR EACH ROW EXECUTE FUNCTION public.prevent_stale_loyalty_account_update();

REVOKE ALL ON FUNCTION public.prevent_stale_loyalty_account_update()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.prevent_stale_loyalty_account_update() IS
  'Rejects out-of-order or conflicting provider loyalty state before it can overwrite the current customer balance.';
