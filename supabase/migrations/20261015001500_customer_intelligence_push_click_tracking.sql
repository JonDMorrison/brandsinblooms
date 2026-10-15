-- Anonymous notification clicks are recorded only when accompanied by a
-- separate unguessable per-message token, not a customer email or an
-- exposed CRM record identifier. The token never appears in a page URL.
BEGIN;

ALTER TABLE public.crm_push_messages
  ADD COLUMN click_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX crm_push_messages_click_token_unique
  ON public.crm_push_messages(click_token);

CREATE UNIQUE INDEX crm_push_events_single_click
  ON public.crm_push_events(message_id)
  WHERE event_type='clicked';

COMMIT;
