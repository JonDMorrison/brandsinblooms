-- Add missing sender columns to crm_campaigns table
ALTER TABLE public.crm_campaigns 
ADD COLUMN sender_email TEXT,
ADD COLUMN sender_name TEXT;