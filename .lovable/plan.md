
# Fix Form Embed 404 Errors

## Summary
The form embed returns a blank page because no files exist in Supabase Storage at `assets/forms/`. The bucket and policies are correctly configured, but the embed assets were never uploaded.

## Current Status
| Check | Status |
|-------|--------|
| `assets` bucket exists | Done |
| Bucket is public | Done |
| RLS policy for anon SELECT | Done |
| Files in `assets/forms/` | **Missing** |

## Root Cause
The deploy script `scripts/deploy-embed-assets.ts` has not been run to upload the embed files from `public/forms/` to Supabase Storage.

Note: The URL `platform.v1.js` mentioned in your request does not exist. The correct file is `embed.v1.js`.

---

## Fix Required

### Option A: Run the Deploy Script (Recommended)
You need to run the deploy script locally with your Supabase service role key:

```bash
# Set your service role key
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Run the deploy script
npx ts-node scripts/deploy-embed-assets.ts
```

To get your service role key:
1. Go to Supabase Dashboard > Settings > API
2. Copy the `service_role` key (keep this secret!)

### Option B: Manual Upload via Supabase Dashboard
1. Go to **Storage** > **assets** bucket
2. Create folder `forms` if it does not exist
3. Upload these files from `public/forms/`:
   - `embed.v1.js`
   - `embed.v1.5.0.js`
   - `embed.css`

---

## Expected Working URLs After Upload

| File | URL |
|------|-----|
| Main Script | `https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js` |
| Pinned Version | `https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.5.0.js` |
| Styles | `https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.css` |

---

## Verification Checklist
After uploading, verify each URL returns HTTP 200:

- [ ] `/assets/forms/embed.v1.js` returns JavaScript content
- [ ] `/assets/forms/embed.v1.5.0.js` returns JavaScript content
- [ ] `/assets/forms/embed.css` returns CSS content

---

## No Code Changes Needed

This is a deployment/infrastructure issue, not a code issue. The bucket, policies, and embed code are all correct. The files just need to be uploaded to Supabase Storage.

---

## Technical Notes

- The `assets` bucket is already public with correct RLS policies
- Cache headers are set by the deploy script: 1 year for pinned versions, 1 hour for aliases
- The script auto-verifies public access after upload
