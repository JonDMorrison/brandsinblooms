-- Attribute signed inbound STOP replies to the originating SMS campaign.
-- The trigger runs before apply_mta_inbound_sms changes consent, so the
-- campaign counter represents unique recipients who actually transitioned
-- from opted in to opted out.

CREATE OR REPLACE FUNCTION public.attribute_sms_opt_out_to_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign_id uuid;
  v_was_opted_in boolean := false;
  v_metrics jsonb;
BEGIN
  IF NEW.keyword <> 'stop'
     OR NEW.customer_id IS NULL
     OR NEW.external_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT message.campaign_id
  INTO v_campaign_id
  FROM public.sms_messages AS message
  WHERE message.id::text = NEW.external_id
    AND message.customer_id = NEW.customer_id
    AND message.provider = 'mobile_text_alerts'
    AND message.campaign_id IS NOT NULL
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize consent transitions for a customer so simultaneous duplicate
  -- STOP replies cannot inflate the unique opt-out count.
  SELECT
    coalesce(customer.sms_opt_in, false)
    OR coalesce(customer.sms_consent, false)
    OR EXISTS (
      SELECT 1
      FROM public.customer_consents AS consent
      WHERE consent.customer_id = customer.id
        AND consent.channel = 'sms'
        AND consent.status = 'opted_in'
    )
  INTO v_was_opted_in
  FROM public.crm_customers AS customer
  WHERE customer.id = NEW.customer_id
  FOR UPDATE;

  IF NOT coalesce(v_was_opted_in, false) THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(campaign.metrics, '{}'::jsonb)
  INTO v_metrics
  FROM public.crm_sms_campaigns AS campaign
  WHERE campaign.id = v_campaign_id
  FOR UPDATE;

  UPDATE public.crm_sms_campaigns AS campaign
  SET metrics = v_metrics || jsonb_build_object(
        'opt_outs',
        CASE
          WHEN coalesce(v_metrics->>'opt_outs', '') ~ '^[0-9]+$'
            THEN (v_metrics->>'opt_outs')::bigint
          ELSE 0
        END + 1
      ),
      updated_at = statement_timestamp()
  WHERE campaign.id = v_campaign_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.attribute_sms_opt_out_to_campaign()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attribute_sms_opt_out_to_campaign()
  TO service_role;

DROP TRIGGER IF EXISTS attribute_sms_opt_out_to_campaign
  ON public.sms_inbound_messages;
CREATE TRIGGER attribute_sms_opt_out_to_campaign
AFTER INSERT ON public.sms_inbound_messages
FOR EACH ROW
EXECUTE FUNCTION public.attribute_sms_opt_out_to_campaign();

COMMENT ON FUNCTION public.attribute_sms_opt_out_to_campaign()
  IS 'Counts a uniquely attributed SMS opt-out on the originating campaign before consent changes.';
