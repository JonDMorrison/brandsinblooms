
# Fix: Scheduled Campaign Not Sending

## Problem Summary
Christine's newsletter "Farmers Market this Saturday!" scheduled for 7:30 AM EST (12:30 UTC) has not been sent. Investigation revealed a **database constraint violation** preventing the campaign sending pipeline from processing any scheduled campaigns.

## Root Cause
The `crm_campaigns` table has a CHECK constraint that only allows these status values:
- `draft`
- `scheduled`  
- `sent`

However, the campaign sending pipeline attempts to use:
- `sending` (when claiming a campaign for processing)
- `failed` (when an error occurs)

When the `auto-send-campaigns` cron job runs, it calls the `claim_scheduled_campaigns` database function which tries to set `status = 'sending'`. This violates the constraint and causes the entire operation to fail silently.

## Solution

### Step 1: Update Database Constraint
Modify the CHECK constraint to allow all necessary status values:

```sql
-- Drop the existing constraint
ALTER TABLE crm_campaigns 
DROP CONSTRAINT crm_campaigns_status_check;

-- Add updated constraint with all valid statuses
ALTER TABLE crm_campaigns 
ADD CONSTRAINT crm_campaigns_status_check 
CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed'));
```

### Step 2: Verify and Manually Trigger
After the constraint is updated:
1. Manually invoke the `auto-send-campaigns` edge function to process the pending campaign
2. Verify the campaign status changes to `sent`
3. Confirm Christine receives the email

## Technical Details

| Item | Value |
|------|-------|
| Campaign ID | `0745c22f-6396-47e5-b66f-904d334a4aeb` |
| Campaign Name | Farmers Market this Saturday! |
| Tenant | Down to Earth Garden Center |
| Scheduled At | 2026-02-04 12:30:00 UTC |
| Current Status | `scheduled` (stuck) |
| Error | CHECK constraint violation on status column |

## Files That Reference Campaign Status

The following edge functions use the `sending` or `failed` status values and will work correctly after the constraint is updated:
- `auto-send-campaigns/index.ts` - Sets status to `sending` during claim, `sent` or `failed` after processing
- `claim_scheduled_campaigns` RPC - Sets status to `sending` atomically

## Expected Outcome
After implementing this fix:
1. The stuck campaign will be sent immediately (or on next cron cycle)
2. All future scheduled campaigns will process correctly
3. Failed campaigns will be properly marked with `failed` status for debugging

## Impact Assessment
- **Risk**: Low - only adds valid status values to an existing constraint
- **Downtime**: None - ALTER TABLE operations on CHECK constraints are fast
- **Rollback**: Can revert constraint if needed (though not recommended)
