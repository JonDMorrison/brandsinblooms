-- Lock down the campaign-images bucket so unauthenticated clients can no
-- longer LIST every tenant's uploaded image filenames via
-- /storage/v1/object/list/campaign-images. The previous policy "Public read
-- access for campaign images" allowed roles={public} (i.e., anon +
-- authenticated + service_role) to SELECT every row in storage.objects
-- where bucket_id='campaign-images'. SELECT covers both list and direct
-- reads; combined with bucket.public=true that meant any caller with the
-- publishable key (which is hardcoded in the frontend bundle) could
-- enumerate every user's prefix and filename.
--
-- Verified by curl pre-fix: a publishable-key-only request to the list
-- endpoint returned 200 with a JSON array of every user_id prefix in the
-- bucket.
--
-- Direct-by-URL image reads (/storage/v1/object/public/campaign-images/...)
-- are NOT affected by this change — the bucket's public=true flag bypasses
-- RLS for that path. Verified by checking content-assets, which has only a
-- user-scoped SELECT policy and still serves direct public URLs with HTTP
-- 200 to unauthenticated callers.
--
-- Path convention: campaign-images uses {user_id}/{filename} (5/5 sampled
-- prefixes match user_id; only special case is the legacy 'anonymous/'
-- prefix used for AI-generated uploads with no auth context). The new
-- SELECT policy mirrors the convention already used by content-assets,
-- company-assets, ai-generated-images, and problem-attachments — gate on
-- (auth.uid())::text = (storage.foldername(name))[1].

-- Drop the broad public SELECT — this is the listing-leak.
DROP POLICY IF EXISTS "Public read access for campaign images" ON storage.objects;

-- Allow authenticated users to LIST only their own prefix. Anon callers
-- have auth.uid() = NULL, fail the predicate, and get an empty result.
CREATE POLICY "Users can view their own campaign images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'campaign-images'
    AND auth.uid() IS NOT NULL
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Belt-and-suspenders: explicit service_role escape hatch (service_role
-- has BYPASSRLS attribute anyway, but mirroring the pattern from the
-- prior security_rls_fixes_followup migration keeps intent clear).
DROP POLICY IF EXISTS "Service role can manage campaign images"
  ON storage.objects;
CREATE POLICY "Service role can manage campaign images"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'campaign-images')
  WITH CHECK (bucket_id = 'campaign-images');
