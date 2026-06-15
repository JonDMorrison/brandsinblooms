-- Owner-driven consent attestations recorded at contact-import time.
--
-- Today, CSV-imported contacts land as email_opt_in=false / email_consent_method=
-- 'pending_confirmation' and are silently excluded from sends. Owners discover
-- the gap only when a campaign reaches almost no one (Erin Minter incident, Jeff
-- at Brands in Blooms incident). This change introduces a per-attestation header
-- record so that whenever the import flow flips imported contacts to opted-in,
-- there is an auditable owner statement on file: who attested what, for how many
-- contacts, with the exact wording they saw, when.
--
-- The per-contact consent change continues to be written into
-- crm_email_consent_events (one row per customer), now optionally pointing to
-- the consent_attestations row they came from.

create table if not exists public.consent_attestations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  attested_by_user_id uuid not null references auth.users(id),
  -- 'express' = owner says contacts gave explicit marketing opt-in.
  -- 'unsure'  = owner has no consent record; contacts stay pending.
  -- 'implied' = existing business relationship (CASL/CAN-SPAM implied consent).
  attestation_type text not null check (attestation_type in ('express', 'unsure', 'implied')),
  contact_count integer not null check (contact_count >= 0),
  -- Where in the app the attestation happened (csv_import, paste_import, etc).
  source text not null default 'csv_import',
  -- Soft batch reference: the file name or an id generated client-side.
  import_batch_id text,
  -- The exact UI string the owner saw. We persist this because the wording
  -- itself is the compliance artefact — if we change copy later, old
  -- attestations still document what the owner agreed to at the time.
  attestation_wording text not null,
  created_at timestamptz not null default now()
);

create index if not exists consent_attestations_tenant_created_idx
  on public.consent_attestations (tenant_id, created_at desc);

alter table public.consent_attestations enable row level security;

-- Mirrors the RLS pattern on crm_email_consent_events: users belong to a tenant
-- via the public.users mapping (u.tenant_id, u.id = auth.uid()).
create policy "Users can view consent attestations for their tenant"
  on public.consent_attestations
  for select
  using (
    exists (
      select 1 from public.users u
      where u.tenant_id = consent_attestations.tenant_id
        and u.id = auth.uid()
    )
  );

create policy "Users can insert consent attestations for their tenant"
  on public.consent_attestations
  for insert
  with check (
    attested_by_user_id = auth.uid()
    and exists (
      select 1 from public.users u
      where u.tenant_id = consent_attestations.tenant_id
        and u.id = auth.uid()
    )
  );

-- Extend the per-contact event type list to cover attestation-driven imports.
alter table public.crm_email_consent_events
  drop constraint if exists crm_email_consent_events_event_type_check;

alter table public.crm_email_consent_events
  add constraint crm_email_consent_events_event_type_check
  check (event_type in (
    'opt_in',
    'opt_out',
    'opt_in_request_sent',
    'imported_unknown',
    'updated_by_admin',
    'imported_attested_express',
    'imported_attested_unsure',
    'imported_attested_implied'
  ));

-- Soft link from per-contact event to the attestation it came from.
alter table public.crm_email_consent_events
  add column if not exists attestation_id uuid
  references public.consent_attestations(id) on delete set null;

create index if not exists crm_email_consent_events_attestation_id_idx
  on public.crm_email_consent_events (attestation_id)
  where attestation_id is not null;
