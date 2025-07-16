-- Add CRM and SMS addon fields to subscriptions table
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS crm_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS contacts_limit INTEGER DEFAULT 2000;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS email_quota INTEGER DEFAULT 1000;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS sms_quota INTEGER DEFAULT 250;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS email_usage INTEGER DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS sms_usage INTEGER DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS email_overage_price DECIMAL DEFAULT 0.003;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS sms_overage_price DECIMAL DEFAULT 0.06;