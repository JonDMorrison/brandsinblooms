-- Add missing preheader column to crm_campaigns table
ALTER TABLE public.crm_campaigns 
ADD COLUMN preheader TEXT;