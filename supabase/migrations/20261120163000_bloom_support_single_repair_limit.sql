-- Cost guard: allow only one Bloom coding repair at a time across CMS, CRM and POS.
-- Reuse the existing bounded, database-backed repair_capacity gate; do not add
-- a second dispatcher, agent, retry loop or recurring monitor.
-- Existing in-flight work is not cancelled. New dispatches wait for capacity.
-- Rollback (if intentionally approved): set limits.max_concurrent_repairs back
-- to its prior recorded value; never change max_repair_attempts here.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

DO $$
BEGIN
  UPDATE bloom_support.settings
  SET value = jsonb_set(
    coalesce(value, '{}'::jsonb),
    '{max_concurrent_repairs}',
    '1'::jsonb,
    true
  )
  WHERE key = 'limits';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bloom Support limits setting missing; capacity policy was not changed';
  END IF;
END $$;
