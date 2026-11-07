# Stripe / Notion reconciliation

The scheduled job reads all Stripe subscriptions and invoices and the complete Notion pipeline. It never creates, merges or changes customer pages, dates, subscriptions or invoices. Exact Stripe IDs or reviewed mappings identify accounts; email-only candidates require review. Product tenant IDs are separate from billing IDs.

`stripe_notion_customer_links` contains reviewed account/mode/customer-to-page mappings and separate CMS and CRM identifiers. Both it and `stripe_notion_reconciliation_state` are service-role-only with RLS enabled. Do not commit customer mapping data to this public repository.

`reconcile_stripe_notion_snapshot` atomically updates one issue per account/mode/customer/type, journals changed issues in the existing history table, and retains resolved state. Notifications are sent on transitions; a delivery failure leaves the transition pending. Resend idempotency keys avoid duplicate delivery on retries. An incomplete API response aborts before any queue write.

Active subscriptions and invoice settlement are evaluated separately. Old cancelled subscriptions cannot churn an account with a continuing subscription. Even when all subscriptions end, the result is a review item, never an automatic customer-stage change.

Deployment order: apply the two stripe_notion migrations, deploy reconcile-stripe-notion, and configure the existing cron command to supply the service-role key from Vault in the apikey header. Preserve the existing schedule. No secret values should appear in migrations or logs.

Authenticated `?dry_run=true` returns the full assessment without changing queue state or sending email. Normal runs update the queue and notify the existing system recipients. Validate the dry-run output before enabling a revised job.

Validation: `node --test tests/reconciliation/*.test.mjs`; `deno check --no-config supabase/functions/reconcile-stripe-notion/index.ts`. Database replay, resolution and reopen behavior was tested in a rolled-back transaction.
