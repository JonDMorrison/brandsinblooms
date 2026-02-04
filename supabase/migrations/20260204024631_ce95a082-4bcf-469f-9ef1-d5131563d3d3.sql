-- Add source column to track where SMS campaigns originate from
ALTER TABLE public.crm_sms_campaigns 
ADD COLUMN source text;