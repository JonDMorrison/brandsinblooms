
-- Phase A: domain and email sender schema

-- 1) Domains table (tracks both custom domains and system path entries)
CREATE TABLE public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  domain text NOT NULL,
  type text NOT NULL CHECK (type IN ('system_path', 'custom')),
  status text NOT NULL DEFAULT 'pending',           -- pending | active | error | archived
  dns_status text NOT NULL DEFAULT 'unknown',       -- unknown | pending | propagating | verified | error
  tls_status text NOT NULL DEFAULT 'unknown',       -- unknown | pending | active | error
  desired_state jsonb NOT NULL DEFAULT '{}'::jsonb, -- future extensibility
  path_prefix text,                                 -- used for system_path (e.g. /t/{slug})
  is_primary boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, domain)
);

-- 2) Desired/applied/verified DNS records per domain
CREATE TABLE public.domain_dns_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  record_type text NOT NULL,                        -- A | CNAME | TXT | MX | CAA
  name text NOT NULL,                               -- e.g. @, www, _dmarc, selector._domainkey
  value text NOT NULL,                              -- target/value
  priority integer,
  ttl integer,
  desired boolean NOT NULL DEFAULT true,            -- belongs to desired state
  applied boolean NOT NULL DEFAULT false,           -- applied via API/Domain Connect (optional)
  verified boolean NOT NULL DEFAULT false,          -- resolved and matches
  last_checked_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX domain_dns_records_domain_idx ON public.domain_dns_records (domain_id);
CREATE INDEX domain_dns_records_lookup_idx ON public.domain_dns_records (domain_id, name, record_type);

-- 3) Append-only domain events
CREATE TABLE public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  event_type text NOT NULL,                         -- dns_applied | tls_issued | sender_verified | health_changed
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX domain_events_domain_idx ON public.domain_events (domain_id, created_at);

-- 4) Email senders per tenant (supports multiple senders; link to domain when relevant)
CREATE TABLE public.email_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  domain_id uuid REFERENCES public.domains(id) ON DELETE SET NULL,
  sender_email text NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'pending',           -- pending | verifying | verified | failed
  provider text NOT NULL DEFAULT 'resend',
  provider_domain_id text,                          -- e.g. Resend domain id
  dkim_host text,
  dkim_value text,
  spf_value text,
  dmarc_value text,
  last_verified_at timestamptz,
  verified boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sender_email)
);

-- 5) RLS policies (tenant-scoped using public.users.tenant_id pattern)
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant users can manage domains"
  ON public.domains
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.tenant_id = domains.tenant_id
        AND u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.tenant_id = domains.tenant_id
        AND u.id = auth.uid()
    )
  );

ALTER TABLE public.domain_dns_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant users can manage domain dns records"
  ON public.domain_dns_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.domains d
      JOIN public.users u ON u.tenant_id = d.tenant_id
      WHERE d.id = domain_dns_records.domain_id
        AND u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.domains d
      JOIN public.users u ON u.tenant_id = d.tenant_id
      WHERE d.id = domain_dns_records.domain_id
        AND u.id = auth.uid()
    )
  );

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
-- Clients can read events; writes will be done by service role in edge functions (no policy for INSERT/UPDATE/DELETE).
CREATE POLICY "Tenant users can view domain events"
  ON public.domain_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.domains d
      JOIN public.users u ON u.tenant_id = d.tenant_id
      WHERE d.id = domain_events.domain_id
        AND u.id = auth.uid()
    )
  );

ALTER TABLE public.email_senders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant users can manage email senders"
  ON public.email_senders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.tenant_id = email_senders.tenant_id
        AND u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.tenant_id = email_senders.tenant_id
        AND u.id = auth.uid()
    )
  );

-- 6) updated_at triggers
CREATE OR REPLACE FUNCTION public.update_domains_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_domains_updated_at
BEFORE UPDATE ON public.domains
FOR EACH ROW EXECUTE PROCEDURE public.update_domains_updated_at();

CREATE OR REPLACE FUNCTION public.update_domain_dns_records_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_domain_dns_records_updated_at
BEFORE UPDATE ON public.domain_dns_records
FOR EACH ROW EXECUTE PROCEDURE public.update_domain_dns_records_updated_at();

CREATE OR REPLACE FUNCTION public.update_email_senders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_email_senders_updated_at
BEFORE UPDATE ON public.email_senders
FOR EACH ROW EXECUTE PROCEDURE public.update_email_senders_updated_at();
