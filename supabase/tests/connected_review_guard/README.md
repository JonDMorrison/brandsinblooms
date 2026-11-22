# Connected campaign review guard

Run these fixtures only against a new disposable PostgreSQL database with the
standard `anon`, `authenticated` and `service_role` roles. The fixture stubs auth
and permission helpers; production RLS/session behavior is not covered here.

From the repository root, set `PGDATABASE` to that disposable database (and normal
PGHOST/PGPORT settings), then run:

```sh
psql -X -v ON_ERROR_STOP=1 \
  -f supabase/tests/connected_review_guard/fixture.sql \
  -f supabase/migrations/20261122060000_connected_content_sms_drafts.sql \
  -f supabase/migrations/20261122070000_replace_connected_sms_draft.sql \
  -f supabase/migrations/20261122080000_replace_connected_email_draft.sql \
  -f supabase/migrations/20261122110000_protect_connected_campaign_reviews.sql \
  -f supabase/tests/connected_review_guard/email_replacement.sql \
  -f supabase/tests/connected_review_guard/sms_replacement.sql \
  -f supabase/tests/connected_review_guard/immutability.sql
```

The actual replacement functions must retain delivery receipts, outstanding
claims and reconciliation records, create one unscheduled draft without an
audience, and return the same draft on retry. The guard assertions reject 36
unsafe campaign/block changes while permitting replacement editing, delivery
counters and late provider reconciliation.
