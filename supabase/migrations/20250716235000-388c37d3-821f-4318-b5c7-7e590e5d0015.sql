-- Add delivery_method field to track how emails are sent
ALTER TABLE public.crm_campaigns 
ADD COLUMN delivery_method TEXT DEFAULT 'shared_sender' CHECK (delivery_method IN ('custom_domain', 'shared_sender')),
ADD COLUMN sender_display_name TEXT,
ADD COLUMN actual_sender_email TEXT;