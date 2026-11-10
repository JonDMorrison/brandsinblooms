-- crm_customers.preferred_channel has historically been populated from the
-- customer's channel consent flags (email, sms, both, or none). Several bulk
-- ingestion paths updated consent without updating this denormalized field,
-- leaving channel segments and customer profiles stale. Enforce the invariant
-- once at the database boundary so every writer gets the same result.

CREATE OR REPLACE FUNCTION public.sync_customer_preferred_channel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.preferred_channel := CASE
    WHEN NEW.email_opt_in IS TRUE AND NEW.sms_opt_in IS TRUE THEN 'both'
    WHEN NEW.email_opt_in IS TRUE THEN 'email'
    WHEN NEW.sms_opt_in IS TRUE THEN 'sms'
    ELSE 'none'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_customer_preferred_channel_trigger
  ON public.crm_customers;
CREATE TRIGGER sync_customer_preferred_channel_trigger
BEFORE INSERT OR UPDATE OF email_opt_in, sms_opt_in
ON public.crm_customers
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_preferred_channel();

-- This is a corrective denormalization, not a customer interaction. Preserve
-- the original business updated_at timestamp while the one-time backfill runs.
ALTER TABLE public.crm_customers
  DISABLE TRIGGER update_crm_customers_updated_at;

UPDATE public.crm_customers AS customer
SET preferred_channel = CASE
      WHEN customer.email_opt_in IS TRUE AND customer.sms_opt_in IS TRUE THEN 'both'
      WHEN customer.email_opt_in IS TRUE THEN 'email'
      WHEN customer.sms_opt_in IS TRUE THEN 'sms'
      ELSE 'none'
    END,
    updated_at = customer.updated_at
WHERE customer.preferred_channel IS DISTINCT FROM CASE
  WHEN customer.email_opt_in IS TRUE AND customer.sms_opt_in IS TRUE THEN 'both'
  WHEN customer.email_opt_in IS TRUE THEN 'email'
  WHEN customer.sms_opt_in IS TRUE THEN 'sms'
  ELSE 'none'
END;

ALTER TABLE public.crm_customers
  ENABLE TRIGGER update_crm_customers_updated_at;

REVOKE ALL ON FUNCTION public.sync_customer_preferred_channel() FROM PUBLIC;

COMMENT ON FUNCTION public.sync_customer_preferred_channel() IS
  'Keeps the CRM customer channel classification consistent with current email and SMS consent.';
