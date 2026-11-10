-- Replace dashboard-created database webhooks whose trigger metadata embeds a
-- legacy service-role JWT. The destination behavior is preserved, but the
-- credential is resolved from Vault only while the trigger is executing.

CREATE OR REPLACE FUNCTION public.invoke_internal_notion_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_function_slug text := TG_ARGV[0];
  v_service_key text;
BEGIN
  IF v_function_slug NOT IN ('update-notion-profile', 'notify-notion-trial') THEN
    RAISE EXCEPTION 'Unsupported internal Notion function: %', v_function_slug;
  END IF;

  v_service_key := public.get_service_role_key();
  IF v_service_key IS NULL OR length(v_service_key) < 20 THEN
    RAISE WARNING 'Internal Notion sync skipped because the Vault service key is unavailable';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/' || v_function_slug,
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

DROP TRIGGER IF EXISTS "notion-clients-imported" ON public.crm_customers;
CREATE TRIGGER "notion-clients-imported"
AFTER INSERT ON public.crm_customers
FOR EACH ROW
EXECUTE FUNCTION public.invoke_internal_notion_sync('update-notion-profile');

DROP TRIGGER IF EXISTS "notion-profile-update" ON public.company_profiles;
CREATE TRIGGER "notion-profile-update"
AFTER INSERT OR UPDATE ON public.company_profiles
FOR EACH ROW
EXECUTE FUNCTION public.invoke_internal_notion_sync('update-notion-profile');

DROP TRIGGER IF EXISTS "notion-email-domain" ON public.email_domains;
CREATE TRIGGER "notion-email-domain"
AFTER INSERT OR UPDATE ON public.email_domains
FOR EACH ROW
EXECUTE FUNCTION public.invoke_internal_notion_sync('update-notion-profile');

DROP TRIGGER IF EXISTS "notion-pos-clover" ON public.clover_connections;
CREATE TRIGGER "notion-pos-clover"
AFTER INSERT ON public.clover_connections
FOR EACH ROW
EXECUTE FUNCTION public.invoke_internal_notion_sync('update-notion-profile');

DROP TRIGGER IF EXISTS "notion-pos-square" ON public.square_connections;
CREATE TRIGGER "notion-pos-square"
AFTER INSERT ON public.square_connections
FOR EACH ROW
EXECUTE FUNCTION public.invoke_internal_notion_sync('update-notion-profile');

DROP TRIGGER IF EXISTS "notion-pos-lightspeed" ON public.lightspeed_connections;
CREATE TRIGGER "notion-pos-lightspeed"
AFTER INSERT ON public.lightspeed_connections
FOR EACH ROW
EXECUTE FUNCTION public.invoke_internal_notion_sync('notify-notion-trial');

DROP TRIGGER IF EXISTS "notify-notion-trial" ON public.users;
CREATE TRIGGER "notify-notion-trial"
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.invoke_internal_notion_sync('notify-notion-trial');

COMMENT ON FUNCTION public.invoke_internal_notion_sync() IS
  'Allowlisted internal database webhook that resolves its service key from Vault at execution time.';
