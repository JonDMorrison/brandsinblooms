-- Reliable, recipient-specific SMS link tracking.
-- Link mappings and click mutation remain service-only; recipients reach them
-- exclusively through the public redirect Edge Function.

ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS links_clicked bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_links_clicked integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_clicked_at timestamptz;

ALTER TABLE public.sms_messages
  DROP CONSTRAINT IF EXISTS sms_messages_links_clicked_check;
ALTER TABLE public.sms_messages
  ADD CONSTRAINT sms_messages_links_clicked_check CHECK (links_clicked >= 0);

ALTER TABLE public.sms_messages
  DROP CONSTRAINT IF EXISTS sms_messages_unique_links_clicked_check;
ALTER TABLE public.sms_messages
  ADD CONSTRAINT sms_messages_unique_links_clicked_check CHECK (unique_links_clicked >= 0);

CREATE TABLE IF NOT EXISTS public.sms_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.crm_sms_campaigns(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.sms_messages(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  link_index integer NOT NULL CHECK (link_index >= 0 AND link_index < 20),
  original_url text NOT NULL CHECK (
    char_length(original_url) <= 4096
    AND original_url ~* '^https?://'
  ),
  tracking_code text NOT NULL CHECK (tracking_code ~ '^[a-f0-9]{32}$'),
  click_count bigint NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  last_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracking_code),
  UNIQUE (message_id, link_index)
);

CREATE INDEX IF NOT EXISTS idx_sms_link_clicks_campaign
  ON public.sms_link_clicks (campaign_id, first_clicked_at)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_link_clicks_customer
  ON public.sms_link_clicks (customer_id, first_clicked_at)
  WHERE customer_id IS NOT NULL;

ALTER TABLE public.sms_link_clicks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sms_link_clicks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sms_link_clicks TO service_role;

CREATE OR REPLACE FUNCTION public.register_sms_tracking_links(
  p_message_id uuid,
  p_links jsonb
)
RETURNS TABLE (
  link_index integer,
  original_url text,
  tracking_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_message public.sms_messages%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_links) <> 'array' OR jsonb_array_length(p_links) > 20 THEN
    RAISE EXCEPTION 'SMS tracking links must be an array with at most 20 entries';
  END IF;

  SELECT * INTO v_message
  FROM public.sms_messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF NOT FOUND OR v_message.tenant_id IS NULL THEN
    RAISE EXCEPTION 'SMS message is missing or has no tenant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_links) AS item
    WHERE coalesce(item->>'link_index', '') !~ '^[0-9]+$'
       OR (item->>'link_index')::integer < 0
       OR (item->>'link_index')::integer >= 20
       OR coalesce(item->>'tracking_code', '') !~ '^[a-f0-9]{32}$'
       OR char_length(coalesce(item->>'original_url', '')) > 4096
       OR coalesce(item->>'original_url', '') !~* '^https?://'
  ) THEN
    RAISE EXCEPTION 'Invalid SMS tracking link registration';
  END IF;

  INSERT INTO public.sms_link_clicks (
    tenant_id,
    campaign_id,
    message_id,
    customer_id,
    link_index,
    original_url,
    tracking_code
  )
  SELECT
    v_message.tenant_id,
    v_message.campaign_id,
    v_message.id,
    v_message.customer_id,
    (item->>'link_index')::integer,
    item->>'original_url',
    item->>'tracking_code'
  FROM jsonb_array_elements(p_links) AS item
  ON CONFLICT ON CONSTRAINT sms_link_clicks_message_id_link_index_key DO NOTHING;

  RETURN QUERY
  SELECT link.link_index, link.original_url, link.tracking_code
  FROM public.sms_link_clicks AS link
  WHERE link.message_id = p_message_id
  ORDER BY link.link_index;
END;
$$;

REVOKE ALL ON FUNCTION public.register_sms_tracking_links(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_sms_tracking_links(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.record_sms_link_click(
  p_tracking_code text,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE (
  original_url text,
  campaign_id uuid,
  message_id uuid,
  customer_id uuid,
  first_message_click boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link public.sms_link_clicks%ROWTYPE;
  v_first_message_click boolean;
  v_now timestamptz := statement_timestamp();
  v_metrics jsonb;
BEGIN
  UPDATE public.sms_link_clicks AS link
  SET click_count = link.click_count + 1,
      first_clicked_at = coalesce(link.first_clicked_at, v_now),
      last_clicked_at = v_now,
      last_user_agent = left(p_user_agent, 512)
  WHERE link.tracking_code = p_tracking_code
  RETURNING link.* INTO v_link;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT message.first_clicked_at IS NULL
  INTO v_first_message_click
  FROM public.sms_messages AS message
  WHERE message.id = v_link.message_id
  FOR UPDATE;

  UPDATE public.sms_messages AS message
  SET links_clicked = message.links_clicked + 1,
      unique_links_clicked = message.unique_links_clicked +
        CASE WHEN v_link.click_count = 1 THEN 1 ELSE 0 END,
      first_clicked_at = coalesce(message.first_clicked_at, v_now),
      last_clicked_at = v_now,
      updated_at = v_now
  WHERE message.id = v_link.message_id;

  IF v_link.campaign_id IS NOT NULL THEN
    SELECT coalesce(campaign.metrics, '{}'::jsonb)
    INTO v_metrics
    FROM public.crm_sms_campaigns AS campaign
    WHERE campaign.id = v_link.campaign_id
    FOR UPDATE;

    UPDATE public.crm_sms_campaigns AS campaign
    SET metrics = v_metrics || jsonb_build_object(
          'clicked',
          CASE WHEN coalesce(v_metrics->>'clicked', '') ~ '^[0-9]+$'
            THEN (v_metrics->>'clicked')::bigint ELSE 0 END +
            CASE WHEN v_first_message_click THEN 1 ELSE 0 END,
          'unique_clicked',
          CASE WHEN coalesce(v_metrics->>'unique_clicked', '') ~ '^[0-9]+$'
            THEN (v_metrics->>'unique_clicked')::bigint ELSE 0 END +
            CASE WHEN v_first_message_click THEN 1 ELSE 0 END,
          'total_clicks',
          CASE WHEN coalesce(v_metrics->>'total_clicks', '') ~ '^[0-9]+$'
            THEN (v_metrics->>'total_clicks')::bigint ELSE 0 END + 1
        ),
        updated_at = v_now
    WHERE campaign.id = v_link.campaign_id;
  END IF;

  RETURN QUERY SELECT
    v_link.original_url,
    v_link.campaign_id,
    v_link.message_id,
    v_link.customer_id,
    v_first_message_click;
END;
$$;

REVOKE ALL ON FUNCTION public.record_sms_link_click(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sms_link_click(text, text) TO service_role;

COMMENT ON TABLE public.sms_link_clicks IS
  'Service-only recipient link ledger for idempotent SMS click tracking.';
COMMENT ON FUNCTION public.record_sms_link_click(text, text) IS
  'Atomically records a tracked SMS link click and updates message/campaign metrics.';
