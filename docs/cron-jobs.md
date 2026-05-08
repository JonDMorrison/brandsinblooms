# pg_cron job inventory

Status: canonical reference, last updated 2026-05-07.
Audience: anyone debugging "why didn't this cron fire" or adding a new background job.

## Auth pattern — read this first

**All authenticated cron jobs MUST resolve their bearer token through one of the database-level GUCs:**

```sql
headers := jsonb_build_object(
  'Content-Type', 'application/json',
  'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
)
```

The GUC is set out-of-band via:

```sql
ALTER DATABASE postgres SET supabase.service_role_key = '<service-role-jwt>';
ALTER DATABASE postgres SET app.service_role_key       = '<service-role-jwt>';
```

**Why both `supabase.*` and `app.*`?** Historical drift: the codebase added jobs against both names without standardizing. Both should hold the same value. Future cron jobs should standardize on `supabase.service_role_key`.

**The value is NOT in any migration**, because committing the JWT to git would expose it. It must be set manually in the Supabase dashboard SQL editor (or via `psql` with the service role connection) once per project lifecycle and after any `pg_dump`-based restore.

**What you must NEVER do:**
- Hardcode the JWT into a cron command (rotation breaks every cron silently).
- Use a placeholder string like `YOUR_SERVICE_ROLE_KEY` (cron will 401-storm).
- Rely on `current_setting(name)` without the `, true` flag — that raises an exception when the GUC is unset, instead of returning NULL.
- Ship a migration that calls `ALTER DATABASE ... RESET app.service_role_key` or similar.

**How to verify the GUC is healthy:**

```sql
SELECT
  current_setting('app.service_role_key', true)      IS NULL AS app_null,
  LENGTH(COALESCE(current_setting('app.service_role_key', true), ''))      AS app_len,
  current_setting('supabase.service_role_key', true) IS NULL AS supabase_null,
  LENGTH(COALESCE(current_setting('supabase.service_role_key', true), '')) AS supabase_len;
```

A healthy project shows `app_null=false`, `supabase_null=false`, both lengths ~200+ (Supabase service-role JWTs are ~200 chars).

## How to detect that crons are silently 401-storming

`cron.job_run_details.status='succeeded'` is misleading: pg_cron records "succeeded" the moment the HTTP fire-and-forget call dispatches, regardless of the edge function's response code. The actual response code is in `net.http_response`, and far more usefully in the edge-function logs.

Quick triage queries:

```sql
-- Active crons + the auth source they pull from
SELECT jobname, schedule,
  CASE
    WHEN command LIKE '%current_setting(''app.service_role_key''%'      THEN 'app GUC'
    WHEN command LIKE '%current_setting(''supabase.service_role_key''%' THEN 'supabase GUC'
    WHEN command LIKE '%Bearer eyJhbGciO%'                              THEN 'hardcoded JWT'
    WHEN command LIKE '%YOUR_SERVICE_ROLE_KEY%'                         THEN 'PLACEHOLDER (broken)'
  END AS auth_source
FROM cron.job WHERE active = true ORDER BY auth_source, jobname;
```

If the GUC is null, the audit query will show the GUC-using crons as broken; cross-reference against edge-function logs for 401s on the matching function names.

## Active jobs (snapshot 2026-05-07)

### Edge-function-targeting jobs (most have v1 + v2 variants)

| Function invoked | v1 (legacy) | v2 (current) | Schedule |
|---|---|---|---|
| `automation-executor` | run-automation-executor-5m (`*/5 * * * *`, BROKEN — placeholder URL `your-project`, app GUC ref) | process-automation-triggers, process-automation-triggers-v2 (`* * * * *`) | every minute |
| `process-automation-outbox` | process-automation-outbox (hardcoded JWT) | process-automation-outbox-v2 (supabase GUC) | every minute |
| `queue-worker` | (none) | queue-worker-scheduler (supabase GUC) | every minute |
| `process-email-send-queue` | (none) | process-email-send-queue (supabase GUC) | every minute |
| `auto-send-campaigns` | (none) | auto-send-campaigns (supabase GUC) | every minute |
| `vmx-backfill-runner` | (none) | vmx-backfill-every-minute (supabase GUC) | every minute |
| `vmx-sync-all` | (none) | vmx-sync-all-every-15min (supabase GUC) | every 15 min |
| `domain-verify-cron` | (none) | domain-verify-cron-2m (supabase GUC) | every 2 min |
| `auto-generate-weekly-campaigns` | (none) | auto-generate-weekly-campaigns | Mon 16:00 UTC |
| `send-daily-digest` | (none) | daily-digest | 16:00 UTC daily |
| `insights-worker` | (none) | insights-worker-scheduler | 02:00 UTC daily |
| `send-monthly-performance` | (none) | monthly-performance-queue | 1st 17:00 UTC |
| `suppression-checker` | nightly-suppression-checker (hardcoded JWT) | nightly-suppression-checker-v2 (supabase GUC) | 03:00 UTC daily |
| `recompute-all-tenants-segments` | (none) | recompute-all-system-segments-nightly | 03:00 UTC daily |
| `reset-daily-limits` | reset-daily-limits-nightly (hardcoded JWT) | reset-daily-limits-nightly-v2 (supabase GUC) | 04:00 UTC daily |
| `sms-daily-warmup-reset` | sms-daily-warmup-reset (hardcoded JWT) | sms-daily-warmup-reset-v2 (supabase GUC) | 04:00 UTC daily |
| `token-refresh-worker` | token-refresh-worker-daily (hardcoded JWT) | token-refresh-worker-daily-v2 (supabase GUC) | 06:00 UTC daily |
| `watchdog` | watchdog-stuck-content (hardcoded JWT) | (none — should add v2) | every 5 min |
| `send-seasonal-prompt` | (none) | seasonal-* (6 jobs, GUC) | season-specific dates |
| `reconcile-stripe-notion` | reconcile-stripe-notion (no auth) | (none) | 14:00 UTC daily |
| `send-support-emails` | send-support-emails (PLACEHOLDER) | (none — broken from inception) | 15:00 UTC daily |

### SQL-only jobs (no auth needed)

| Job | Schedule | Calls |
|---|---|---|
| campaign-health-check | every 5 min | `public.campaign_health_check()` |
| recompute-recent-campaign-rollups | every 5 min | `public.recompute_recent_campaign_rollups()` |

## Cleanup actions to apply once both GUCs are set

The v1 jobs marked "hardcoded JWT" continue to function but break silently if the JWT is rotated. The v2 variants do the same work via the GUC. After confirming the GUC is healthy, retire the v1 duplicates:

```sql
SELECT cron.unschedule('nightly-suppression-checker');
SELECT cron.unschedule('process-automation-outbox');
SELECT cron.unschedule('process-automation-triggers');     -- duplicates v2 + has placeholder URL
SELECT cron.unschedule('reset-daily-limits-nightly');
SELECT cron.unschedule('sms-daily-warmup-reset');
SELECT cron.unschedule('token-refresh-worker-daily');
SELECT cron.unschedule('run-automation-executor-5m');      -- placeholder URL `your-project`
```

The `watchdog-stuck-content` v1 has no v2 equivalent; reschedule it on the GUC pattern instead of dropping:

```sql
SELECT cron.unschedule('watchdog-stuck-content');
SELECT cron.schedule(
  'watchdog-stuck-content',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/watchdog',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
       ),
       body := '{}'::jsonb
     ) $$
);
```

`send-support-emails` (literal `YOUR_SERVICE_ROLE_KEY` placeholder, broken from inception) — reschedule with the GUC pattern:

```sql
SELECT cron.unschedule('send-support-emails');
SELECT cron.schedule(
  'send-support-emails',
  '0 15 * * *',
  $$ SELECT net.http_post(
       url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/send-support-emails',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
       )
     ) $$
);
```

These are NOT applied in this commit — the GUC must be set first, otherwise the rewrite turns currently-working v1 crons (hardcoded JWT) into v2-style crons that 401 with empty bearer.

## Root cause for the 2026-05-07 outage (Step 8 finding)

Both `app.service_role_key` and `supabase.service_role_key` were NULL at the database level. The `run-automation-executor-5m` cron has 4,032 runs over the last 14 days with **0 successes**, suggesting the GUCs have been unset for at least that long — possibly since project inception. No migration sets either GUC (correctly, since committing the JWT would expose it). The value must be set manually via `ALTER DATABASE` in the Supabase SQL editor, and after any project clone or `pg_dump`-based restore.

Mitigation in place: this doc, plus the `watchdog_stuck_pos_sync_jobs` migration shipped today which auto-recovers stuck POS sync jobs even when cron auth is degraded.

Strongest hypothesis for "why now": the GUCs may have never been set on this project and the v1 hardcoded-JWT crons were sufficient to keep the platform's most-critical paths (queue worker, automation outbox) running until the v2 crons (which depend on the GUC) became the primary path some time ago. Cannot prove definitively without a database event log we don't retain.
