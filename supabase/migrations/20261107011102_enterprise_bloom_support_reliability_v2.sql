-- The analytical audience worker is the only caller of these primitives. They need
-- to inspect auth.users to reject banned owners, which service_role cannot SELECT
-- directly. Run the complete authorization checks as the function owner instead of
-- granting broad read access to Auth. Execution remains service-role only.
ALTER FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 SECURITY DEFINER;
ALTER FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 SET search_path = '';
ALTER FUNCTION public.claim_bloom_audience_refresh(uuid)
 SECURITY DEFINER;
ALTER FUNCTION public.claim_bloom_audience_refresh(uuid)
 SET search_path = '';
ALTER FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 SECURITY DEFINER;
ALTER FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 SET search_path = '';

REVOKE ALL ON FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_bloom_audience_refresh(uuid)
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_bloom_audience_refresh(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 TO service_role;

COMMENT ON FUNCTION public.claim_bloom_audience_refresh(uuid) IS
 'Service-only worker claim. SECURITY DEFINER is required solely for the banned-owner check in auth.users.';

-- Resend can emit terminal failed/suppressed events after accepting an email.
-- Preserve the strongest outcome when events arrive out of order, mirror the
-- status to every coalesced message, and raise one durable staff notification.
CREATE OR REPLACE FUNCTION bloom_support.record_delivery_event(
  p_provider_id text,
  p_type text,
  p_detail jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  o bloom_support.outbound_emails;
  event_status text := CASE p_type
    WHEN 'email.delivered' THEN 'delivered'
    WHEN 'email.bounced' THEN 'bounced'
    WHEN 'email.complained' THEN 'complained'
    WHEN 'email.suppressed' THEN 'suppressed'
    WHEN 'email.failed' THEN 'failed'
    WHEN 'email.sent' THEN 'sent'
    ELSE NULL
  END;
  next_status text;
  message_delivery text;
  previous_status text;
BEGIN
  SELECT *
    INTO o
    FROM bloom_support.outbound_emails
   WHERE provider_id = p_provider_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  previous_status := o.status;
  -- Complaint/bounce can follow delivery. Delivery must not be undone by a
  -- late failure, and terminal provider failure must not be undone by sent.
  next_status := CASE
    WHEN o.status = 'complained' OR event_status = 'complained' THEN 'complained'
    WHEN o.status = 'bounced' OR event_status = 'bounced' THEN 'bounced'
    WHEN o.status = 'delivered' OR event_status = 'delivered' THEN 'delivered'
    WHEN o.status = 'suppressed' OR event_status = 'suppressed' THEN 'suppressed'
    WHEN o.status = 'failed' OR event_status = 'failed' THEN 'failed'
    WHEN event_status = 'sent'
      AND o.status IN ('queued', 'not_configured', 'uncertain') THEN 'sent'
    ELSE o.status
  END;

  UPDATE bloom_support.outbound_emails
     SET provider_events = provider_events || jsonb_build_array(
           jsonb_build_object('type', p_type, 'at', now())
         ),
         status = next_status
   WHERE id = o.id
   RETURNING * INTO o;

  message_delivery := CASE o.status
    WHEN 'sent' THEN 'sent'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'failed' THEN 'failed'
    WHEN 'suppressed' THEN 'suppressed'
    WHEN 'bounced' THEN 'bounced'
    WHEN 'complained' THEN 'complained'
    ELSE NULL
  END;

  IF message_delivery IS NOT NULL THEN
    UPDATE bloom_support.messages
       SET delivery = message_delivery
     WHERE id = o.message_id
        OR id = ANY(coalesce(o.covered_message_ids, '{}'));
  END IF;

  IF p_type = 'email.delivery_delayed'
     AND o.status NOT IN ('delivered', 'failed', 'suppressed', 'bounced', 'complained') THEN
    PERFORM bloom_support.log(
      o.ticket_id,
      NULL,
      NULL,
      'email.delivery_delayed',
      jsonb_build_object('to', o.to_email, 'purpose', o.purpose, 'provider_id', p_provider_id)
    );
    PERFORM bloom_support.notify_once(
      o.ticket_id,
      'email.delivery_delayed',
      'Email delivery delayed for ' || o.to_email,
      'both',
      'email-delivery-delayed:' || o.id::text
    );
  ELSIF event_status IN ('failed', 'suppressed', 'bounced', 'complained')
        AND o.status IS DISTINCT FROM previous_status
        AND o.ticket_id IS NOT NULL THEN
    PERFORM bloom_support.log(
      o.ticket_id,
      NULL,
      NULL,
      'email.' || o.status,
      jsonb_build_object('to', o.to_email, 'purpose', o.purpose)
    );
    PERFORM bloom_support.notify_once(
      o.ticket_id,
      'email.' || o.status,
      'Email ' || o.status || ' for ' || o.to_email,
      'both',
      'email-' || o.status || ':' || o.id::text
    );
  END IF;

  RETURN jsonb_build_object(
    'matched', true,
    'event', p_type,
    'status', o.status,
    'delivery_delayed', p_type = 'email.delivery_delayed'
  );
END $$;

REVOKE ALL ON FUNCTION bloom_support.record_delivery_event(text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.record_delivery_event(text, text, jsonb)
  TO service_role;
