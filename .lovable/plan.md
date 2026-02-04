

## Reply-To Email Header Implementation Plan

### Current State Analysis

**What already exists:**
- `email_domains` table has a `default_reply_to` column
- `DomainSenderSettings.tsx` already has UI for configuring Reply-To at the domain level
- `send-email-campaign` already fetches and uses `default_reply_to` for campaign emails

**The gaps identified:**
1. **senderResolver.ts** - Does NOT fetch or return `replyTo` from domain settings
2. **send-transactional-email** - Accepts `reply_to` parameter but automation flow doesn't pass it
3. **process-automation-outbox** - Does NOT include `reply_to` when calling transactional email function

---

### Recommended Approach: Centralized Domain-Level Configuration

The **best place** for Reply-To is already in place: the **Email Domain Sender Settings**. Users configure it once per domain, and ALL emails (campaigns + automations) will use it automatically.

**User Flow:**
1. Navigate to Email Settings > Domain Settings
2. Click "Sender Settings" on their verified domain
3. Configure Reply-To Email (already present in UI)
4. All future emails use this Reply-To automatically

---

### Implementation Steps

#### Step 1: Update senderResolver.ts to Include Reply-To
**File:** `supabase/functions/_shared/senderResolver.ts`

- Modify SELECT queries to include `default_reply_to` from `email_domains`
- Populate `replyTo` field in returned `SenderConfig` object

```typescript
// Updated query
.select('id, domain, status, default_from_email, default_from_name, default_reply_to')

// Return with replyTo
return {
  fromEmail: domain.default_from_email || `mail@${domain.domain}`,
  fromName: domain.default_from_name || 'Your Business',
  deliveryMethod: 'custom_domain',
  replyTo: domain.default_reply_to || undefined,  // <-- Add this
  domainId: domain.id,
  domain: domain.domain
};
```

---

#### Step 2: Update send-transactional-email to Use Reply-To
**File:** `supabase/functions/send-transactional-email/index.ts`

The function already accepts `reply_to` in the request body. Verify it's being included in the Resend payload:

```typescript
// Already exists, but ensure it's included
if (reply_to) {
  emailPayload.reply_to = reply_to;
}
```

---

#### Step 3: Update process-automation-outbox to Pass Reply-To
**File:** `supabase/functions/process-automation-outbox/index.ts`

In the `sendEmail` function, pass `replyTo` from `senderConfig` to the transactional email invocation:

```typescript
// Current call (around line 565)
const { data, error } = await supabase.functions.invoke("send-transactional-email", {
  body: {
    to: message.recipient,
    subject: rendered.renderedSubject,
    html_content: rendered.renderedHtml,
    from_name: companyName,
    from_email: senderConfig.fromEmail,
    reply_to: senderConfig.replyTo,  // <-- Add this line
    tags: [...],
  },
});
```

---

#### Step 4: Update send-test-email-v2 for Consistency
**File:** `supabase/functions/send-test-email-v2/index.ts`

Ensure test emails also use the domain's Reply-To setting for consistent behavior:

```typescript
// Use domain reply_to if available, otherwise fallback
const replyTo = senderConfig?.replyTo || companyProfile?.custom_sender_email || user.email;
```

---

### Technical Summary

| Component | Current State | Change Required |
|-----------|--------------|-----------------|
| `email_domains` table | Has `default_reply_to` column | None |
| `DomainSenderSettings.tsx` | Has Reply-To input field | None |
| `useEmailDomainManagement.ts` | Updates `default_reply_to` | None |
| `senderResolver.ts` | Missing `replyTo` in response | Add SELECT + return field |
| `send-email-campaign` | Already uses reply_to | None |
| `send-transactional-email` | Accepts reply_to | None |
| `process-automation-outbox` | Missing reply_to in call | Pass `senderConfig.replyTo` |
| `send-test-email-v2` | Uses fallback | Use domain setting first |

---

### Files to Modify

1. **supabase/functions/_shared/senderResolver.ts** - Add `default_reply_to` to queries and return
2. **supabase/functions/process-automation-outbox/index.ts** - Pass `reply_to` to transactional email
3. **supabase/functions/send-test-email-v2/index.ts** - Prioritize domain reply_to

---

### Benefits of This Approach

1. **Single configuration point** - Users set Reply-To once per domain
2. **Automatic inheritance** - All email types (campaigns, automations, tests) use the same Reply-To
3. **No UI changes needed** - The Reply-To input already exists in Domain Sender Settings
4. **Backward compatible** - If Reply-To is not set, existing behavior continues

