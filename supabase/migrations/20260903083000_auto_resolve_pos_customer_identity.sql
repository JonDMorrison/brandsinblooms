-- Make the canonical identity resolver part of the shared POS ingestion
-- boundary. Every adapter that writes pos_customers now receives the same
-- external-id/email/mobile matching behavior automatically.

CREATE TABLE IF NOT EXISTS public.crm_customer_identity_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  pos_connection_id uuid REFERENCES public.pos_connections(id) ON DELETE CASCADE,
  pos_customer_id uuid REFERENCES public.pos_customers(id) ON DELETE CASCADE,
  provider text,
  external_id text,
  error_message text NOT NULL,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_customer_identity_failures_open_idx
  ON public.crm_customer_identity_failures (tenant_id, created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.crm_customer_identity_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_customer_identity_failures_select_tenant
  ON public.crm_customer_identity_failures;
CREATE POLICY crm_customer_identity_failures_select_tenant
  ON public.crm_customer_identity_failures
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = crm_customer_identity_failures.tenant_id
  ));

REVOKE ALL ON public.crm_customer_identity_failures FROM anon, authenticated;
GRANT SELECT ON public.crm_customer_identity_failures TO authenticated;
GRANT ALL ON public.crm_customer_identity_failures TO service_role;

CREATE OR REPLACE FUNCTION public.auto_resolve_pos_customer_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_connection public.pos_connections%ROWTYPE;
  v_first_name text;
  v_last_name text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.external_id IS NOT DISTINCT FROM NEW.external_id
     AND OLD.email IS NOT DISTINCT FROM NEW.email
     AND OLD.phone IS NOT DISTINCT FROM NEW.phone
     AND OLD.name IS NOT DISTINCT FROM NEW.name
     AND OLD.pos_connection_id IS NOT DISTINCT FROM NEW.pos_connection_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_connection
  FROM public.pos_connections
  WHERE id = NEW.pos_connection_id;

  IF v_connection.id IS NULL OR v_connection.tenant_id IS NULL THEN
    INSERT INTO public.crm_customer_identity_failures (
      tenant_id, pos_connection_id, pos_customer_id, provider,
      external_id, error_message, source_payload
    ) VALUES (
      v_connection.tenant_id,
      NEW.pos_connection_id,
      NEW.id,
      coalesce(v_connection.platform, NEW.pos_source),
      NEW.external_id,
      'POS connection is missing a tenant',
      jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone)
    );
    RETURN NEW;
  END IF;

  v_first_name := nullif(split_part(btrim(coalesce(NEW.name, '')), ' ', 1), '');
  v_last_name := nullif(btrim(regexp_replace(
    btrim(coalesce(NEW.name, '')),
    '^\S+\s*',
    ''
  )), '');

  BEGIN
    PERFORM public.resolve_crm_customer_identity(
      v_connection.tenant_id,
      coalesce(nullif(lower(btrim(v_connection.platform)), ''), 'pos'),
      NEW.external_id,
      NEW.pos_connection_id,
      NEW.id,
      NEW.email,
      NEW.phone,
      v_connection.user_id,
      jsonb_build_object(
        'first_name', v_first_name,
        'last_name', v_last_name,
        'custom_fields', jsonb_build_object(
          'pos_tags', coalesce(to_jsonb(NEW.tags), '[]'::jsonb)
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.crm_customer_identity_failures (
      tenant_id, pos_connection_id, pos_customer_id, provider,
      external_id, error_message, source_payload
    ) VALUES (
      v_connection.tenant_id,
      NEW.pos_connection_id,
      NEW.id,
      coalesce(v_connection.platform, NEW.pos_source),
      NEW.external_id,
      SQLERRM,
      jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone)
    );
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_resolve_pos_customer_identity()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_resolve_pos_customer_identity()
  TO service_role;

DROP TRIGGER IF EXISTS trg_auto_resolve_pos_customer_identity
  ON public.pos_customers;
CREATE TRIGGER trg_auto_resolve_pos_customer_identity
AFTER INSERT OR UPDATE OF external_id, email, phone, name, pos_connection_id
ON public.pos_customers
FOR EACH ROW
EXECUTE FUNCTION public.auto_resolve_pos_customer_identity();

-- Backfill rows written before the trigger existed. A bad historical record
-- is audited and skipped rather than aborting the migration or POS ingestion.
DO $$
DECLARE
  v_pos_customer public.pos_customers%ROWTYPE;
  v_connection public.pos_connections%ROWTYPE;
BEGIN
  FOR v_pos_customer IN
    SELECT pc.*
    FROM public.pos_customers pc
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.crm_customer_identity_links link
      JOIN public.pos_connections conn ON conn.id = pc.pos_connection_id
      WHERE link.tenant_id = conn.tenant_id
        AND link.pos_customer_id = pc.id
    )
    ORDER BY pc.created_at, pc.id
  LOOP
    SELECT * INTO v_connection
    FROM public.pos_connections
    WHERE id = v_pos_customer.pos_connection_id;

    BEGIN
      PERFORM public.resolve_crm_customer_identity(
        v_connection.tenant_id,
        coalesce(nullif(lower(btrim(v_connection.platform)), ''), 'pos'),
        v_pos_customer.external_id,
        v_pos_customer.pos_connection_id,
        v_pos_customer.id,
        v_pos_customer.email,
        v_pos_customer.phone,
        v_connection.user_id,
        jsonb_build_object('custom_fields', jsonb_build_object(
          'pos_tags', coalesce(to_jsonb(v_pos_customer.tags), '[]'::jsonb)
        ))
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.crm_customer_identity_failures (
        tenant_id, pos_connection_id, pos_customer_id, provider,
        external_id, error_message, source_payload
      ) VALUES (
        v_connection.tenant_id,
        v_pos_customer.pos_connection_id,
        v_pos_customer.id,
        coalesce(v_connection.platform, v_pos_customer.pos_source),
        v_pos_customer.external_id,
        SQLERRM,
        jsonb_build_object(
          'backfill', true,
          'name', v_pos_customer.name,
          'email', v_pos_customer.email,
          'phone', v_pos_customer.phone
        )
      );
    END;
  END LOOP;
END;
$$;
