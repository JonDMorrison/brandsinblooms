-- Synthetic disposable database only. Existing local anon/authenticated/service_role roles required.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION public.has_tenant_permission(uuid,text,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1::text=current_setting('test.tenant',true) AND $2='campaign.write' $$;
CREATE TABLE crm_campaigns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,user_id uuid,name text,subject_line text,preheader_text text,preheader text,content text,status text,scheduled_at timestamptz,auto_send_enabled boolean,sender_name text,sender_display_name text,sender_email text,actual_sender_email text,from_email_domain_id uuid,delivery_method text,source_campaign_id uuid,include_all_customers boolean,additional_customer_ids uuid[],segment_id uuid,persona_ids uuid[],projected_recipient_count int,metadata jsonb,updated_at timestamptz DEFAULT now(),send_blocked_reason text);
CREATE TABLE crm_connected_websites(tenant_id uuid,cms_site_id uuid,status text);
CREATE TABLE campaign_blocks(campaign_id uuid,block_type text,content jsonb,headline text,image_url text,cta_text text,cta_url text,source text,order_index int);
CREATE TABLE email_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),campaign_id uuid,tenant_id uuid,status text,resend_id text,claim_token uuid,delivery_reconciliation_required boolean DEFAULT false,error_message text,dead_lettered_at timestamptz,updated_at timestamptz);
CREATE TABLE email_send_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),campaign_id uuid,tenant_id uuid,status text,claim_token uuid,recipient_message_ids uuid[],error_message text,updated_at timestamptz);
CREATE TABLE public.crm_sms_campaigns(id uuid primary key default gen_random_uuid(), tenant_id uuid,user_id uuid,name text,message text,media_urls jsonb,status text,source text,metrics jsonb,scheduled_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),segment_id uuid,targeting_persona_ids text[],targeting_persona_names text[],targeting_logic text);
CREATE TABLE public.crm_segments(id uuid,tenant_id uuid);
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
CREATE TABLE public.sms_send_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,campaign_id uuid,status text,error_message text,dead_lettered_at timestamptz,claimed_at timestamptz,claimed_by text,claim_token uuid,updated_at timestamptz);
CREATE TABLE public.sms_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,campaign_id uuid,status text,error_code text,error_message text,dead_lettered_at timestamptz,twilio_sid text,updated_at timestamptz);
