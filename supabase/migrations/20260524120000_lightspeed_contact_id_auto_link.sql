-- Lightspeed sync: auto-link contact_id on both lightspeed_customers and lightspeed_sales.
--
-- Background:
--   Multiple code paths insert into these tables (lightspeed-sync-customers,
--   lightspeed-sync-sales, lightspeed-webhook-handler, pos-sync-worker). Several
--   of them have partial linking logic that fails silently when:
--     * crm_customers email casing differs from Lightspeed's payload
--     * sales arrive before their customer (webhook race)
--     * historical rows pre-date the linking code
--
--   The result: Patio Gardens reported $20.98 attributed revenue when the true
--   attributed total was $84,774.44 (490 named-customer sales of 2,774 total;
--   the other 2,284 are anonymous walk-in transactions tied to Lightspeed's
--   default placeholder customer ID, which correctly stay unlinked).
--
--   A one-shot backfill ran in production restoring 843/852 lightspeed_customers
--   rows and their downstream sales. These triggers prevent the gap from
--   reappearing on every subsequent sync, regardless of which code path writes.
--
-- Behaviour:
--   * Tenant-scoped — never links across tenants.
--   * Case-insensitive email match.
--   * No-op when no match is found (anonymous/walk-in sales stay unlinked).
--   * No-op when contact_id is already set (won't overwrite existing links).
--   * Idempotent — re-running sync on existing rows is safe.

CREATE OR REPLACE FUNCTION public.link_lightspeed_customer_contact_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL OR length(btrim(NEW.email)) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT cc.id
    INTO NEW.contact_id
    FROM public.crm_customers cc
   WHERE cc.tenant_id = NEW.tenant_id
     AND LOWER(cc.email) = LOWER(NEW.email)
   LIMIT 1;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_lightspeed_customer_contact_id() IS
  'BEFORE INSERT/UPDATE trigger on lightspeed_customers. Populates contact_id by case-insensitive, tenant-scoped email match against crm_customers when contact_id is NULL.';

DROP TRIGGER IF EXISTS trg_lightspeed_customers_link_contact_id ON public.lightspeed_customers;

CREATE TRIGGER trg_lightspeed_customers_link_contact_id
BEFORE INSERT OR UPDATE OF email, contact_id, tenant_id
ON public.lightspeed_customers
FOR EACH ROW
EXECUTE FUNCTION public.link_lightspeed_customer_contact_id();


CREATE OR REPLACE FUNCTION public.link_lightspeed_sale_contact_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lightspeed_customer_id IS NULL
     OR length(btrim(NEW.lightspeed_customer_id)) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT lc.contact_id
    INTO NEW.contact_id
    FROM public.lightspeed_customers lc
   WHERE lc.tenant_id = NEW.tenant_id
     AND lc.lightspeed_customer_id = NEW.lightspeed_customer_id
   LIMIT 1;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_lightspeed_sale_contact_id() IS
  'BEFORE INSERT/UPDATE trigger on lightspeed_sales. Copies contact_id from the matching lightspeed_customers row (by tenant_id + lightspeed_customer_id) when contact_id is NULL. No-ops for anonymous/walk-in placeholder customer IDs that have no lightspeed_customers row.';

DROP TRIGGER IF EXISTS trg_lightspeed_sales_link_contact_id ON public.lightspeed_sales;

CREATE TRIGGER trg_lightspeed_sales_link_contact_id
BEFORE INSERT OR UPDATE OF lightspeed_customer_id, contact_id, tenant_id
ON public.lightspeed_sales
FOR EACH ROW
EXECUTE FUNCTION public.link_lightspeed_sale_contact_id();


-- Propagate contact_id changes: when a lightspeed_customers row gets its
-- contact_id populated (either by the trigger above or a manual update), push
-- that contact_id down to any of its existing sales whose contact_id is still
-- NULL. Avoids needing to re-run the sync to materialize the link on sales
-- already imported.

CREATE OR REPLACE FUNCTION public.propagate_lightspeed_customer_contact_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.lightspeed_sales ls
     SET contact_id = NEW.contact_id
   WHERE ls.tenant_id = NEW.tenant_id
     AND ls.lightspeed_customer_id = NEW.lightspeed_customer_id
     AND ls.contact_id IS NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.propagate_lightspeed_customer_contact_id() IS
  'AFTER INSERT/UPDATE trigger on lightspeed_customers. When contact_id is set or changes, fills in matching lightspeed_sales rows that are still unlinked. Handles the webhook race where a sale arrives before its customer row.';

DROP TRIGGER IF EXISTS trg_lightspeed_customers_propagate_contact_id ON public.lightspeed_customers;

CREATE TRIGGER trg_lightspeed_customers_propagate_contact_id
AFTER INSERT OR UPDATE OF contact_id
ON public.lightspeed_customers
FOR EACH ROW
EXECUTE FUNCTION public.propagate_lightspeed_customer_contact_id();
