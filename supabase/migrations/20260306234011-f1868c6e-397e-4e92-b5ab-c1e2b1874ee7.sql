-- Disabled migration (data-only).
-- NOTE: This was a one-off data patch and should not be applied via Supabase CLI migrations.
-- Kept for historical reference.
-- Make mintergardening.com the primary sending domain for Minter Country Garden
-- The senderResolver picks the newest domain (ORDER BY created_at DESC LIMIT 1)
-- So we update created_at to now() to make it the preferred domain
UPDATE public.email_domains 
SET created_at = now() 
WHERE id = '52b5892c-2eab-46c8-9488-47d00bfa2c93' 
AND domain = 'mintergardening.com';
