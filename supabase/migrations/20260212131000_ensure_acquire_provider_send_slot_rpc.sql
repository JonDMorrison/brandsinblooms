-- Ensure global provider pacing RPC exists and is discoverable by PostgREST schema cache.
--
-- Some environments can show PGRST202 "Could not find the function" due to migration drift
-- or schema-cache lookup quirks. This migration:
-- 1) Ensures the backing table exists
-- 2) Creates/updates the primary RPC signature (p_provider TEXT, p_min_interval_ms INT)
-- 3) Adds a compatibility overload with reversed param order

CREATE TABLE IF NOT EXISTS public.provider_rate_limits (
  provider TEXT PRIMARY KEY,
  next_allowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_provider_rate_limits_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_provider_rate_limits_updated_at
      BEFORE UPDATE ON public.provider_rate_limits
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.acquire_provider_send_slot(
  p_provider TEXT,
  p_min_interval_ms INT DEFAULT 500
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
  v_wait_ms INT;
BEGIN
  IF p_provider IS NULL OR length(trim(p_provider)) = 0 THEN
    RETURN 0;
  END IF;

  v_now := now();

  -- Initialize row if missing
  INSERT INTO public.provider_rate_limits(provider, next_allowed_at, updated_at)
  VALUES (p_provider, v_now, v_now)
  ON CONFLICT (provider) DO NOTHING;

  -- Lock the row and compute the next slot
  SELECT next_allowed_at INTO v_next
  FROM public.provider_rate_limits
  WHERE provider = p_provider
  FOR UPDATE;

  v_wait_ms := GREATEST(0, (EXTRACT(EPOCH FROM (v_next - v_now)) * 1000)::INT);

  UPDATE public.provider_rate_limits
  SET
    next_allowed_at = GREATEST(v_next, v_now) + make_interval(secs => (p_min_interval_ms::NUMERIC / 1000.0)),
    updated_at = v_now
  WHERE provider = p_provider;

  RETURN v_wait_ms;
END;
$$;

-- Compatibility overload: reversed param order.
CREATE OR REPLACE FUNCTION public.acquire_provider_send_slot(
  p_min_interval_ms INT,
  p_provider TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.acquire_provider_send_slot(p_provider, p_min_interval_ms);
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_provider_send_slot(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_provider_send_slot(INT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
