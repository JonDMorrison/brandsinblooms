
-- 1) email_domains: main table to track per-tenant email sending domains
create table if not exists public.email_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,                          -- tenant scope (follow project pattern; no FK to auth/users)
  domain text not null,                             -- e.g. "mygarden.com" or "news.mygarden.com"
  resend_domain_id text,                            -- id returned by Resend /domains
  status text not null default 'pending',           -- 'pending' | 'verifying' | 'active' | 'error'
  error text,
  report_email text,                                -- NEW: optional per-tenant RUA destination
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- In case the table existed without the column, add it idempotently
alter table if exists public.email_domains
  add column if not exists report_email text;

create index if not exists idx_email_domains_tenant on public.email_domains(tenant_id);
create index if not exists idx_email_domains_domain on public.email_domains(domain);

-- Keep updated_at fresh
drop trigger if exists trg_email_domains_updated_at on public.email_domains;
create trigger trg_email_domains_updated_at
before update on public.email_domains
for each row execute function public.update_updated_at_column();

-- 2) email_dns_records: the authoritative records Resend requires (plus our DMARC row)
create table if not exists public.email_dns_records (
  id uuid primary key default gen_random_uuid(),
  email_domain_id uuid not null references public.email_domains(id) on delete cascade,
  name text not null,        -- e.g. "s1._domainkey", "_dmarc", "@"
  type text not null,        -- TXT | CNAME
  value text not null,       -- expected record content/target
  required boolean not null default true,
  purpose text not null,     -- 'dkim' | 'spf' | 'return-path' | 'verification' | 'dmarc'
  created_at timestamptz default now()
);

create index if not exists idx_email_dns_records_domain on public.email_dns_records(email_domain_id);
create index if not exists idx_email_dns_records_purpose on public.email_dns_records(purpose);

-- 3) email_dns_checks: snapshot outcomes of our periodic DNS checks
create table if not exists public.email_dns_checks (
  id uuid primary key default gen_random_uuid(),
  email_domain_id uuid not null references public.email_domains(id) on delete cascade,
  check_name text not null,   -- 'dkim' | 'spf' | 'dmarc' | 'return-path'
  ok boolean not null,
  details jsonb,
  checked_at timestamptz default now()
);

create index if not exists idx_email_dns_checks_domain on public.email_dns_checks(email_domain_id);
create index if not exists idx_email_dns_checks_check on public.email_dns_checks(check_name);

-- 4) Row Level Security (RLS)
-- Follow the established tenant-based access pattern used across the project, via public.users
alter table public.email_domains enable row level security;
alter table public.email_dns_records enable row level security;
alter table public.email_dns_checks enable row level security;

-- email_domains: tenant users can manage their domains (ALL: SELECT/INSERT/UPDATE/DELETE)
drop policy if exists "Tenant users can manage email domains" on public.email_domains;
create policy "Tenant users can manage email domains"
on public.email_domains
for all
using (
  exists (
    select 1
    from public.users u
    where u.tenant_id = email_domains.tenant_id
      and u.id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.tenant_id = email_domains.tenant_id
      and u.id = auth.uid()
  )
);

-- email_dns_records: tenant users can view the required/expected DNS records for their domains (SELECT only)
drop policy if exists "Tenant users can view email DNS records" on public.email_dns_records;
create policy "Tenant users can view email DNS records"
on public.email_dns_records
for select
using (
  exists (
    select 1
    from public.email_domains d
    join public.users u on u.tenant_id = d.tenant_id
    where d.id = email_dns_records.email_domain_id
      and u.id = auth.uid()
  )
);

-- email_dns_checks: tenant users can view check results (SELECT only)
drop policy if exists "Tenant users can view email DNS checks" on public.email_dns_checks;
create policy "Tenant users can view email DNS checks"
on public.email_dns_checks
for select
using (
  exists (
    select 1
    from public.email_domains d
    join public.users u on u.tenant_id = d.tenant_id
    where d.id = email_dns_checks.email_domain_id
      and u.id = auth.uid()
  )
);
