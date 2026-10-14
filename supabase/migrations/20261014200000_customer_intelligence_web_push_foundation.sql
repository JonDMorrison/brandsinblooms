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

COMMIT;
