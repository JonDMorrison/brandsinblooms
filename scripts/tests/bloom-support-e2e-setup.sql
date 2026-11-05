\set ON_ERROR_STOP on
-- Disposable database for the Bloom Support end-to-end harness
-- (supabase/functions/_shared/bloom-support/e2e_test.ts). Minimal Supabase
-- surface + the CRM tables Bloom reads, then the real Bloom migrations.
SELECT current_database()='bloom_support_e2e' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_support_e2e'
  \quit 3
\endif
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
CREATE TABLE public.tenants(id uuid PRIMARY KEY, name text);
CREATE TABLE public.users(id uuid PRIMARY KEY, tenant_id uuid, full_name text, role text);
CREATE TABLE public.app_admin_emails(email text PRIMARY KEY);
CREATE FUNCTION public.is_master_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u JOIN public.app_admin_emails a ON lower(a.email) = lower(u.email) WHERE u.id = _user_id) $$;
CREATE TABLE public.crm_campaigns(id uuid PRIMARY KEY, tenant_id uuid, name text, subject_line text, status text, scheduled_at timestamptz, sent_at timestamptz,
  projected_recipient_count int, total_recipients int, send_blocked_reason text, send_error text, send_started_at timestamptz, metadata jsonb, updated_at timestamptz,
  content text, preheader_text text, sender_name text, sender_email text, delivery_method text DEFAULT 'email', include_all_customers boolean, additional_customer_ids uuid[], segment_id uuid);
CREATE TABLE public.crm_segments(id uuid PRIMARY KEY, tenant_id uuid, name text);
CREATE TABLE public.campaign_segments(campaign_id uuid, segment_id uuid);
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.tenants, public.users TO service_role;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO service_role;

\ir ../../supabase/migrations/20261031120000_bloom_support_core.sql
\ir ../../supabase/migrations/20261031120100_bloom_support_functions.sql
\ir ../../supabase/migrations/20261031120200_bloom_support_gateway.sql
\ir ../../supabase/migrations/20261031120300_bloom_support_campaign_ops.sql
\ir ../../supabase/migrations/20261031140000_bloom_support_operations_hardening.sql
\ir ../../supabase/migrations/20261031150000_bloom_support_desk.sql
\ir ../../supabase/migrations/20261101030000_bloom_support_delivery_readiness.sql
\ir ../../supabase/migrations/20261101035144_bloom_support_knowledge_publication.sql
\ir ../../supabase/migrations/20261101051925_bloom_support_site_creation_recovery.sql
\ir ../../supabase/migrations/20261101140000_bloom_support_audit_hardening.sql
\ir ../../supabase/migrations/20261104200000_bloom_support_resolution_cleanup.sql
\ir ../../supabase/migrations/20261104210000_bloom_support_release_reconciliation.sql
\ir ../../supabase/migrations/20261105200000_bloom_support_email_design.sql
\ir ../../supabase/migrations/20261105230000_bloom_support_admin_wording.sql
\ir ../../supabase/migrations/20261105235000_bloom_support_staff_job_failures.sql
\echo 'bloom-support e2e database ready'
