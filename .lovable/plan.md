

# Fix Build Errors + Un-suppress Christine + Square Webhook Notes

## 1. Fix `process-email-send-queue` import error

**File:** `supabase/functions/process-email-send-queue/index.ts` (line 2)

Change the import from the npm specifier to the esm.sh pattern used by all other edge functions:

```
// FROM:
import { createClient } from "npm:@supabase/supabase-js@2.7.1";

// TO:
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
```

## 2. Fix `ScheduledCampaignBanner.tsx` type error

**File:** `src/components/crm/ScheduledCampaignBanner.tsx` (line 187)

The RPC function name is cast with `as RpcFunctionName`, so TypeScript cannot infer the return type and falls back to a broad union. The fix is to explicitly type-cast `row` before passing it to `setProgress`:

```typescript
const row = Array.isArray(data) ? data[0] : data;
if (row) {
  const typed = row as NonNullable<typeof progress>;
  setProgressError(null);
  setProgress((prev) => (isSameProgress(prev, typed) ? prev : typed));
}
```

## 3. Un-suppress Christine's customer record

Run a database migration to set `suppressed = false` for Christine's CRM record (`id: 4f3d15d7-be9b-4ed9-9fe5-cb8d0c6dffd6`). This ensures she can receive both email and SMS from automations.

## 4. Square Webhook 403 -- User Action Required

The Square webhook subscription is failing with a 403 because the Square app is missing the **"Webhooks (Read/Write)"** OAuth scope. This cannot be fixed in code -- Christine (or an admin) needs to:

1. Go to the **Square Developer Dashboard**
2. Enable the **Webhooks Read/Write** permission on the BloomSuite app
3. Have Christine **re-authorize** the Square connection in BloomSuite (disconnect and reconnect)

After reconnecting, the OAuth callback will automatically attempt to subscribe to webhooks. I will surface a note about this but cannot fix it programmatically.

---

### Technical Details

| Item | File | Change |
|------|------|--------|
| Edge function import | `supabase/functions/process-email-send-queue/index.ts:2` | Switch to `esm.sh` import |
| Type error | `src/components/crm/ScheduledCampaignBanner.tsx:184-188` | Cast `row` to explicit progress type |
| Suppression | Database migration | `UPDATE crm_customers SET suppressed = false WHERE id = '4f3d15d7-...'` |
| Square webhooks | Manual step | Enable OAuth scope in Square Developer Dashboard |

