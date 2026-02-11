-- Global provider pacing for Edge workers.
-- Used to enforce minimum spacing between outbound provider requests across concurrent invocations.

CREATE TABLE IF NOT EXISTS public.provider_rate_limits (
  provider TEXT PRIMARY KEY,
  next_allowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  v_now TIMESTAMPTZ := now();
  v_next TIMESTAMPTZ;
  v_wait_ms INT;
BEGIN
  IF p_provider IS NULL OR length(trim(p_provider)) = 0 THEN
    RETURN 0;
  END IF;

  IF p_min_interval_ms IS NULL OR p_min_interval_ms < 0 THEN
    p_min_interval_ms := 0;
  END IF;

  INSERT INTO public.provider_rate_limits(provider)
  VALUES (trim(p_provider))
  ON CONFLICT (provider) DO NOTHING;

  SELECT next_allowed_at
  INTO v_next
  FROM public.provider_rate_limits
  WHERE provider = trim(p_provider)
  FOR UPDATE;

  v_next := COALESCE(v_next, v_now);

  v_wait_ms := GREATEST(
    0,
    floor(extract(epoch from (v_next - v_now)) * 1000)::int
  );

  UPDATE public.provider_rate_limits
  SET
    next_allowed_at = GREATEST(v_next, v_now) + make_interval(secs => (p_min_interval_ms::double precision / 1000.0)),
    updated_at = v_now
  WHERE provider = trim(p_provider);

  RETURN v_wait_ms;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_provider_send_slot(TEXT, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
