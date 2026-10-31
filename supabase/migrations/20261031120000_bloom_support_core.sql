-- Bloom Support & Operations — core schema.
--
-- One shared support backend for BloomSites (CMS), BloomSuite CRM and
-- BloomSuite POS. Everything lives in the non-exposed `bloom_support` schema.
-- PostgREST cannot reach it; the only entry points are the bloom-support-*
-- Edge Functions, which authenticate the caller (CRM JWT, API key, signed
-- product intake or webhook signature), resolve a principal, and call the
-- SECURITY DEFINER functions below with that principal. Every function
-- re-checks authority server-side; nothing trusts a client-supplied role,
-- account or tenant.
--
-- The legacy per-tenant helpdesk (public.support_tickets & co.) is left in
-- place untouched; the CRM Support page now routes new requests here.

CREATE SCHEMA IF NOT EXISTS bloom_support;
REVOKE ALL ON SCHEMA bloom_support FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA bloom_support TO service_role;

-- ---------------------------------------------------------------------------
-- Principals, roles and permissions
-- ---------------------------------------------------------------------------
CREATE TABLE bloom_support.principals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('user','external_user','service')),
  -- CRM auth.users id for people who sign in to BloomSuite CRM.
  auth_user_id uuid UNIQUE,
  -- (product, external_id) for people identified by BloomSites / POS.
  product text CHECK (product IN ('cms','crm','pos','email','public')),
  external_id text,
  email text,
  display_name text,
  role text NOT NULL CHECK (role IN ('platform_admin','platform_operator','support','client','service')),
  -- Support-role opt-ins: publish, campaign_send, sensitive. Service scopes:
  -- intake, operations, investigation, release.
  grants text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product, external_id),
  CHECK (kind <> 'service' OR role = 'service'),
  CHECK (role <> 'service' OR kind = 'service'),
  CHECK (kind <> 'external_user' OR (product IS NOT NULL AND external_id IS NOT NULL))
);
CREATE INDEX principals_email ON bloom_support.principals (lower(email));

-- Client accounts (a garden centre / business) across all three products.
CREATE TABLE bloom_support.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  crm_tenant_id uuid UNIQUE,
  primary_email text,
  email_domains text[] NOT NULL DEFAULT '{}',
  notes text,
  needs_review boolean NOT NULL DEFAULT false,
  merged_into uuid REFERENCES bloom_support.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bloom_support.account_links (
  account_id uuid NOT NULL REFERENCES bloom_support.accounts(id) ON DELETE CASCADE,
  product text NOT NULL CHECK (product IN ('cms','crm','pos')),
  external_id text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product, external_id)
);
CREATE INDEX account_links_account ON bloom_support.account_links(account_id);

CREATE TABLE bloom_support.account_members (
  account_id uuid NOT NULL REFERENCES bloom_support.accounts(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'member' CHECK (relationship IN ('owner','member','billing','email_contact')),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, principal_id)
);
CREATE INDEX account_members_principal ON bloom_support.account_members(principal_id);

-- Hashed bearer credentials for ChatGPT/MCP users and Bloom service identities.
CREATE TABLE bloom_support.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id) ON DELETE CASCADE,
  label text NOT NULL,
  prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  -- Optional narrowing; empty = the principal's full authority.
  scopes text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES bloom_support.principals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

-- Static role → permission map. Support opt-ins come from principals.grants.
CREATE TABLE bloom_support.role_permissions (
  role text NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission)
);
INSERT INTO bloom_support.role_permissions(role, permission)
SELECT 'platform_admin', p FROM unnest(ARRAY[
  'tickets.read_all','tickets.write','tickets.internal','tickets.create','accounts.read_all','accounts.write',
  'ops.site.read','ops.site.edit','ops.site.create','ops.site.publish','ops.campaign.edit','ops.campaign.send',
  'ops.event.manage','ops.pos.read','ops.sensitive','engineering.view','engineering.start','engineering.approve',
  'escalations.view','escalations.resolve','features.decide','features.view','admin.roles','admin.policy','automation.control'
]) p
UNION ALL
SELECT 'platform_operator', p FROM unnest(ARRAY[
  'tickets.read_all','tickets.write','tickets.internal','tickets.create','accounts.read_all','accounts.write',
  'ops.site.read','ops.site.edit','ops.site.create','ops.site.publish','ops.campaign.edit','ops.campaign.send',
  'ops.event.manage','ops.pos.read','engineering.view','engineering.start',
  'escalations.view','escalations.resolve','features.view','automation.control'
]) p
UNION ALL
SELECT 'support', p FROM unnest(ARRAY[
  'tickets.read_all','tickets.write','tickets.internal','tickets.create','accounts.read_all',
  'ops.site.read','ops.site.edit','ops.campaign.edit','ops.pos.read','engineering.view','engineering.start',
  'escalations.view','features.view'
]) p
UNION ALL
SELECT 'client', p FROM unnest(ARRAY['tickets.create','tickets.read_own']) p;

-- Grant → permission (support opt-ins and service identity scopes).
CREATE TABLE bloom_support.grant_permissions (
  grant_name text NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (grant_name, permission)
);
INSERT INTO bloom_support.grant_permissions(grant_name, permission) VALUES
  ('publish','ops.site.publish'),
  ('campaign_send','ops.campaign.send'),
  ('sensitive','ops.sensitive'),
  ('event_manage','ops.event.manage'),
  -- Service identities: one narrow scope each, never a shared admin credential.
  ('intake','tickets.create'),('intake','intake.email'),('intake','intake.product'),('intake','intake.attach'),
  ('operations','ops.site.read'),('operations','ops.site.edit'),('operations','ops.campaign.edit'),('operations','ops.pos.read'),
  ('operations','tickets.read_all'),('operations','tickets.write'),('operations','tickets.internal'),('operations','accounts.read_all'),
  ('automation','tickets.read_all'),('automation','tickets.write'),('automation','tickets.internal'),('automation','accounts.read_all'),
  ('automation','engineering.start'),('automation','engineering.view'),('automation','escalations.view'),
  ('investigation','engineering.view'),('investigation','engineering.investigate'),('investigation','tickets.internal'),
  ('release','engineering.view'),('release','engineering.release');

CREATE OR REPLACE FUNCTION bloom_support.has_permission(p_principal uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM bloom_support.principals pr
    WHERE pr.id = p_principal AND pr.active
      AND (
        EXISTS (SELECT 1 FROM bloom_support.role_permissions rp WHERE rp.role = pr.role AND rp.permission = p_permission)
        OR (pr.role IN ('support','service') AND EXISTS (
          SELECT 1 FROM bloom_support.grant_permissions gp WHERE gp.grant_name = ANY(pr.grants) AND gp.permission = p_permission))
      )
  )
$$;

CREATE OR REPLACE FUNCTION bloom_support.require_permission(p_principal uuid, p_permission text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT bloom_support.has_permission(p_principal, p_permission) THEN
    RAISE EXCEPTION 'forbidden: % required', p_permission USING ERRCODE = '42501';
  END IF;
END $$;

-- Universal staff see every account; clients see only verified memberships.
CREATE OR REPLACE FUNCTION bloom_support.can_access_account(p_principal uuid, p_account uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT bloom_support.has_permission(p_principal, 'accounts.read_all')
      OR EXISTS (SELECT 1 FROM bloom_support.account_members m
                 WHERE m.principal_id = p_principal AND m.account_id = p_account AND m.verified)
$$;

-- ---------------------------------------------------------------------------
-- Conversations, tickets, messages, attachments
-- ---------------------------------------------------------------------------
CREATE TABLE bloom_support.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES bloom_support.accounts(id),
  requester_id uuid REFERENCES bloom_support.principals(id),
  channel text NOT NULL CHECK (channel IN ('cms','crm','pos','email','public','chatgpt','staff')),
  subject text NOT NULL,
  -- Root RFC 5322 Message-ID used to thread replies.
  email_thread_root text UNIQUE,
  reply_to_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_account ON bloom_support.conversations(account_id, updated_at DESC);

CREATE SEQUENCE bloom_support.ticket_number_seq START 1001;

CREATE TABLE bloom_support.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint NOT NULL UNIQUE DEFAULT nextval('bloom_support.ticket_number_seq'),
  conversation_id uuid NOT NULL REFERENCES bloom_support.conversations(id),
  account_id uuid REFERENCES bloom_support.accounts(id),
  requester_id uuid REFERENCES bloom_support.principals(id),
  product text NOT NULL CHECK (product IN ('cms','crm','pos','platform','unknown')),
  channel text NOT NULL CHECK (channel IN ('cms','crm','pos','email','public','chatgpt','staff')),
  kind text NOT NULL DEFAULT 'unknown' CHECK (kind IN ('unknown','bug','question','request','feature','operation','account')),
  category text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  impact text NOT NULL DEFAULT 'unknown' CHECK (impact IN ('unknown','single_user','account','multi_account','platform')),
  -- Client-facing status. Exactly the five agreed statuses.
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','working','waiting','needs_owner','resolved')),
  -- Richer internal execution state.
  stage text NOT NULL DEFAULT 'intake' CHECK (stage IN (
    'intake','triage','needs_info','answering','operating','investigating','fixing','releasing','verifying',
    'awaiting_client','awaiting_decision','escalated','resolved','closed')),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 300),
  summary text NOT NULL CHECK (length(summary) <= 20000),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_id uuid REFERENCES bloom_support.principals(id),
  next_action text,
  -- auto: Bloom may act; paused: Bloom proposes only; human: a person took over and Bloom must not message the client.
  automation text NOT NULL DEFAULT 'auto' CHECK (automation IN ('auto','paused','human')),
  taken_over_by uuid REFERENCES bloom_support.principals(id),
  taken_over_at timestamptz,
  duplicate_of uuid REFERENCES bloom_support.tickets(id),
  engineering_issue_id uuid,
  feature_request_id uuid,
  resolution_summary text,
  resolution_verified boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  reopen_count integer NOT NULL DEFAULT 0,
  dedupe_key text UNIQUE,
  search tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(subject,'') || ' ' || coalesce(summary,''))) STORED,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (duplicate_of IS NULL OR duplicate_of <> id),
  CHECK (status <> 'resolved' OR resolved_at IS NOT NULL)
);
CREATE INDEX tickets_queue ON bloom_support.tickets(status, priority, updated_at DESC);
CREATE INDEX tickets_account ON bloom_support.tickets(account_id, created_at DESC);
CREATE INDEX tickets_conversation ON bloom_support.tickets(conversation_id);
CREATE INDEX tickets_search ON bloom_support.tickets USING gin(search);
CREATE INDEX tickets_engineering ON bloom_support.tickets(engineering_issue_id);

CREATE TABLE bloom_support.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES bloom_support.conversations(id),
  ticket_id uuid REFERENCES bloom_support.tickets(id),
  author_id uuid REFERENCES bloom_support.principals(id),
  author_kind text NOT NULL CHECK (author_kind IN ('client','staff','bloom','system')),
  visibility text NOT NULL CHECK (visibility IN ('public','internal')),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound','internal')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 50000),
  email_message_id text UNIQUE,
  in_reply_to text,
  idempotency_key text UNIQUE,
  delivery text NOT NULL DEFAULT 'none' CHECK (delivery IN ('none','queued','sent','failed','suppressed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (visibility = 'public' OR direction = 'internal')
);
CREATE INDEX messages_conversation ON bloom_support.messages(conversation_id, created_at);
CREATE INDEX messages_ticket ON bloom_support.messages(ticket_id, created_at);

CREATE TABLE bloom_support.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id),
  message_id uuid REFERENCES bloom_support.messages(id),
  account_id uuid REFERENCES bloom_support.accounts(id),
  storage_bucket text NOT NULL DEFAULT 'bloom-support',
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 15728640),
  sha256 text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','internal')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_ticket ON bloom_support.attachments(ticket_id);

CREATE TABLE bloom_support.ticket_links (
  from_ticket uuid NOT NULL REFERENCES bloom_support.tickets(id),
  to_ticket uuid NOT NULL REFERENCES bloom_support.tickets(id),
  kind text NOT NULL CHECK (kind IN ('related','duplicate','same_conversation','follow_up')),
  created_by uuid REFERENCES bloom_support.principals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_ticket, to_ticket, kind),
  CHECK (from_ticket <> to_ticket)
);

-- Signed, revocable, client-visible tracking links (one ticket each).
CREATE TABLE bloom_support.tracking_tokens (
  token_hash text PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '180 days',
  revoked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Engineering issues, feature requests, escalations, operations
-- ---------------------------------------------------------------------------
CREATE TABLE bloom_support.engineering_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  product text NOT NULL CHECK (product IN ('cms','crm','pos','platform','unknown')),
  repository text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','investigating','reproduced','not_reproduced','fixing','in_review','awaiting_approval','approved',
    'merging','merged','deploying','deployed','verifying','verified','failed','rolled_back','escalated','closed')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reproduction jsonb,
  risk jsonb,
  eligibility jsonb,
  branch text,
  pr_number integer,
  pr_url text,
  head_sha text,
  merge_sha text,
  deployment jsonb,
  verification jsonb,
  rollback jsonb,
  approved_by uuid REFERENCES bloom_support.principals(id),
  approved_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES bloom_support.principals(id),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bloom_support.tickets
  ADD CONSTRAINT tickets_engineering_fk FOREIGN KEY (engineering_issue_id) REFERENCES bloom_support.engineering_issues(id);

CREATE TABLE bloom_support.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  product text NOT NULL CHECK (product IN ('cms','crm','pos','platform','unknown')),
  status text NOT NULL DEFAULT 'awaiting_decision' CHECK (status IN ('awaiting_decision','accepted','declined','planned','shipped','merged')),
  decision_note text,
  decided_by uuid REFERENCES bloom_support.principals(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bloom_support.tickets
  ADD CONSTRAINT tickets_feature_fk FOREIGN KEY (feature_request_id) REFERENCES bloom_support.feature_requests(id);

CREATE TABLE bloom_support.feature_evidence (
  feature_request_id uuid NOT NULL REFERENCES bloom_support.feature_requests(id),
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id),
  account_id uuid REFERENCES bloom_support.accounts(id),
  excerpt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feature_request_id, ticket_id)
);

CREATE TABLE bloom_support.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES bloom_support.tickets(id),
  engineering_issue_id uuid REFERENCES bloom_support.engineering_issues(id),
  feature_request_id uuid REFERENCES bloom_support.feature_requests(id),
  audience text NOT NULL CHECK (audience IN ('jon','jeff','both')),
  reason text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  decision text,
  decided_by uuid REFERENCES bloom_support.principals(id),
  dedupe_key text UNIQUE,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX escalations_open ON bloom_support.escalations(status, created_at DESC);

-- Consequential product operations: preview → confirm → execute → verify.
CREATE TABLE bloom_support.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES bloom_support.tickets(id),
  account_id uuid NOT NULL REFERENCES bloom_support.accounts(id),
  actor_id uuid NOT NULL REFERENCES bloom_support.principals(id),
  kind text NOT NULL,
  permission text NOT NULL,
  inputs jsonb NOT NULL,
  preview jsonb,
  status text NOT NULL DEFAULT 'previewed' CHECK (status IN ('previewed','confirmed','executing','succeeded','failed','expired','undone','cancelled')),
  result jsonb,
  verification jsonb,
  undo jsonb,
  error text,
  idempotency_key text UNIQUE,
  confirmed_by uuid REFERENCES bloom_support.principals(id),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operations_account ON bloom_support.operations(account_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Email ledger (dedupe + loop prevention)
-- ---------------------------------------------------------------------------
CREATE TABLE bloom_support.email_events (
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  message_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL,
  ticket_id uuid REFERENCES bloom_support.tickets(id),
  PRIMARY KEY (provider, provider_event_id)
);
CREATE INDEX email_events_message ON bloom_support.email_events(message_id);

CREATE TABLE bloom_support.outbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES bloom_support.tickets(id),
  message_id uuid REFERENCES bloom_support.messages(id),
  purpose text NOT NULL CHECK (purpose IN ('acknowledgement','clarification','progress','resolution','reply','escalation','feature_decision','notification')),
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  rfc_message_id text NOT NULL UNIQUE,
  in_reply_to text,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','suppressed','not_configured')),
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX outbound_emails_ticket ON bloom_support.outbound_emails(ticket_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Approved product knowledge for answering questions
-- ---------------------------------------------------------------------------
CREATE TABLE bloom_support.knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL CHECK (product IN ('cms','crm','pos','platform')),
  title text NOT NULL,
  body text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES bloom_support.principals(id),
  search tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_search ON bloom_support.knowledge USING gin(search);

-- ---------------------------------------------------------------------------
-- Settings, audit, notifications, jobs
-- ---------------------------------------------------------------------------
CREATE TABLE bloom_support.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES bloom_support.principals(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO bloom_support.settings(key, value) VALUES
  ('automation_enabled', 'true'),
  ('client_email_enabled', 'false'),
  ('auto_release_enabled', 'false'),
  ('ai', '{"provider":"openai","model":"gpt-5-mini","max_calls_per_account_per_day":200}'),
  ('owners', '{"jon":[],"jeff":[]}'),
  ('limits', '{"jobs_per_account_per_hour":60,"tickets_per_account_per_day":100,"public_tickets_per_email_per_day":5}'),
  ('support_inbox', '{"address":null,"from_name":"Bloom Support"}');

CREATE TABLE bloom_support.activity (
  id bigserial PRIMARY KEY,
  ticket_id uuid REFERENCES bloom_support.tickets(id),
  account_id uuid REFERENCES bloom_support.accounts(id),
  actor_id uuid REFERENCES bloom_support.principals(id),
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_ticket ON bloom_support.activity(ticket_id, id);
CREATE INDEX activity_account ON bloom_support.activity(account_id, id DESC);

CREATE OR REPLACE FUNCTION bloom_support.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'bloom_support.% is append-only', TG_TABLE_NAME USING ERRCODE = '42501'; END $$;
CREATE TRIGGER activity_append_only BEFORE UPDATE OR DELETE ON bloom_support.activity
  FOR EACH ROW EXECUTE FUNCTION bloom_support.reject_mutation();

CREATE TABLE bloom_support.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id),
  ticket_id uuid REFERENCES bloom_support.tickets(id),
  kind text NOT NULL,
  title text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_unread ON bloom_support.notifications(principal_id, read_at, created_at DESC);

CREATE TABLE bloom_support.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('triage','answer','operate','investigate','engineering_step','send_email','verify_resolution','escalate','notify')),
  ticket_id uuid REFERENCES bloom_support.tickets(id),
  engineering_issue_id uuid REFERENCES bloom_support.engineering_issues(id),
  -- Isolation lane: one running job per account lane at a time.
  lane text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','dead','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  timeout_seconds integer NOT NULL DEFAULT 120 CHECK (timeout_seconds BETWEEN 5 AND 3600),
  run_after timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  locked_by text,
  idempotency_key text UNIQUE,
  last_error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_ready ON bloom_support.jobs(status, run_after) WHERE status IN ('queued','running');
CREATE INDEX jobs_lane ON bloom_support.jobs(lane) WHERE status = 'running';
CREATE INDEX jobs_ticket ON bloom_support.jobs(ticket_id, created_at DESC);

-- Rate/usage counters (per account, per day/hour buckets).
CREATE TABLE bloom_support.usage_counters (
  bucket text NOT NULL,
  subject text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject)
);

-- RLS on with no policies: only the definer functions below (service_role) reach rows.
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'bloom_support' LOOP
    EXECUTE format('ALTER TABLE bloom_support.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON bloom_support.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
