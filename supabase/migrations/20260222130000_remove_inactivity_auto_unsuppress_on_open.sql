-- Milestone 4: Remove engagement-based suppression
-- Objective: keep last_open_at for segmentation/analytics, but NEVER auto-unsuppress customers on opens.

-- Replace the trigger function to only update last_open_at.
CREATE OR REPLACE FUNCTION public.update_customer_last_open()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'opened' THEN
    UPDATE public.crm_customers
    SET last_open_at = NEW.created_at
    WHERE email = NEW.customer_email
      AND (last_open_at IS NULL OR last_open_at < NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger remains the same, but re-declare defensively.
DROP TRIGGER IF EXISTS trg_update_customer_last_open ON public.email_tracking_events;
CREATE TRIGGER trg_update_customer_last_open
AFTER INSERT ON public.email_tracking_events
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_last_open();

NOTIFY pgrst, 'reload schema';
