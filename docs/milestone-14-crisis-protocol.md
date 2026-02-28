# Milestone 14: Crisis Protocol & Production Hardening

## Scope implemented

- Domain-scoped crisis trigger: `investigation_mode` on `email_domains`
- Immediate halt controls: `enter_domain_investigation_mode(...)`
- Recovery controls: `exit_domain_investigation_mode(...)` + `reset_domain_warmup_after_crisis(...)`
- Tenant notifications: queued email notifications for crisis enter/exit
- Action logging:
  - `email_governance_audit_logs`
  - `email_governance_domain_crisis_actions`
  - `crm_activity_events`
  - `admin_audit_log`
- Runtime enforcement:
  - sender resolution rejects investigation-mode domains
  - queue worker pauses campaigns/jobs if domain enters investigation mode

## New database objects

Migration: `supabase/migrations/20260225213000_milestone14_crisis_protocol_production_hardening.sql`

### Added columns

- `email_domains.investigation_mode boolean`
- `email_domains.investigation_mode_at timestamptz`
- `email_domains.investigation_mode_reason text`
- `email_domains.investigation_mode_details jsonb`

### Added tables

- `email_governance_domain_crisis_actions`
- `email_governance_domain_crisis_notifications`

### Added RPCs

- `claim_domain_crisis_notifications(...)`
- `enqueue_domain_crisis_notifications(...)`
- `reset_domain_warmup_after_crisis(...)`
- `enter_domain_investigation_mode(...)`
- `exit_domain_investigation_mode(...)`

### Updated RPCs

- `check_send_quota(...)` now blocks with `reason='domain_under_investigation'` when crisis mode is active.

## Trigger scenarios mapping

- Domain blacklisted externally -> `enter_domain_investigation_mode`
- IP reputation collapse -> `enter_domain_investigation_mode` for impacted domain(s)
- Massive bounce storm -> existing governance can trigger pause; ops can escalate to investigation mode
- Complaint storm -> same as above
- External provider enforcement action -> `enter_domain_investigation_mode`

## Recovery workflow

1. Master admin exits investigation mode:
   - `exit_domain_investigation_mode(p_domain_id, ..., p_reset_warmup := true)`
2. Domain warmup resets to day-1 cap:
   - `status='warming_up'`
   - `warmup_stage=1`
   - `daily_limit=get_warmup_daily_cap_by_stage(1)`
3. Notifications are queued and sent to tenant admins.

## Production hardening checklist status

- No race conditions: improved at control plane by DB-level `FOR UPDATE` and single-RPC state transitions.
- No duplicate webhook corruption: existing idempotency constraints remain in place.
- No infinite retry loops: existing retry + stale claim behavior retained; crisis notifications follow same bounded claim model.
- No batch overflow: existing claim limits retained; crisis mode pauses campaigns/jobs before claiming next work.
- No suppression bypass: existing send-time suppression checks remain unchanged.
- No metric miscalculation: not fully replaced in this milestone; `email-tracking-webhook` still has full-scan metric recompute path.
- Stress tested at 100k: harness added (see below), execution depends on environment.

## 100k load harness

Use the included script:

- `scripts/milestone14-run-webhook-load-100k.sh`

Required env vars:

- `WEBHOOK_URL` (e.g. local edge function endpoint)
- `WEBHOOK_SECRET` (optional, depending on verification mode)

The script generates an Artillery scenario and runs 100k webhook posts with controlled arrival rate.

## Admin API actions

The master-admin edge function supports:

- `enter_domain_investigation`
- `exit_domain_investigation`

through `supabase/functions/admin-manage-tenant/index.ts`.

## Validation SQL snippets

```sql
-- Enter investigation mode
select * from public.enter_domain_investigation_mode(
  p_domain_id := '<domain-uuid>',
  p_reason := 'provider_enforcement_action',
  p_details := '{"provider":"resend","ticket":"INC-1234"}'::jsonb,
  p_admin_user_id := '<master-admin-user-uuid>'
);

-- Verify send quota is blocked
select public.check_send_quota('<tenant-uuid>', '<domain-uuid>', 1000);

-- Exit investigation and reset warmup
select * from public.exit_domain_investigation_mode(
  p_domain_id := '<domain-uuid>',
  p_reason := 'remediation_complete',
  p_details := '{"runbook":"M14-R1"}'::jsonb,
  p_reset_warmup := true,
  p_admin_user_id := '<master-admin-user-uuid>'
);
```
