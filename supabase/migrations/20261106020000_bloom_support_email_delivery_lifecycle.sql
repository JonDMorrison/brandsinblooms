-- Keep every message represented by a coalesced support email in the same
-- provider-confirmed delivery state. Delayed delivery stays non-terminal but
-- becomes a deduplicated staff notification instead of disappearing silently.

ALTER TABLE bloom_support.messages
  DROP CONSTRAINT IF EXISTS messages_delivery_check;
ALTER TABLE bloom_support.messages
  ADD CONSTRAINT messages_delivery_check
  CHECK (delivery IN (
    'none', 'queued', 'sent', 'failed', 'suppressed',
    'delivered', 'bounced', 'complained', 'uncertain'
  ));

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

  -- Provider events can arrive out of order. A late "sent" must not undo a
  -- delivery receipt, while a bounce or complaint remains authoritative.
  next_status := CASE
    WHEN o.status = 'complained' THEN 'complained'
    WHEN event_status = 'complained' THEN 'complained'
    WHEN o.status = 'bounced' THEN 'bounced'
    WHEN event_status = 'bounced' THEN 'bounced'
    WHEN o.status = 'delivered' THEN 'delivered'
    WHEN event_status = 'delivered' THEN 'delivered'
    WHEN event_status = 'sent' AND o.status IN ('queued', 'failed', 'not_configured', 'uncertain') THEN 'sent'
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
     AND o.status NOT IN ('delivered', 'bounced', 'complained') THEN
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
  ELSIF event_status IN ('bounced', 'complained')
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
