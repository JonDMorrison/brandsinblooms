

## Refactor: Payment-Based Triggers Instead of Order-Based

### What Changes

Replace `order.created` with `payment.created` and `payment.updated` as the triggers for "Any Purchase Made" automations, and ensure "First Purchase" also resolves from these payment events.

### Logic

- **`payment.created`**: Square fires this when a payment is initiated (status = APPROVED). We process it, match the customer, and fire the `payment.completed` trigger (which represents "Any Purchase Made" in the UI). Also resolve `first_purchase` if applicable.
- **`payment.updated`**: Square fires this when a payment transitions (e.g., APPROVED to COMPLETED). We process it **only if status = COMPLETED** to avoid double-triggering. An idempotency check ensures the same payment ID doesn't fire triggers twice.
- **`invoice.payment_made`**: Also handled -- the invoice payload includes `primary_recipient` with `customer_id`, email, and phone for matching.

### Detailed Changes

**1. `supabase/functions/square-webhook-handler/index.ts`**

- **Remove** `processOrderCreated` function entirely (lines 150-255)
- **Remove** the `case 'order.created'` from the switch (line 637-638)
- **Rename** `processPaymentCompleted` to `processPaymentEvent` and update it to:
  - Accept the raw `data.object` which contains `{ payment: {...} }`
  - Extract payment status and only fire triggers when status is `COMPLETED` (for `payment.updated`) or always for `payment.created` with COMPLETED status
  - Add idempotency: before firing triggers, check if this `payment.id` was already processed by looking up `pos_orders` with that external_id and a flag
  - Keep the existing 4-strategy customer matching (square_customer_id, email, phone, Square API lookup)
- **Add** `processInvoicePaymentMade` function to handle `invoice.payment_made` events using `primary_recipient` data
- **Update switch statement**:
  - `case 'payment.created':` and `case 'payment.updated':` both call `processPaymentEvent`
  - `case 'invoice.payment_made':` calls `processInvoicePaymentMade`
- **Trigger names fired**: `payment.completed` (the "Any Purchase Made" trigger) and conditionally `first_purchase`

**2. `supabase/functions/_shared/webhooks/types.ts`**

- Remove `order.created` from `AUTOMATION_TRIGGER_EVENTS`
- Ensure `payment.completed` and `first_purchase` remain

**3. `src/config/automationEvents.ts`**

- Remove the `order.created` entry
- Keep `payment.completed` renamed to label "Any Purchase Made"

**4. `src/lib/triggerCatalog.ts`**

- Remove the `order.created` trigger entry
- Update `payment.completed` label to "Any Purchase Made" with description "Fires on payment.created or payment.updated (COMPLETED)"

**5. `supabase/functions/automation-executor/index.ts`**

- Remove any references to `order.created` trigger type

### Idempotency Strategy

When `payment.created` arrives with status APPROVED, we record the payment in `pos_orders`. When `payment.updated` arrives with status COMPLETED for the same payment ID, we check if triggers were already fired for that payment (via a `webhook_triggers_fired` flag in `pos_orders.raw_data` or by checking `automation_events`). This prevents double-triggering when both events arrive for the same payment.

### Payment Event Flow

```text
Square sends payment.created (status=APPROVED)
  --> Record in pos_orders
  --> Do NOT fire triggers yet (not completed)

Square sends payment.updated (status=COMPLETED)  
  --> Update pos_orders
  --> Match customer (4 strategies)
  --> Fire "payment.completed" + maybe "first_purchase"
  --> Mark as triggers_fired

Square sends invoice.payment_made (status=PAID)
  --> Match customer via primary_recipient
  --> Fire "payment.completed" + maybe "first_purchase"
```

Only COMPLETED/PAID status fires the automation triggers, avoiding premature triggers on authorized-but-not-captured payments.

