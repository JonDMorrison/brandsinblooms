-- Add default_reply_to column to email_domains table
ALTER TABLE public.email_domains
ADD COLUMN default_reply_to TEXT;

-- Add a comment explaining the field
COMMENT ON COLUMN public.email_domains.default_reply_to IS 'Default reply-to email address for campaigns sent from this domain';

-- Update Down To Earth's domain with their preferred reply-to address
UPDATE public.email_domains
SET default_reply_to = 'home@dwntoearth.com'
WHERE id = 'b88ac159-acb2-4d0c-ba81-8ab809219c4d';