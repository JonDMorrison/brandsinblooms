-- A real third marketing channel in Customer Intelligence, deliberately
-- separate from email sender-domain transport settings.
-- All audience resolution is authoritative, tenant-scoped, consent-checked,
-- capped and idempotent; the queue worker re-checks consent at send time.
BEGIN;

CREATE TABLE public.crm_push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  segment_id uuid NOT NULL REFERENCES public.crm_segments(id),
  created_by uuid NOT NULL,
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 8 AND 100),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 120),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 240),
  open_path text NOT NULL CHECK (
    length(open_path) BETWEEN 1 AND 1024 AND
    left(open_path,1)='/' AND left(open_path,2)<>'//' AND
    position(chr(92) in open_path)=0
  ),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','paused','cancelled')),
  queued_count integer NOT NULL DEFAULT 0 CHECK (queued_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_key)
);

ALTER TABLE public.crm_push_messages
  ADD COLUMN push_campaign_id uuid REFERENCES public.crm_push_campaigns(id);

CREATE INDEX crm_push_messages_push_campaign_idx
  ON public.crm_push_messages(push_campaign_id,status);

ALTER TABLE public.crm_push_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_push_campaigns FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.crm_push_campaigns TO service_role;

-- This view is not exposed to browser roles. The same SQL predicate is
-- reused by preview and queue through a restricted set-returning function.
CREATE FUNCTION public.eligible_crm_push_segment_v1(
  p_tenant_id uuid,
  p_segment_id uuid
)
RETURNS TABLE (crm_customer_id uuid, subscription_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $$
  SELECT c.id, s.id
  FROM public.crm_segments segment
  JOIN public.customer_segments cs ON cs.segment_id=segment.id
  JOIN public.crm_customers c
    ON c.id=cs.customer_id AND c.tenant_id=segment.tenant_id
  JOIN public.crm_push_preferences pref
    ON pref.tenant_id=c.tenant_id AND pref.crm_customer_id=c.id
    AND pref.status='opted_in'
  JOIN public.crm_push_subscriptions s
    ON s.tenant_id=c.tenant_id AND s.crm_customer_id=c.id
    AND s.status='active' AND s.vapid_key_version=1
  JOIN public.crm_storefront_customer_links link
    ON link.id=s.customer_link_id AND link.tenant_id=c.tenant_id
    AND link.crm_customer_id=c.id AND link.storefront_site_id=s.storefront_site_id
    AND link.status='verified'
  JOIN public.crm_storefront_tenant_links t
    ON t.crm_tenant_id=c.tenant_id
    AND t.storefront_site_id=s.storefront_site_id AND t.enabled=true
  WHERE segment.id=p_segment_id AND segment.tenant_id=p_tenant_id
    AND segment.status='active' AND segment.deleted_at IS NULL
    AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL
$$;

REVOKE ALL ON FUNCTION public.eligible_crm_push_segment_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eligible_crm_push_segment_v1(uuid,uuid)
  TO service_role;

CREATE FUNCTION public.preview_crm_push_segment_v1(
  p_tenant_id uuid,p_segment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_count int := 0;
  v_devices int := 0;
  v_total int := 0;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Service authorization required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_segments
    WHERE id=p_segment_id AND tenant_id=p_tenant_id
      AND status='active' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Active tenant segment not found';
  END IF;
  SELECT count(*) INTO v_total FROM public.customer_segments cs
    JOIN public.crm_customers c ON c.id=cs.customer_id
    WHERE cs.segment_id=p_segment_id AND c.tenant_id=p_tenant_id
      AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL;
  SELECT count(DISTINCT x.crm_customer_id), count(*) INTO v_count,v_devices
  FROM public.eligible_crm_push_segment_v1(p_tenant_id,p_segment_id) x;
  RETURN jsonb_build_object(
    'segmentMembers',v_total,
    'eligibleCustomers',v_count,
    'eligibleDevices',v_devices,
    'excludedCustomers',greatest(v_total-v_count,0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_crm_push_segment_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preview_crm_push_segment_v1(uuid,uuid)
  TO service_role;

CREATE FUNCTION public.queue_crm_push_segment_v1(
  p_tenant_id uuid,
  p_segment_id uuid,
  p_created_by uuid,
  p_request_key text,
  p_title text,
  p_body text,
  p_open_path text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_campaign public.crm_push_campaigns%ROWTYPE;
  v_preview jsonb;
  v_queued integer;
  v_inserted integer;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Service authorization required';
  END IF;
  IF p_tenant_id IS NULL OR p_segment_id IS NULL OR p_created_by IS NULL
     OR coalesce(length(p_request_key),0) NOT BETWEEN 8 AND 100
     OR p_request_key !~ '^[a-zA-Z0-9:_-]+$'
     OR coalesce(length(btrim(p_title)),0) NOT BETWEEN 3 AND 120
     OR coalesce(length(p_body),0) > 240
     OR coalesce(length(p_open_path),0) NOT BETWEEN 1 AND 1024
     OR left(p_open_path,1)<>'/' OR left(p_open_path,2)='//'
     OR position(chr(92) in p_open_path)>0
     OR p_open_path ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid push campaign';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id=p_created_by
      AND u.tenant_id=p_tenant_id AND u.role='admin'
  ) THEN
    RAISE EXCEPTION 'Tenant administrator required';
  END IF;

  -- Concurrency control is per tenant and request key.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text||':push-campaign:'||p_request_key,0
  ));
  SELECT * INTO v_campaign FROM public.crm_push_campaigns
  WHERE tenant_id=p_tenant_id AND request_key=p_request_key;
  IF FOUND THEN
    IF v_campaign.segment_id IS DISTINCT FROM p_segment_id OR
       v_campaign.created_by IS DISTINCT FROM p_created_by OR
       v_campaign.title IS DISTINCT FROM btrim(p_title) OR
       v_campaign.body IS DISTINCT FROM coalesce(p_body,'') OR
       v_campaign.open_path IS DISTINCT FROM p_open_path THEN
      RAISE EXCEPTION 'Changed push campaign retry';
    END IF;
    RETURN jsonb_build_object('status',v_campaign.status,
      'campaignId',v_campaign.id,'queued',v_campaign.queued_count,
      'idempotent',true);
  END IF;
  v_preview:=public.preview_crm_push_segment_v1(p_tenant_id,p_segment_id);
  v_queued:=coalesce((v_preview->>'eligibleDevices')::integer,0);
  IF v_queued<1 THEN
    RAISE EXCEPTION 'No verified, opted-in devices in this segment';
  END IF;
  IF v_queued>250 THEN
    RAISE EXCEPTION 'Pilot is capped at 250 device subscriptions per campaign';
  END IF;

  INSERT INTO public.crm_push_campaigns
    (tenant_id,segment_id,created_by,request_key,title,body,open_path,queued_count)
  VALUES (p_tenant_id,p_segment_id,p_created_by,p_request_key,
    btrim(p_title),coalesce(p_body,''),p_open_path,v_queued)
  RETURNING * INTO v_campaign;

  INSERT INTO public.crm_push_messages
    (tenant_id,crm_customer_id,subscription_id,push_campaign_id,
     dedupe_key,title,body,open_path)
  SELECT p_tenant_id,x.crm_customer_id,x.subscription_id,
    v_campaign.id,'segment:'||v_campaign.id::text||':'||x.subscription_id::text,
    v_campaign.title,v_campaign.body,v_campaign.open_path
  FROM public.eligible_crm_push_segment_v1(p_tenant_id,p_segment_id) x
  ON CONFLICT (tenant_id,dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted=ROW_COUNT;

  -- Changes in opt-in during enqueue produce a lower actual count, not sends
  -- to customers who have withdrawn. The worker validates again at delivery.
  UPDATE public.crm_push_campaigns SET queued_count=v_inserted
  WHERE id=v_campaign.id;
  RETURN jsonb_build_object(
    'status','queued','campaignId',v_campaign.id,
    'queued',v_inserted,'idempotent',false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.queue_crm_push_segment_v1(
  uuid,uuid,uuid,text,text,text,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_crm_push_segment_v1(
  uuid,uuid,uuid,text,text,text,text
) TO service_role;

-- Paused/cancelled campaigns cannot be claimed. Keep older single-recipient
-- test pushes (push_campaign_id NULL) eligible under their original consent gate.
CREATE OR REPLACE FUNCTION public.claim_crm_push_messages(p_limit integer DEFAULT 25)
RETURNS SETOF public.crm_push_messages
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  WITH claimable AS (
    SELECT m.id
    FROM public.crm_push_messages m
    JOIN public.crm_push_subscriptions s
      ON s.id=m.subscription_id AND s.tenant_id=m.tenant_id
      AND s.crm_customer_id=m.crm_customer_id AND s.status='active'
    JOIN public.crm_storefront_customer_links l
      ON l.id=s.customer_link_id AND l.tenant_id=m.tenant_id
      AND l.crm_customer_id=m.crm_customer_id AND l.status='verified'
    JOIN public.crm_storefront_tenant_links t
      ON t.storefront_site_id=s.storefront_site_id
      AND t.crm_tenant_id=m.tenant_id AND t.enabled
    JOIN public.crm_push_preferences p
      ON p.tenant_id=m.tenant_id AND p.crm_customer_id=m.crm_customer_id
      AND p.status='opted_in'
    LEFT JOIN public.crm_push_campaigns pc
      ON pc.id=m.push_campaign_id AND pc.tenant_id=m.tenant_id
    WHERE m.attempts < 5
      AND (m.push_campaign_id IS NULL OR pc.status='queued')
      AND (
        (m.status IN ('queued','retry') AND m.available_at<=now())
        OR (m.status='sending' AND m.claimed_at<now()-interval '3 minutes')
      )
    ORDER BY m.available_at, m.id
    LIMIT greatest(1,least(coalesce(p_limit,25),100))
    FOR UPDATE OF m SKIP LOCKED
  )
  UPDATE public.crm_push_messages m
  SET status='sending',attempts=m.attempts+1,claimed_at=now()
  FROM claimable c WHERE m.id=c.id
  RETURNING m.*;
$$;

REVOKE ALL ON FUNCTION public.claim_crm_push_messages(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_crm_push_messages(integer)
  TO service_role;

-- Owner campaign list with authoritative aggregate metrics, no contact
-- addresses or browser subscription secrets.
CREATE FUNCTION public.crm_push_campaign_overview_v1(
  p_tenant_id uuid,p_limit integer DEFAULT 25
)
RETURNS TABLE (
  id uuid,title text,status text,segment_id uuid,queued_count integer,
  accepted bigint,failed bigint,pending bigint,clicks bigint,created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
  SELECT campaign.id,campaign.title,campaign.status,campaign.segment_id,
    campaign.queued_count,
    count(message.id) FILTER (WHERE message.status='accepted'),
    count(message.id) FILTER (WHERE message.status='failed'),
    count(message.id) FILTER (WHERE message.status IN ('queued','sending','retry')),
    count(event.id) FILTER (WHERE event.event_type='clicked'),
    campaign.created_at
  FROM public.crm_push_campaigns campaign
  LEFT JOIN public.crm_push_messages message
    ON message.push_campaign_id=campaign.id AND message.tenant_id=campaign.tenant_id
  LEFT JOIN public.crm_push_events event
    ON event.message_id=message.id AND event.tenant_id=campaign.tenant_id
    AND event.event_type='clicked'
  WHERE campaign.tenant_id=p_tenant_id
    AND coalesce(auth.jwt()->>'role','')='service_role'
  GROUP BY campaign.id
  ORDER BY campaign.created_at DESC
  LIMIT greatest(1,least(coalesce(p_limit,25),50))
$$;

REVOKE ALL ON FUNCTION public.crm_push_campaign_overview_v1(uuid,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_push_campaign_overview_v1(uuid,integer)
  TO service_role;

COMMIT;
