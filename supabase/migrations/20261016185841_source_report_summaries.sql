-- Preserve period summaries as source evidence, never invented receipt lines.
ALTER TABLE public.customer_intelligence_source_events
 DROP CONSTRAINT customer_intelligence_source_events_event_type_check;
ALTER TABLE public.customer_intelligence_source_events
 ADD CONSTRAINT customer_intelligence_source_events_event_type_check
 CHECK (event_type IN ('customer_spending','points','coupon_issued','coupon_redeemed','purchase_summary'));

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

  -- Supervised bulk imports refresh the account once after the batch, rather than
  -- posting one external webhook per imported customer. No permissions change.
  IF TG_TABLE_NAME = 'crm_customers' AND current_setting('app.customer_import.defer_notion', true) = 'true' THEN
    RETURN NEW;
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

