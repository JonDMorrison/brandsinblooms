-- Isolated role and channel-consent dependencies for real POS review RPC tests.
-- Master-admin context is excluded; normal owner/marketing/staff paths use the
-- unchanged production get_current_crm_access and atomic consent writer.
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL);
CREATE TABLE public.users(id uuid PRIMARY KEY,tenant_id uuid,role text);
CREATE TABLE public.admin_session_context(admin_user_id uuid,active_tenant_id uuid);
CREATE TABLE public.user_location_access(user_id uuid,tenant_id uuid,location_id uuid);
CREATE TABLE public.tenant_locations(id uuid,tenant_id uuid,is_active boolean);
CREATE TABLE public.customer_location_activity(tenant_id uuid,customer_id uuid,location_id uuid);
CREATE FUNCTION public.is_master_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
ALTER TABLE public.crm_customers ADD COLUMN phone text,ADD COLUMN email_consent boolean,ADD COLUMN opt_out boolean,ADD COLUMN email_opt_in_at timestamptz,ADD COLUMN email_opt_out_at timestamptz,ADD COLUMN email_consent_source text,ADD COLUMN email_consent_method text,ADD COLUMN email_consent_ip text,ADD COLUMN email_consent_details jsonb,ADD COLUMN updated_at timestamptz,ADD COLUMN primary_location_id uuid,ADD COLUMN sms_consent boolean,ADD COLUMN sms_opt_in_at timestamptz,ADD COLUMN sms_opt_out_at timestamptz,ADD COLUMN sms_consent_source text,ADD COLUMN sms_consent_method text,ADD COLUMN sms_consent_ip text,ADD COLUMN sms_consent_details jsonb;
CREATE TABLE public.suppression_list(tenant_id uuid,customer_id uuid,email text,phone text,suppression_type text,channel text,reason text,auto_suppressed boolean,suppressed_at timestamptz,lifted_at timestamptz,lifted_by uuid,updated_at timestamptz,UNIQUE(tenant_id,email,channel,suppression_type));
CREATE UNIQUE INDEX suppression_phone_fixture ON public.suppression_list(tenant_id,phone,channel,suppression_type) WHERE phone IS NOT NULL;
CREATE TABLE public.crm_email_consent_events(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,customer_id uuid,email text,event_type text,source text,user_agent text,ip_address text,actor_user_id uuid,consent_basis text,evidence jsonb,created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.customer_consents(customer_id uuid,channel text,status text,consent_timestamp timestamptz,created_at timestamptz,updated_at timestamptz,UNIQUE(customer_id,channel));
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.role(),auth.jwt() TO authenticated,service_role;
