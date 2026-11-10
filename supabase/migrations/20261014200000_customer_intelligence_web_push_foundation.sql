-- Customer Intelligence Web Push foundation.
-- All delivery data is private. No browser role may read endpoints or keys.
-- No subscription or CRM customer mapping is inferred from an email address.
-- Enabling a tenant and linking a customer require explicit reviewed actions.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS crm_customers_tenant_id_id_for_web_push
  ON public.crm_customers (tenant_id, id);

CREATE TABLE public.crm_storefront_tenant_links (
  storefront_site_id uuid PRIMARY KEY,
  crm_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  enabled boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storefront_site_id, crm_tenant_id),
  CHECK (NOT enabled OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE public.crm_storefront_customer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  storefront_site_id uuid NOT NULL,
  storefront_user_id uuid NOT NULL,
  source_email text,
  source_email_seen_at timestamptz,
  crm_customer_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','revoked')),
  evidence_ref text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (storefront_site_id, tenant_id)
    REFERENCES public.crm_storefront_tenant_links (storefront_site_id, crm_tenant_id),
  FOREIGN KEY (tenant_id, crm_customer_id)
    REFERENCES public.crm_customers (tenant_id, id),
  UNIQUE (storefront_site_id, storefront_user_id),
  UNIQUE (id, tenant_id, crm_customer_id, storefront_site_id),
  CHECK (status <> 'verified' OR (
    crm_customer_id IS NOT NULL AND reviewed_by IS NOT NULL AND
    reviewed_at IS NOT NULL AND length(btrim(coalesce(evidence_ref, ''))) >= 8
  ))
);

CREATE UNIQUE INDEX crm_storefront_verified_customer_unique
  ON public.crm_storefront_customer_links (storefront_site_id, crm_customer_id)
  WHERE status = 'verified';

CREATE TABLE public.crm_push_preferences (
  tenant_id uuid NOT NULL,
  crm_customer_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('opted_in','opted_out')),
  evidence_ref text NOT NULL CHECK (length(btrim(evidence_ref)) >= 8),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, crm_customer_id),
  FOREIGN KEY (tenant_id, crm_customer_id)
    REFERENCES public.crm_customers (tenant_id, id)
);

CREATE TABLE public.crm_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  storefront_site_id uuid NOT NULL,
  crm_customer_id uuid NOT NULL,
  customer_link_id uuid NOT NULL,
  endpoint_url text NOT NULL CHECK (length(endpoint_url) BETWEEN 40 AND 4096),
  endpoint_sha256 text NOT NULL UNIQUE CHECK (endpoint_sha256 ~ '^[a-f0-9]{64}$'),
  key_p256dh text NOT NULL CHECK (length(key_p256dh) BETWEEN 24 AND 256),
  key_auth text NOT NULL CHECK (length(key_auth) BETWEEN 12 AND 256),
  vapid_key_version integer NOT NULL DEFAULT 1 CHECK (vapid_key_version > 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked','invalid')),
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  invalidated_at timestamptz,
  FOREIGN KEY (customer_link_id, tenant_id, crm_customer_id, storefront_site_id)
    REFERENCES public.crm_storefront_customer_links
      (id, tenant_id, crm_customer_id, storefront_site_id),
  FOREIGN KEY (tenant_id, crm_customer_id)
    REFERENCES public.crm_push_preferences (tenant_id, crm_customer_id)
);

CREATE INDEX crm_push_subscriptions_customer_idx
  ON public.crm_push_subscriptions (tenant_id, crm_customer_id, status);

CREATE TABLE public.crm_push_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  crm_customer_id uuid NOT NULL,
  subscription_id uuid NOT NULL REFERENCES public.crm_push_subscriptions(id),
  campaign_id uuid REFERENCES public.crm_campaigns(id),
  dedupe_key text NOT NULL CHECK (length(dedupe_key) BETWEEN 8 AND 200),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 240),
  open_path text NOT NULL CHECK (left(open_path,1)='/' AND left(open_path,2)<>'//' AND length(open_path)<=1024),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sending','retry','accepted','failed','cancelled')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  accepted_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, crm_customer_id)
    REFERENCES public.crm_customers (tenant_id, id),
  UNIQUE (tenant_id, dedupe_key)
);

CREATE INDEX crm_push_messages_claim_idx
  ON public.crm_push_messages (available_at, created_at, id)
  WHERE status IN ('queued','retry','sending');

CREATE TABLE public.crm_push_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  message_id uuid NOT NULL REFERENCES public.crm_push_messages(id),
  event_type text NOT NULL CHECK (event_type IN
    ('queued','accepted','failed','clicked','subscription_invalid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX crm_push_events_message_idx
  ON public.crm_push_events (message_id, created_at);

ALTER TABLE public.crm_storefront_tenant_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_storefront_customer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_push_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_push_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_storefront_tenant_links,
  public.crm_storefront_customer_links,
  public.crm_push_preferences,
  public.crm_push_subscriptions,
  public.crm_push_messages,
  public.crm_push_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_storefront_tenant_links,
  public.crm_storefront_customer_links,
  public.crm_push_preferences,
  public.crm_push_subscriptions,
  public.crm_push_messages,
  public.crm_push_events TO service_role;

-- This is an internal worker RPC. A stuck claim may be leased again after
-- three minutes. Dedupe at message creation and use message ID as push tag.
CREATE FUNCTION public.claim_crm_push_messages(p_limit integer DEFAULT 25)
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
      ON l.id=s.customer_link_id AND l.status='verified'
    JOIN public.crm_storefront_tenant_links t
      ON t.storefront_site_id=s.storefront_site_id AND
         t.crm_tenant_id=m.tenant_id AND t.enabled
    JOIN public.crm_push_preferences p
      ON p.tenant_id=m.tenant_id AND p.crm_customer_id=m.crm_customer_id
      AND p.status='opted_in'
    WHERE m.attempts < 5 AND (
      (m.status IN ('queued','retry') AND m.available_at <= now())
      OR (m.status='sending' AND m.claimed_at < now()-interval '3 minutes')
    )
    ORDER BY m.available_at, m.id
    LIMIT greatest(1, least(coalesce(p_limit,25), 100))
    FOR UPDATE OF m SKIP LOCKED
  )
  UPDATE public.crm_push_messages m
  SET status='sending', attempts=m.attempts+1, claimed_at=now()
  FROM claimable c WHERE m.id=c.id
  RETURNING m.*;
$$;

REVOKE ALL ON FUNCTION public.claim_crm_push_messages(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_crm_push_messages(integer)
  TO service_role;


-- Signed storefront bridge replays are processed atomically with subscription
-- mutations. A lost HTTP response is safe to retry with the same event UUID.
CREATE TABLE public.crm_push_bridge_events (
  event_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  storefront_site_id uuid NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  outcome jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_push_bridge_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_push_bridge_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_push_bridge_events TO service_role;

CREATE FUNCTION public.accept_storefront_push_v1(
  p_event_id uuid,
  p_site_id uuid,
  p_user_id uuid,
  p_action text,
  p_endpoint text,
  p_endpoint_hash text,
  p_p256dh text,
  p_auth text,
  p_vapid_version integer,
  p_payload_hash text,
  p_source_email text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_tenant uuid;
  v_link public.crm_storefront_customer_links%ROWTYPE;
  v_prior public.crm_push_bridge_events%ROWTYPE;
  v_outcome jsonb;
BEGIN
  IF p_event_id IS NULL OR p_site_id IS NULL OR p_user_id IS NULL OR
     p_action NOT IN ('subscribe','unsubscribe') OR
     p_payload_hash !~ '^[a-f0-9]{64}$' OR
     p_endpoint_hash !~ '^[a-f0-9]{64}$'
  THEN RAISE EXCEPTION 'Invalid push bridge event'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id::text,0));
  SELECT * INTO v_prior FROM public.crm_push_bridge_events
  WHERE event_id=p_event_id;
  IF FOUND THEN
    IF v_prior.payload_sha256 IS DISTINCT FROM p_payload_hash OR
       v_prior.storefront_site_id IS DISTINCT FROM p_site_id
    THEN RAISE EXCEPTION 'Changed push bridge retry'; END IF;
    RETURN v_prior.outcome;
  END IF;

  SELECT crm_tenant_id INTO v_tenant
  FROM public.crm_storefront_tenant_links
  WHERE storefront_site_id=p_site_id AND enabled=true;

  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('status','tenant_not_enabled');
  END IF;

  SELECT * INTO v_link FROM public.crm_storefront_customer_links
  WHERE tenant_id=v_tenant AND storefront_site_id=p_site_id
    AND storefront_user_id=p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.crm_storefront_customer_links
      (tenant_id,storefront_site_id,storefront_user_id,status,source_email,source_email_seen_at)
    VALUES (v_tenant,p_site_id,p_user_id,'pending',
      nullif(left(lower(btrim(coalesce(p_source_email,''))),254),''),now())
    ON CONFLICT (storefront_site_id,storefront_user_id) DO NOTHING;
    v_outcome:=jsonb_build_object('status','identity_review_required');
  ELSIF v_link.status <> 'verified' OR v_link.crm_customer_id IS NULL THEN
    UPDATE public.crm_storefront_customer_links
      SET source_email=nullif(left(lower(btrim(coalesce(p_source_email,''))),254),''),
          source_email_seen_at=now(),updated_at=now()
      WHERE id=v_link.id AND status='pending';
    v_outcome:=jsonb_build_object('status','identity_review_required');
  ELSIF p_action='unsubscribe' THEN
    INSERT INTO public.crm_push_preferences
      (tenant_id,crm_customer_id,status,evidence_ref)
    VALUES (v_tenant,v_link.crm_customer_id,'opted_out',
      'storefront-push:'||p_event_id::text)
    ON CONFLICT (tenant_id,crm_customer_id)
    DO UPDATE SET status='opted_out', evidence_ref=EXCLUDED.evidence_ref,
      recorded_at=now(), updated_at=now();
    UPDATE public.crm_push_subscriptions
      SET status='revoked', revoked_at=now()
      WHERE tenant_id=v_tenant AND crm_customer_id=v_link.crm_customer_id
        AND status='active';
    v_outcome:=jsonb_build_object('status','unsubscribed');
  ELSE
    IF p_endpoint IS NULL OR left(p_endpoint,8)<>'https://' OR
       p_p256dh IS NULL OR p_auth IS NULL OR
       length(p_p256dh) NOT BETWEEN 24 AND 256 OR
       length(p_auth) NOT BETWEEN 12 AND 256 OR
       p_vapid_version IS NULL OR p_vapid_version < 1
    THEN RAISE EXCEPTION 'Malformed browser subscription'; END IF;

    -- Both a direct customer action and browser-granted permission are required
    -- by the trusted storefront before it signs this event. The bridge never
    -- obtains consent from a marketing contact email.
    INSERT INTO public.crm_push_preferences
      (tenant_id,crm_customer_id,status,evidence_ref)
    VALUES (v_tenant,v_link.crm_customer_id,'opted_in',
      'storefront-push:'||p_event_id::text)
    ON CONFLICT (tenant_id,crm_customer_id)
    DO UPDATE SET status='opted_in', evidence_ref=EXCLUDED.evidence_ref,
      recorded_at=now(), updated_at=now();

    INSERT INTO public.crm_push_subscriptions
      (tenant_id,storefront_site_id,crm_customer_id,customer_link_id,
       endpoint_url,endpoint_sha256,key_p256dh,key_auth,vapid_key_version)
    VALUES (v_tenant,p_site_id,v_link.crm_customer_id,v_link.id,
      p_endpoint,p_endpoint_hash,p_p256dh,p_auth,p_vapid_version)
    ON CONFLICT (endpoint_sha256) DO UPDATE
      SET key_p256dh=EXCLUDED.key_p256dh, key_auth=EXCLUDED.key_auth,
        vapid_key_version=EXCLUDED.vapid_key_version, status='active',
        last_seen_at=now(), revoked_at=NULL, invalidated_at=NULL
      WHERE crm_push_subscriptions.tenant_id=EXCLUDED.tenant_id
        AND crm_push_subscriptions.crm_customer_id=EXCLUDED.crm_customer_id
        AND crm_push_subscriptions.storefront_site_id=EXCLUDED.storefront_site_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subscription belongs to another customer or tenant';
    END IF;
    v_outcome:=jsonb_build_object('status','subscribed');
  END IF;

  INSERT INTO public.crm_push_bridge_events
    (event_id,tenant_id,storefront_site_id,payload_sha256,outcome)
  VALUES (p_event_id,v_tenant,p_site_id,p_payload_hash,v_outcome);
  RETURN v_outcome;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_storefront_push_v1(
  uuid,uuid,uuid,text,text,text,text,text,integer,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_storefront_push_v1(
  uuid,uuid,uuid,text,text,text,text,text,integer,text,text)
  TO service_role;

COMMIT;
