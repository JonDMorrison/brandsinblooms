# Phase 3: Form Automation Observability

This document describes the observability infrastructure for form-triggered automations.

## Logging Schema

### Table: `form_automation_executions`

Every automation execution is logged with comprehensive details for debugging and support.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant reference |
| `automation_id` | UUID | Which automation was executed |
| `automation_run_id` | UUID | The specific run instance |
| `submission_id` | UUID | Form submission that triggered this |
| `customer_id` | UUID | Customer involved (nullable) |
| `status` | TEXT | `queued`, `running`, `completed`, `failed`, `skipped` |
| `step_type` | TEXT | `email`, `notification`, `delay` |
| `step_index` | INTEGER | Position in workflow |
| `executed_at` | TIMESTAMPTZ | When this log was created |
| `failure_reason` | TEXT | Human-readable failure cause |
| `error_details` | JSONB | Technical error information |
| `retry_count` | INTEGER | Number of retry attempts |
| `max_retries` | INTEGER | Maximum allowed retries (default: 3) |
| `trigger_event_id` | UUID | Original trigger event |
| `node_id` | TEXT | Workflow node identifier |
| `recipient` | TEXT | Email/phone that received message |
| `metadata` | JSONB | Additional context |

## Example Execution Records

### Successful Email Send

```json
{
  "id": "exec-001",
  "tenant_id": "tenant-abc",
  "automation_id": "auto-welcome",
  "automation_run_id": "run-123",
  "submission_id": "sub-456",
  "customer_id": "cust-789",
  "status": "completed",
  "step_type": "email",
  "step_index": 0,
  "executed_at": "2026-01-28T20:15:00Z",
  "failure_reason": null,
  "node_id": "node-email-1",
  "recipient": "customer@example.com",
  "metadata": {
    "scheduled_at": "2026-01-28T20:15:00Z"
  }
}
```

### Skipped Due to Opt-Out

```json
{
  "id": "exec-002",
  "tenant_id": "tenant-abc",
  "automation_id": "auto-welcome",
  "automation_run_id": "run-124",
  "submission_id": "sub-457",
  "customer_id": "cust-790",
  "status": "skipped",
  "step_type": "email",
  "step_index": 0,
  "executed_at": "2026-01-28T20:16:00Z",
  "failure_reason": "opt_out",
  "node_id": "node-email-1",
  "recipient": "opted-out@example.com"
}
```

### Failed with Max Retries

```json
{
  "id": "exec-003",
  "tenant_id": "tenant-abc",
  "automation_id": "00000000-0000-0000-0000-000000000000",
  "submission_id": "sub-458",
  "status": "failed",
  "executed_at": "2026-01-28T20:17:00Z",
  "failure_reason": "max_retries_exceeded",
  "error_details": {
    "retry_count": 3,
    "last_error": "Database connection timeout"
  },
  "trigger_event_id": "evt-999"
}
```

## Retry Behavior

### Retry Limits

- **Maximum Retries**: 3 attempts per trigger event
- **Retry Tracking**: `retry_count` column on `automation_trigger_events`
- **Non-Retryable Failures**: Consent issues, missing data, validation errors

### What Gets Retried

| Failure Type | Retries? | Notes |
|--------------|----------|-------|
| Database timeout | ✅ Yes | Transient infrastructure issue |
| Network error | ✅ Yes | Transient infrastructure issue |
| Missing customer email | ❌ No | Data issue, won't change |
| Opt-out/Suppressed | ❌ No | Consent issue, logged as skipped |
| Invalid automation config | ❌ No | Config issue, needs manual fix |

### Retry Escalation

After 3 failed attempts:
1. Event marked as `processed_at` with error message
2. Execution logged with `status: 'failed'`, `failure_reason: 'max_retries_exceeded'`
3. No further automatic processing

## Support Tracing Guide

### Trace a Specific Form Submission

**Question**: "Customer says they submitted a form but didn't get an email"

```sql
-- Find all automation executions for a submission
SELECT 
  fae.status,
  fae.step_type,
  fae.failure_reason,
  fae.error_details,
  fae.recipient,
  fae.executed_at,
  ca.name as automation_name
FROM form_automation_executions fae
LEFT JOIN crm_automations ca ON ca.id = fae.automation_id
WHERE fae.submission_id = 'sub-456'
ORDER BY fae.executed_at;
```

### Find Failed Automations

**Question**: "Are any automations failing?"

```sql
-- Recent failures with details
SELECT 
  fae.automation_id,
  ca.name as automation_name,
  fae.failure_reason,
  fae.error_details,
  COUNT(*) as failure_count,
  MAX(fae.executed_at) as last_failure
FROM form_automation_executions fae
LEFT JOIN crm_automations ca ON ca.id = fae.automation_id
WHERE fae.status = 'failed'
  AND fae.executed_at > NOW() - INTERVAL '24 hours'
GROUP BY fae.automation_id, ca.name, fae.failure_reason, fae.error_details
ORDER BY failure_count DESC;
```

### Trace Automation Performance

**Question**: "How is the welcome email automation performing?"

```sql
-- Execution breakdown by status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN step_type = 'email' THEN 1 END) as emails,
  COUNT(CASE WHEN step_type = 'notification' THEN 1 END) as notifications
FROM form_automation_executions
WHERE automation_id = 'auto-welcome'
  AND executed_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

### Find Stuck/Unprocessed Events

**Question**: "Are there events that haven't been processed?"

```sql
-- Events stuck in retry or unprocessed
SELECT 
  ate.id,
  ate.event_type,
  ate.form_id,
  ate.retry_count,
  ate.error_message,
  ate.created_at,
  ate.last_error_at
FROM automation_trigger_events ate
WHERE ate.processed_at IS NULL
  AND ate.created_at < NOW() - INTERVAL '1 hour'
ORDER BY ate.created_at;
```

### Consent Skip Analysis

**Question**: "Why are emails being skipped?"

```sql
-- Breakdown of skip reasons
SELECT 
  failure_reason,
  COUNT(*) as skip_count
FROM form_automation_executions
WHERE status = 'skipped'
  AND executed_at > NOW() - INTERVAL '30 days'
GROUP BY failure_reason
ORDER BY skip_count DESC;
```

## Indexes for Query Performance

The following indexes are created for efficient querying:

| Index | Purpose |
|-------|---------|
| `idx_form_auto_exec_submission` | Query by submission_id |
| `idx_form_auto_exec_automation` | Query by automation_id |
| `idx_form_auto_exec_status` | Query failed/running executions |
| `idx_form_auto_exec_tenant_time` | Dashboard queries by tenant |
| `idx_form_auto_exec_retry_queue` | Retry queue processing |

## Monitoring Recommendations

### Key Metrics to Track

1. **Failure Rate**: `COUNT(status='failed') / COUNT(*)` per hour
2. **Skip Rate**: `COUNT(status='skipped') / COUNT(*)` - high rates may indicate consent issues
3. **Queue Depth**: Unprocessed trigger events older than 5 minutes
4. **Retry Exhaustion**: Events hitting max_retries per day

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Failure Rate | > 5% | > 15% |
| Unprocessed Events (>5min) | > 10 | > 50 |
| Max Retries Exhausted/day | > 5 | > 20 |

## RLS Policies

The `form_automation_executions` table has Row Level Security enabled:

- Users can only view execution logs for their own tenant
- Service role has full access for edge functions
