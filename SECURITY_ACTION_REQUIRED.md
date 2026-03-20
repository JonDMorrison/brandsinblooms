URGENT: The Supabase service role key for project udldmkqwnxhdeztyqcau has been committed to git history.

Actions required:
1. Go to Supabase Dashboard → Settings → API → Rotate service role key
2. Update SUPABASE_SERVICE_ROLE_KEY in all Supabase edge function environment variables
3. Update any CI/CD secrets that use this key
4. Consider git history scrubbing with git filter-repo to remove the key from all commits

Files where the key was found:
- supabase/migrations/20251009155016_7a5e0620-27db-47bc-bfc6-1a3d3901076d.sql (line 15)
- supabase/migrations/20250829230351_c3afb47c-ecc5-41ce-8720-8579247204ad.sql (line 9)
