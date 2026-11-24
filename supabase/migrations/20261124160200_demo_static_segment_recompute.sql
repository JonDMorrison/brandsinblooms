-- NOT YET APPLIED to udldmkqwnxhdeztyqcau: apply_migration needed an interactive
-- confirmation that nobody could answer during workspace QA pass 3.
-- Apply after review (Supabase SQL editor or apply_migration), then rename this
-- file to the recorded version.
-- workspace-qa3 #9: static demo segments are recomputed from their own rules
-- after the daily date shift (called at the end of refresh_greenfield_demo),
-- so no member breaks its segment's rule.

-- workspace-qa3 #9: rule SQL for the seeded static demo segments (whitelisted
-- fields and operators only; anything else raises so a bad rule never
-- silently empties or fills a segment).
CREATE OR REPLACE FUNCTION intelligence_ops.greenfield_segment_rule_sql(p_conditions jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_rule jsonb;
  v_field text;
  v_op text;
  v_value jsonb;
  v_parts text[] := ARRAY[]::text[];
  v_logic text := upper(coalesce(p_conditions->>'logic', 'AND'));
BEGIN
  IF jsonb_typeof(p_conditions->'rules') <> 'array' OR jsonb_array_length(p_conditions->'rules') = 0 THEN
    RAISE EXCEPTION 'Demo segment has no rules';
  END IF;
  FOR v_rule IN SELECT value FROM jsonb_array_elements(p_conditions->'rules') LOOP
    v_field := v_rule->>'field';
    v_op := lower(coalesce(v_rule->>'op', v_rule->>'operator'));
    v_value := v_rule->'value';
    IF v_field IN ('email_opt_in', 'sms_opt_in', 'is_vip') AND v_op IN ('eq', '=') THEN
      v_parts := v_parts || format('c.%I = %L::boolean', v_field, v_value #>> '{}');
    ELSIF v_field IN ('total_spent', 'lifetime_value', 'pos_order_count')
          AND v_op IN ('eq', '=', 'gte', '>=', 'gt', '>', 'lte', '<=', 'lt', '<') THEN
      v_parts := v_parts || format('coalesce(c.%I, 0) %s %L::numeric', v_field,
        CASE v_op WHEN 'eq' THEN '=' WHEN 'gte' THEN '>=' WHEN 'gt' THEN '>'
          WHEN 'lte' THEN '<=' WHEN 'lt' THEN '<' ELSE v_op END,
        v_value #>> '{}');
    ELSIF v_field IN ('last_purchase_date', 'first_purchase_date') AND v_op = 'within_days' THEN
      v_parts := v_parts || format('c.%I >= current_date - %L::int', v_field, v_value #>> '{}');
    ELSIF v_field IN ('last_purchase_date', 'first_purchase_date') AND v_op = 'older_than_days' THEN
      v_parts := v_parts || format('c.%I < current_date - %L::int', v_field, v_value #>> '{}');
    ELSIF v_field = 'tags' AND v_op = 'contains' THEN
      v_parts := v_parts || format('%L = ANY(coalesce(c.tags, ARRAY[]::text[]))', v_value #>> '{}');
    ELSE
      RAISE EXCEPTION 'Unsupported demo segment rule: % %', v_field, v_op;
    END IF;
  END LOOP;
  RETURN '(' || array_to_string(v_parts, CASE WHEN v_logic = 'OR' THEN ' OR ' ELSE ' AND ' END) || ')';
END;
$function$;

CREATE OR REPLACE FUNCTION intelligence_ops.recompute_greenfield_static_segments(p_tenant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'intelligence_ops'
AS $function$
DECLARE
  v_segment record;
  v_where text;
BEGIN
  IF p_tenant IS DISTINCT FROM '3eade43c-2e5a-4ad0-80fb-500e3d7afbd4'::uuid THEN
    RAISE EXCEPTION 'Only the demo tenant can be recomputed';
  END IF;

  -- Skip the per-row count trigger; counts are written once below.
  PERFORM set_config('bloomsuite.bulk_segment_copy', 'on', true);

  FOR v_segment IN
    SELECT id, conditions FROM public.crm_segments
    WHERE tenant_id = p_tenant
      AND deleted_at IS NULL
      AND auto_update IS NOT TRUE
      AND id IN (
        '3cc2333b-ab67-46dc-93d0-87d19f9a3894', -- Birthday Club
        'b2cb2978-2d77-407b-99be-ab881e99468d', -- Email Subscribers
        'cc9bbbc3-621a-47c6-8448-c3da51cd644c', -- Lapsed (12+ months)
        'e58d745d-4968-4d71-9cb0-594a7e1c3794', -- This Season's Customers
        '62382792-0ff4-4338-bb03-05d14bb0075d'  -- VIP Buyers
      )
  LOOP
    v_where := intelligence_ops.greenfield_segment_rule_sql(v_segment.conditions);

    EXECUTE format(
      'DELETE FROM public.customer_segments cs
        USING public.crm_customers c
        WHERE cs.segment_id = %L AND c.id = cs.customer_id
          AND NOT %s', v_segment.id, v_where);
    -- Members whose customer row is gone or left the tenant.
    DELETE FROM public.customer_segments cs
     WHERE cs.segment_id = v_segment.id
       AND NOT EXISTS (
         SELECT 1 FROM public.crm_customers c
          WHERE c.id = cs.customer_id AND c.tenant_id = p_tenant AND c.deleted_at IS NULL);

    EXECUTE format(
      'INSERT INTO public.customer_segments (customer_id, segment_id)
       SELECT c.id, %L FROM public.crm_customers c
        WHERE c.tenant_id = %L AND c.deleted_at IS NULL AND %s
       ON CONFLICT (customer_id, segment_id) DO NOTHING',
      v_segment.id, p_tenant, v_where);

    UPDATE public.crm_segments s
       SET customer_count = (SELECT count(*) FROM public.customer_segments cs WHERE cs.segment_id = s.id)
     WHERE s.id = v_segment.id;
  END LOOP;

  PERFORM set_config('bloomsuite.bulk_segment_copy', 'off', true);
END;
$function$;

REVOKE ALL ON FUNCTION intelligence_ops.recompute_greenfield_static_segments(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION intelligence_ops.greenfield_segment_rule_sql(jsonb) FROM PUBLIC, anon, authenticated;

SELECT intelligence_ops.refresh_greenfield_demo();
