-- Drop vestigial email tracking tables.
--
-- Background: 2026-05-07 email-tracking-pipeline audit
-- (docs/email-tracking-architecture.md, also captured at
-- /tmp/email-tracking-audit.md from the audit session) traced every
-- email-related table and confirmed which are live vs vestigial.
--
-- email_send_log was created by migration 20260120221739 as the intended
-- source of truth for "every successful Resend send". It was never wired
-- up. Zero rows. Zero references in any function or component code (only
-- the auto-generated supabase types.ts schema dump). The actual
-- implementation chose email_messages (per-recipient send records,
-- 140k rows, 131k with resend_id) plus email_governance_email_events
-- (webhook event log, 89k rows including delivered/opened/clicked/
-- bounced/complained) as the canonical stores. Dropping email_send_log
-- removes the misleading empty-table surprise that triggered today's
-- "tracking is broken" investigation.
--
-- email_click_events (also 0 rows, also a vestige) is intentionally
-- KEPT for now: it has lingering references in dead code paths
-- (track-email-click edge function, _shared/linkTracking.ts helper,
-- useClickStats hook, CampaignClickStats component) that should be
-- retired together in a follow-up cleanup. Per the work order's
-- "if it has any references at all, leave it alone and just add a
-- comment" rule, we only annotate it here.

DROP TABLE IF EXISTS public.email_send_log;

COMMENT ON TABLE public.email_click_events IS
  'DEPRECATED 2026-05-07. Click tracking goes through redirect-click + tracked_links + email_governance_email_events (event_type=''clicked''). Writers (track-email-click, _shared/linkTracking.ts) and readers (useClickStats hook, CampaignClickStats component) are all unmounted/unused dead code. Do not write here. Plan to drop this table together with its dead-code cohort in a follow-up commit.';
