ALTER TABLE public.crm_campaigns
ADD COLUMN IF NOT EXISTS include_all_customers boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS additional_customer_ids uuid[] NOT NULL DEFAULT '{}';
