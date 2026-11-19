-- Central-login 59 (crm-r2-F111, refines 20261116080100): an older Stripe event is skipped only when it is about the
-- same Stripe subscription as the row's current one; an event for another subscription is never compared by time.
CREATE OR REPLACE FUNCTION public.skip_stale_stripe_subscription_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.stripe_event_created_at IS NOT NULL
     AND OLD.stripe_event_created_at IS NOT NULL
     AND OLD.stripe_subscription_id IS NOT DISTINCT FROM NEW.stripe_subscription_id
     AND NEW.stripe_event_created_at < OLD.stripe_event_created_at THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;
