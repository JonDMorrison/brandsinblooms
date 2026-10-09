-- Disposable PostgreSQL fixture only. Columns and checks match the inspected
-- production ledger; original resolution and metric functions are loaded by CI.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
 SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
 SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL);
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),email text NOT NULL,deleted_at timestamptz,merged_into_customer_id uuid,email_opt_in boolean NOT NULL DEFAULT false,sms_opt_in boolean NOT NULL DEFAULT false,suppressed boolean NOT NULL DEFAULT false);
CREATE TABLE public.pos_connections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES public.tenants(id),user_id uuid NOT NULL,platform text NOT NULL,name text NOT NULL,settings jsonb NOT NULL DEFAULT '{}',is_active boolean NOT NULL DEFAULT true,last_sync_at timestamptz,sync_status text DEFAULT 'pending',sync_error text,
 CONSTRAINT pos_connections_platform_check CHECK(platform IN ('shopify','square','vmx')),
 CONSTRAINT pos_connections_sync_status_check CHECK(sync_status IN ('pending','syncing','success','error')));
CREATE TABLE public.pos_customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pos_connection_id uuid NOT NULL REFERENCES public.pos_connections(id),external_id text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE public.crm_customer_identity_links(tenant_id uuid NOT NULL,crm_customer_id uuid NOT NULL,pos_customer_id uuid NOT NULL);
CREATE TABLE public.pos_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pos_connection_id uuid NOT NULL,pos_customer_id uuid REFERENCES public.pos_customers(id),external_id text NOT NULL,external_customer_id text,order_date timestamptz NOT NULL,total_amount numeric,currency text DEFAULT 'USD',status text,items jsonb NOT NULL DEFAULT '[]',raw_data jsonb,tenant_id uuid REFERENCES public.tenants(id),provider text,refund_amount numeric,refunded_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(pos_connection_id,external_id),CHECK(provider IS NULL OR provider IN ('square','clover','lightspeed','shopify','vmx','other')));
CREATE TABLE public.customer_engagement_summary(customer_id uuid,tenant_id uuid,purchase_score numeric,updated_at timestamptz);
