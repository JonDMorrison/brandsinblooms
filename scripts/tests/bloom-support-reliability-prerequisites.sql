-- The production reliability migration also hardens three analytical-audience
-- worker functions. Bloom Support disposable databases intentionally do not
-- install the customer-intelligence schema, so provide only the exact function
-- signatures required to exercise the real migration in isolation.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION public.save_bloom_analytical_audience(
  uuid, uuid, text, text, uuid[]
) RETURNS jsonb
LANGUAGE sql
AS $$ SELECT '{}'::jsonb $$;

CREATE FUNCTION public.claim_bloom_audience_refresh(uuid)
RETURNS SETOF integer
LANGUAGE sql
AS $$ SELECT 1 WHERE false $$;

CREATE FUNCTION public.finish_bloom_audience_refresh(
  uuid, uuid, integer, jsonb, text
) RETURNS boolean
LANGUAGE sql
AS $$ SELECT true $$;
