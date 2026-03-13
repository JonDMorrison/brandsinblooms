-- Disabled migration (data-only).
-- NOTE: This was a one-off data patch and should not be applied via Supabase CLI migrations.
-- Kept for historical reference.
UPDATE email_domains SET default_reply_to = 'home@dwntoearth.com' WHERE id = '76b9e247-75bb-4d47-927b-3c2db062e593';
