-- Bloom chat spending cap, per company (CRM tenant), per calendar month (UTC).
--
-- bloom-assist reserves an estimated cost before every model call and settles
-- the actual cost from the provider's token usage afterwards. The running
-- monthly total reuses bloom_support.usage_counters (the counter Bloom Support
-- already uses for its daily model budget): bucket 'chat-spend:YYYY-MM',
-- subject = tenant id, count = committed spend in micro-USD (settled calls plus
-- reservations still in flight). The per-call ledger is bloom_support.chat_usage.
--
-- Cap = per-tenant override (bloom_support.chat_spend_caps) or the platform
-- default (settings key 'chat_spend'). Only principals with admin.policy
-- (platform_admin) can read the overview or change a cap. Every table here has
-- RLS on with no policies and no grants to anon/authenticated; the functions are
-- executable by service_role only, so a tenant cannot read or raise its own cap.
--
-- The cap is an internal cost guard. It does not change what customers are charged.

-- Micro-USD totals can exceed int4 for large caps.
ALTER TABLE bloom_support.usage_counters ALTER COLUMN count TYPE bigint;

INSERT INTO bloom_support.settings(key, value)
VALUES ('chat_spend', '{"default_monthly_cap_usd": 25}')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE bloom_support.chat_spend_caps (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  cap_micros bigint NOT NULL CHECK (cap_micros >= 0),
  note text,
  updated_by uuid REFERENCES bloom_support.principals(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bloom_support.chat_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  month text NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  feature text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled', 'released')),
  reserved_micros bigint NOT NULL CHECK (reserved_micros >= 0),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  cost_micros bigint CHECK (cost_micros IS NULL OR cost_micros >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX chat_usage_tenant_month_idx ON bloom_support.chat_usage (tenant_id, month);

ALTER TABLE bloom_support.chat_spend_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloom_support.chat_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.chat_spend_caps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON bloom_support.chat_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION bloom_support.chat_spend_cap_micros(p_tenant uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT c.cap_micros FROM bloom_support.chat_spend_caps c WHERE c.tenant_id = p_tenant),
    round(coalesce((bloom_support.setting('chat_spend')->>'default_monthly_cap_usd')::numeric, 25) * 1000000)::bigint
  )
$$;
REVOKE ALL ON FUNCTION bloom_support.chat_spend_cap_micros(uuid) FROM PUBLIC, anon, authenticated;

-- Reserve the estimated cost of one model call. The counter row is locked for
-- the whole check-and-add, so parallel calls for one tenant serialize and the
-- committed total never passes the cap at reservation time.
CREATE OR REPLACE FUNCTION public.bloom_chat_spend_reserve(
  p_tenant_id uuid, p_user_id uuid, p_feature text, p_model text, p_estimate_micros bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_month text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  v_bucket text := 'chat-spend:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  v_cap bigint;
  v_committed bigint;
  v_estimate bigint := greatest(coalesce(p_estimate_micros, 0), 0);
  v_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'invalid: tenant_id required' USING ERRCODE = '22023'; END IF;
  INSERT INTO bloom_support.usage_counters(bucket, subject, count) VALUES (v_bucket, p_tenant_id::text, 0)
  ON CONFLICT (bucket, subject) DO NOTHING;
  SELECT count INTO v_committed FROM bloom_support.usage_counters
  WHERE bucket = v_bucket AND subject = p_tenant_id::text FOR UPDATE;
  v_cap := bloom_support.chat_spend_cap_micros(p_tenant_id);
  IF v_committed + v_estimate > v_cap THEN
    RETURN jsonb_build_object('allowed', false, 'month', v_month, 'committed_micros', v_committed, 'cap_micros', v_cap);
  END IF;
  UPDATE bloom_support.usage_counters SET count = count + v_estimate
  WHERE bucket = v_bucket AND subject = p_tenant_id::text;
  INSERT INTO bloom_support.chat_usage(tenant_id, user_id, month, feature, model, reserved_micros)
  VALUES (p_tenant_id, p_user_id, v_month, left(coalesce(p_feature, 'chat'), 60), left(coalesce(p_model, 'unknown'), 120), v_estimate)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('allowed', true, 'reservation_id', v_id, 'month', v_month,
    'committed_micros', v_committed + v_estimate, 'cap_micros', v_cap);
END $$;

-- Replace a reservation with the actual cost. p_input_tokens NULL releases it
-- (the call never ran or the provider refused it, so nothing was billed).
-- Idempotent: only a row still 'reserved' changes anything.
CREATE OR REPLACE FUNCTION public.bloom_chat_spend_settle(
  p_reservation_id uuid, p_input_tokens integer, p_output_tokens integer, p_cost_micros bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r bloom_support.chat_usage; v_cost bigint; v_status text;
BEGIN
  SELECT * INTO r FROM bloom_support.chat_usage WHERE id = p_reservation_id;
  IF NOT FOUND OR r.status <> 'reserved' THEN
    RETURN jsonb_build_object('settled', false);
  END IF;
  -- Lock order matches reserve (counter first) so the two never deadlock.
  PERFORM 1 FROM bloom_support.usage_counters
  WHERE bucket = 'chat-spend:' || r.month AND subject = r.tenant_id::text FOR UPDATE;
  SELECT * INTO r FROM bloom_support.chat_usage WHERE id = p_reservation_id FOR UPDATE;
  IF r.status <> 'reserved' THEN RETURN jsonb_build_object('settled', false); END IF;
  IF p_input_tokens IS NULL THEN
    v_cost := 0; v_status := 'released';
  ELSE
    v_cost := greatest(coalesce(p_cost_micros, 0), 0); v_status := 'settled';
  END IF;
  UPDATE bloom_support.usage_counters SET count = greatest(count + v_cost - r.reserved_micros, 0)
  WHERE bucket = 'chat-spend:' || r.month AND subject = r.tenant_id::text;
  UPDATE bloom_support.chat_usage SET status = v_status, input_tokens = p_input_tokens,
    output_tokens = p_output_tokens, cost_micros = v_cost, settled_at = now()
  WHERE id = p_reservation_id;
  RETURN jsonb_build_object('settled', true, 'status', v_status, 'cost_micros', v_cost);
END $$;

-- Pre-flight read used before a chat turn starts (no reservation).
CREATE OR REPLACE FUNCTION public.bloom_chat_spend_status(p_tenant_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'month', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'),
    'committed_micros', coalesce((SELECT u.count FROM bloom_support.usage_counters u
      WHERE u.bucket = 'chat-spend:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM') AND u.subject = p_tenant_id::text), 0),
    'cap_micros', bloom_support.chat_spend_cap_micros(p_tenant_id))
$$;

-- Platform-admin overview: month-to-date spend vs cap for every tenant with
-- usage this month or an override.
CREATE OR REPLACE FUNCTION public.bloom_chat_spend_overview(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_month text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'); v_rows jsonb;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'admin.policy');
  WITH usage AS (
    SELECT tenant_id, count(*) AS calls,
      coalesce(sum(cost_micros) FILTER (WHERE status = 'settled'), 0) AS settled_micros,
      coalesce(sum(reserved_micros) FILTER (WHERE status = 'reserved'), 0) AS in_flight_micros,
      coalesce(sum(input_tokens), 0) AS input_tokens, coalesce(sum(output_tokens), 0) AS output_tokens
    FROM bloom_support.chat_usage WHERE month = v_month GROUP BY tenant_id
  ), ids AS (
    SELECT tenant_id FROM usage UNION SELECT tenant_id FROM bloom_support.chat_spend_caps
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'tenant_id', i.tenant_id,
      'tenant_name', t.name,
      'calls', coalesce(u.calls, 0),
      'input_tokens', coalesce(u.input_tokens, 0),
      'output_tokens', coalesce(u.output_tokens, 0),
      'settled_micros', coalesce(u.settled_micros, 0),
      'in_flight_micros', coalesce(u.in_flight_micros, 0),
      'committed_micros', coalesce(c.count, 0),
      'cap_micros', bloom_support.chat_spend_cap_micros(i.tenant_id),
      'override', o.tenant_id IS NOT NULL,
      'override_note', o.note
    ) ORDER BY coalesce(c.count, 0) DESC, t.name), '[]'::jsonb)
  INTO v_rows
  FROM ids i
  LEFT JOIN public.tenants t ON t.id = i.tenant_id
  LEFT JOIN usage u ON u.tenant_id = i.tenant_id
  LEFT JOIN bloom_support.chat_spend_caps o ON o.tenant_id = i.tenant_id
  LEFT JOIN bloom_support.usage_counters c ON c.bucket = 'chat-spend:' || v_month AND c.subject = i.tenant_id::text;
  RETURN jsonb_build_object('month', v_month,
    'default_cap_micros', round(coalesce((bloom_support.setting('chat_spend')->>'default_monthly_cap_usd')::numeric, 25) * 1000000)::bigint,
    'tenants', v_rows);
END $$;

-- Platform-admin override. p_cap_usd NULL removes the override (back to default).
CREATE OR REPLACE FUNCTION public.bloom_chat_spend_set_cap(p_actor uuid, p_tenant_id uuid, p_cap_usd numeric, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'admin.policy');
  IF bloom_support.principal_role(p_actor) IS DISTINCT FROM 'platform_admin' THEN
    RAISE EXCEPTION 'forbidden: only a platform admin can change a chat spending cap' USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'not_found: tenant' USING ERRCODE = 'P0002';
  END IF;
  IF p_cap_usd IS NULL THEN
    DELETE FROM bloom_support.chat_spend_caps WHERE tenant_id = p_tenant_id;
  ELSE
    IF p_cap_usd < 0 OR p_cap_usd > 100000 THEN
      RAISE EXCEPTION 'invalid: cap must be between 0 and 100000 USD' USING ERRCODE = '22023';
    END IF;
    INSERT INTO bloom_support.chat_spend_caps(tenant_id, cap_micros, note, updated_by, updated_at)
    VALUES (p_tenant_id, round(p_cap_usd * 1000000)::bigint, left(p_note, 500), p_actor, now())
    ON CONFLICT (tenant_id) DO UPDATE SET cap_micros = EXCLUDED.cap_micros, note = EXCLUDED.note,
      updated_by = EXCLUDED.updated_by, updated_at = now();
  END IF;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'chat_spend_cap.changed',
    jsonb_build_object('tenant_id', p_tenant_id, 'cap_usd', p_cap_usd, 'note', left(p_note, 500)));
  RETURN jsonb_build_object('tenant_id', p_tenant_id, 'cap_micros', bloom_support.chat_spend_cap_micros(p_tenant_id), 'override', p_cap_usd IS NOT NULL);
END $$;

REVOKE ALL ON FUNCTION public.bloom_chat_spend_reserve(uuid, uuid, text, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bloom_chat_spend_settle(uuid, integer, integer, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bloom_chat_spend_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bloom_chat_spend_overview(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bloom_chat_spend_set_cap(uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_chat_spend_reserve(uuid, uuid, text, text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_chat_spend_settle(uuid, integer, integer, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_chat_spend_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_chat_spend_overview(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_chat_spend_set_cap(uuid, uuid, numeric, text) TO service_role;
