-- Stop internal Notion sync from posting to production from any other project.
--
-- invoke_internal_notion_sync() hard-coded the production function URL. Any
-- other project running these migrations (staging, eval, a branch) with a
-- service key in its Vault would post full crm_customers, users,
-- company_profiles, email_domains and POS-connection rows to PRODUCTION's
-- update-notion-profile / notify-notion-trial functions.
--
-- The destination now comes from this project's own Vault secret
-- `internal_functions_base_url` (e.g. https://<project-ref>.supabase.co).
-- Vault values do not decrypt in another project, and the migration never
-- writes the value, so an unconfigured project skips the sync (fail closed)
-- instead of reaching another project. Production must have the secret before
-- this migration is applied, or its Notion sync pauses until it is added:
--
--   SELECT vault.create_secret(
--     'https://udldmkqwnxhdeztyqcau.supabase.co',
--     'internal_functions_base_url',
--     'Base URL of THIS project''s edge functions, for internal database webhooks');
--
-- Everything else about the sync is unchanged: the allowlisted functions, the
-- bulk-import deferral, the Vault-resolved service key and the payload.

CREATE OR REPLACE FUNCTION public.internal_functions_base_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- Only a hosted Supabase project origin is accepted; anything else is null.
  SELECT CASE
    WHEN s.decrypted_secret ~ '^https://[a-z0-9]{20}\.supabase\.co$' THEN s.decrypted_secret
    ELSE NULL
  END
  FROM vault.decrypted_secrets s
  WHERE s.name = 'internal_functions_base_url'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.internal_functions_base_url()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_functions_base_url()
  TO service_role;

COMMENT ON FUNCTION public.internal_functions_base_url() IS
  'This project''s own edge-function origin from Vault secret internal_functions_base_url; null when unset or malformed so internal webhooks fail closed.';

CREATE OR REPLACE FUNCTION public.invoke_internal_notion_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_function_slug text := TG_ARGV[0];
  v_service_key text;
  v_base_url text;
BEGIN
  IF v_function_slug NOT IN ('update-notion-profile', 'notify-notion-trial') THEN
    RAISE EXCEPTION 'Unsupported internal Notion function: %', v_function_slug;
  END IF;

  -- Supervised bulk imports refresh the account once after the batch, rather than
  -- posting one external webhook per imported customer. No permissions change.
  IF TG_TABLE_NAME = 'crm_customers' AND current_setting('app.customer_import.defer_notion', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Post only to this project's own functions. Never fall back to another
  -- project's URL: an unconfigured project skips the sync.
  v_base_url := public.internal_functions_base_url();
  IF v_base_url IS NULL THEN
    RAISE WARNING 'Internal Notion sync skipped because Vault secret internal_functions_base_url is not set for this project';
    RETURN NEW;
  END IF;

  v_service_key := public.get_service_role_key();
  IF v_service_key IS NULL OR length(v_service_key) < 20 THEN
    RAISE WARNING 'Internal Notion sync skipped because the Vault service key is unavailable';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_base_url || '/functions/v1/' || v_function_slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_service_key
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', CASE
        WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)
        ELSE NULL
      END
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_internal_notion_sync()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_internal_notion_sync()
  TO service_role;

COMMENT ON FUNCTION public.invoke_internal_notion_sync() IS
  'Allowlisted internal database webhook. Posts only to this project''s own functions (internal_functions_base_url in Vault) with the Vault-resolved service key; skips when either is missing.';
