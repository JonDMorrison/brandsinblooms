-- Built-in (system) customer groups: stop duplicates, fix misleading rules.
--
-- 1. ensure_system_segments: idempotent creation under a per-tenant lock.
--    The Segments page used to insert every "missing" built-in group whenever
--    its segment list came back empty (including on a failed or slow load),
--    which created 3-10 copies per tenant.
-- 2. West Coast Gardens: keep the oldest copy of each built-in group, archive
--    the rest (soft delete) and drop their derived memberships, which are
--    identical to the kept copy.
-- 3. Built-in group memberships must only contain live customers. Archived
--    demo customers stayed in High-Value, Lapsed and Loyalty for West Coast.
-- 4. "New Customers" used the CRM record creation date, so every imported
--    customer counted as new. It now uses the first purchase date, as its
--    description already said. "Frequent Buyers" read a column that does not
--    exist (order_count); it now reads pos_order_count.
--    Only built-in groups still on the original default rule are changed.

CREATE OR REPLACE FUNCTION public.ensure_system_segments(
  p_tenant_id uuid,
  p_segments jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF p_tenant_id IS NULL OR jsonb_typeof(p_segments) <> 'array' THEN
    RAISE EXCEPTION 'tenant and segment list are required';
  END IF;

  -- Serialize concurrent callers for the same tenant (several tabs, remounts).
  PERFORM pg_advisory_xact_lock(hashtextextended('system_segments:' || p_tenant_id::text, 0));

  INSERT INTO public.crm_segments (
    tenant_id, user_id, name, description, conditions, auto_update,
    status, is_system_segment, customer_count
  )
  SELECT
    p_tenant_id,
    auth.uid(),
    def->>'name',
    def->>'description',
    coalesce(def->'conditions', '{}'::jsonb),
    true,
    'active',
    true,
    0
  FROM jsonb_array_elements(p_segments) AS def
  WHERE coalesce(btrim(def->>'name'), '') <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.crm_segments existing
      WHERE existing.tenant_id = p_tenant_id
        AND existing.deleted_at IS NULL
        AND lower(btrim(existing.name)) = lower(btrim(def->>'name'))
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_system_segments(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_system_segments(uuid, jsonb) TO authenticated;

-- Bulk membership changes below: the per-row count triggers would recount a
-- whole group on every deleted row and time out. Counts are recomputed once at
-- the end instead. The automation trigger stays enabled.
SET LOCAL statement_timeout = '15min';
ALTER TABLE public.customer_segments DISABLE TRIGGER trigger_update_segment_count_delete;
ALTER TABLE public.customer_segments DISABLE TRIGGER trigger_update_segment_count_insert;

-- 2. West Coast Gardens duplicate built-in groups.
CREATE TEMP TABLE _wcg_duplicate_segments ON COMMIT DROP AS
SELECT id
FROM (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, lower(btrim(name))
      ORDER BY created_at, id
    ) AS rn
  FROM public.crm_segments
  WHERE tenant_id = 'c190325a-5da0-49f6-b374-187464762021'
    AND is_system_segment
    AND deleted_at IS NULL
) ranked
WHERE rn > 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.crm_campaigns c JOIN _wcg_duplicate_segments d ON d.id = c.segment_id
    UNION ALL SELECT 1 FROM public.crm_sms_campaigns c JOIN _wcg_duplicate_segments d ON d.id = c.segment_id
    UNION ALL SELECT 1 FROM public.crm_push_campaigns c JOIN _wcg_duplicate_segments d ON d.id = c.segment_id
    UNION ALL SELECT 1 FROM public.campaign_segments c JOIN _wcg_duplicate_segments d ON d.id = c.segment_id
    UNION ALL SELECT 1 FROM public.automation_trigger_events c JOIN _wcg_duplicate_segments d ON d.id = c.segment_id
    UNION ALL SELECT 1 FROM public.segment_location_targets c JOIN _wcg_duplicate_segments d ON d.id = c.segment_id
  ) THEN
    RAISE EXCEPTION 'A duplicate West Coast built-in group is referenced; repoint it before archiving';
  END IF;
END;
$$;

DELETE FROM public.customer_segments cs
USING _wcg_duplicate_segments d
WHERE cs.segment_id = d.id;

UPDATE public.crm_segments s
SET deleted_at = now(),
    status = 'archived',
    customer_count = 0,
    updated_at = now()
FROM _wcg_duplicate_segments d
WHERE s.id = d.id;

-- 3. West Coast built-in group memberships: live customers only.
DELETE FROM public.customer_segments cs
USING public.crm_segments s, public.crm_customers c
WHERE cs.segment_id = s.id
  AND c.id = cs.customer_id
  AND s.tenant_id = 'c190325a-5da0-49f6-b374-187464762021'
  AND s.is_system_segment
  AND (c.deleted_at IS NOT NULL OR c.merged_into_customer_id IS NOT NULL);

-- 4. Correct the two default rules on built-in groups that still use them.
CREATE TEMP TABLE _rule_fixed_segments ON COMMIT DROP AS
SELECT id, tenant_id, lower(btrim(name)) AS key
FROM public.crm_segments
WHERE is_system_segment
  AND deleted_at IS NULL
  AND (
    (lower(btrim(name)) = 'new customers'
      AND conditions = '{"logic":"AND","rules":[{"field":"created_at","value":30,"operator":"within_days"}]}'::jsonb)
    OR
    (lower(btrim(name)) = 'frequent buyers'
      AND conditions = '{"logic":"AND","rules":[{"field":"order_count","value":3,"operator":">="}]}'::jsonb)
  );

UPDATE public.crm_segments s
SET conditions = CASE f.key
      WHEN 'new customers' THEN '{"logic":"AND","rules":[{"field":"first_purchase_date","value":30,"operator":"within_days"}]}'::jsonb
      ELSE '{"logic":"AND","rules":[{"field":"pos_order_count","value":3,"operator":">="}]}'::jsonb
    END,
    updated_at = now()
FROM _rule_fixed_segments f
WHERE s.id = f.id;

-- Recompute memberships for the corrected groups (same rule the evaluator uses).
DELETE FROM public.customer_segments cs
USING _rule_fixed_segments f
WHERE cs.segment_id = f.id
  AND NOT EXISTS (
    SELECT 1 FROM public.crm_customers c
    WHERE c.id = cs.customer_id
      AND c.tenant_id = f.tenant_id
      AND c.deleted_at IS NULL
      AND c.merged_into_customer_id IS NULL
      AND CASE f.key
        WHEN 'new customers' THEN c.first_purchase_date >= (now() - interval '30 days')::date
        ELSE coalesce(c.pos_order_count, 0) >= 3
      END
  );

INSERT INTO public.customer_segments (customer_id, segment_id, assigned_at)
SELECT c.id, f.id, now()
FROM _rule_fixed_segments f
JOIN public.crm_customers c ON c.tenant_id = f.tenant_id
WHERE c.deleted_at IS NULL
  AND c.merged_into_customer_id IS NULL
  AND CASE f.key
    WHEN 'new customers' THEN c.first_purchase_date >= (now() - interval '30 days')::date
    ELSE coalesce(c.pos_order_count, 0) >= 3
  END
ON CONFLICT (customer_id, segment_id) DO NOTHING;

-- Refresh stored counts for every group touched above.
UPDATE public.crm_segments s
SET customer_count = (
      SELECT count(*) FROM public.customer_segments cs WHERE cs.segment_id = s.id
    ),
    updated_at = now()
WHERE s.id IN (SELECT id FROM _rule_fixed_segments)
   OR (s.tenant_id = 'c190325a-5da0-49f6-b374-187464762021'
       AND s.is_system_segment
       AND s.deleted_at IS NULL);

ALTER TABLE public.customer_segments ENABLE TRIGGER trigger_update_segment_count_delete;
ALTER TABLE public.customer_segments ENABLE TRIGGER trigger_update_segment_count_insert;
