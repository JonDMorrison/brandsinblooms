-- Finish the built-in group cleanup started in 20261102160000 (West Coast).
--
-- 1. Archive duplicate built-in groups in every other company: keep the oldest
--    live copy per company and name, soft delete the rest. Any campaign or
--    automation reference to a duplicate is first repointed to the kept copy.
--    Memberships of archived duplicates are removed (they are rule-derived and
--    the kept copy is re-evaluated by evaluate-segments).
-- 2. Watchdog orphan check: only count memberships in live groups. Archived
--    demo groups that still hold archived demo customers are not a problem.

SET LOCAL statement_timeout = '15min';
ALTER TABLE public.customer_segments DISABLE TRIGGER trigger_update_segment_count_delete;

CREATE TEMP TABLE _dupes ON COMMIT DROP AS
SELECT id, keeper_id
FROM (
  SELECT
    id,
    first_value(id) OVER w AS keeper_id,
    row_number() OVER w AS rn
  FROM public.crm_segments
  WHERE is_system_segment AND deleted_at IS NULL
  WINDOW w AS (PARTITION BY tenant_id, lower(btrim(name)) ORDER BY created_at, id)
) ranked
WHERE rn > 1;

UPDATE public.crm_campaigns c SET segment_id = d.keeper_id, updated_at = now()
FROM _dupes d WHERE c.segment_id = d.id;
UPDATE public.crm_sms_campaigns c SET segment_id = d.keeper_id
FROM _dupes d WHERE c.segment_id = d.id;
UPDATE public.crm_push_campaigns c SET segment_id = d.keeper_id
FROM _dupes d WHERE c.segment_id = d.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.campaign_segments c JOIN _dupes d ON d.id = c.segment_id
    UNION ALL SELECT 1 FROM public.automation_trigger_events c JOIN _dupes d ON d.id = c.segment_id
    UNION ALL SELECT 1 FROM public.segment_location_targets c JOIN _dupes d ON d.id = c.segment_id
    UNION ALL SELECT 1 FROM public.crm_automations a JOIN _dupes d
      ON a.trigger_conditions->>'segment_id' = d.id::text
      OR a.flow_state->'nodes'->0->'data'->'conditions'->>'segment_id' = d.id::text
  ) THEN
    RAISE EXCEPTION 'A duplicate built-in group is still referenced; repoint it before archiving';
  END IF;
END;
$$;

DELETE FROM public.customer_segments cs USING _dupes d WHERE cs.segment_id = d.id;

UPDATE public.crm_segments s
SET deleted_at = now(), status = 'archived', customer_count = 0, updated_at = now()
FROM _dupes d WHERE s.id = d.id;

ALTER TABLE public.customer_segments ENABLE TRIGGER trigger_update_segment_count_delete;

DO $mig$
DECLARE
  def text;
  anchor text := 'AND EXISTS (SELECT 1 FROM public.customer_segments cs WHERE cs.customer_id = c.id)';
BEGIN
  SELECT pg_get_functiondef('bloom_support.watchdog()'::regprocedure) INTO def;
  IF position('JOIN public.crm_segments live_s' in def) > 0 THEN RETURN; END IF;
  IF position(anchor in def) = 0 THEN RAISE EXCEPTION 'watchdog orphan anchor not found'; END IF;
  def := replace(def, anchor,
    'AND EXISTS (SELECT 1 FROM public.customer_segments cs JOIN public.crm_segments live_s ON live_s.id = cs.segment_id AND live_s.deleted_at IS NULL WHERE cs.customer_id = c.id)');
  EXECUTE def;
END $mig$;
