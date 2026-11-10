import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const webhook = readFileSync(
  resolve(root, "supabase/functions/square-webhook-handler/index.ts"),
  "utf8",
);
const migration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260904010000_square_automation_event_idempotency.sql",
  ),
  "utf8",
);
const webhookClaimsMigration = readFileSync(
  resolve(root, "supabase/migrations/20260904011000_square_webhook_claims.sql"),
  "utf8",
);

describe("Square webhook identity and automation reliability", () => {
  it("routes every Square customer mutation through the canonical identity ledger", () => {
    expect(webhook).toContain('"resolve_provider_customer_identity"');
    expect(webhook).toContain('"resolve_crm_customer_identity"');
    expect(webhook).toContain("resolveSquareCustomerIdentity(");
    expect(webhook).not.toContain('onConflict: "tenant_id,email"');
    expect(webhook).not.toContain("email_opt_in");
    expect(webhook).not.toContain("calculateSquareCustomerSpend");
  });

  it("links orders to canonical customers before reconciling purchase metrics", () => {
    expect(webhook).toContain("crm_customer_id: customer.id");
    expect(webhook).toContain('"recalculate_purchase_metrics"');
    expect(webhook).toContain("pos_total_spent: metrics.lifetime_value");
    expect(webhook).toContain(
      '.select("id, external_customer_id, crm_customer_id")',
    );
    expect(webhook).toContain("Square order ${orderId} could not be loaded");
    expect(webhook).not.toContain("return response.ok ? data.order : null");
  });

  it("hands one durable event to the automation engine instead of scheduling every step", () => {
    expect(webhook).toContain("source_event_key: sourceEventKey");
    expect(webhook).toContain('source: "square_webhook"');
    expect(webhook).toContain("ignoreDuplicates: true");
    expect(webhook).not.toContain('from("crm_outbox")');
    expect(webhook).not.toContain('from("automation_runs")');
    expect(webhook).not.toContain("fireAutomationTriggers");
  });

  it("enforces provider-event idempotency in Postgres", () => {
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS source_event_key text",
    );
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
    expect(migration).toContain("tenant_id,");
    expect(migration).toContain("automation_id,");
    expect(migration).toContain("source_event_key");
  });

  it("claims each webhook durably and makes failed work retryable", () => {
    expect(webhook).toContain(
      "claimWebhookEvent(supabase, connection, payload)",
    );
    expect(webhook).toContain("status: alreadyProcessing ? 409 : 200");
    expect(webhook).toContain("completeWebhookEvent(supabase, claim.event_id)");
    expect(webhook).toContain("failWebhookEvent(supabase, claim.event_id");
    expect(webhookClaimsMigration).toContain("FOR UPDATE");
    expect(webhookClaimsMigration).toContain("'already_processed'");
    expect(webhookClaimsMigration).toContain("'already_processing'");
    expect(webhookClaimsMigration).toContain(
      "attempt_count = attempt_count + 1",
    );
    expect(webhookClaimsMigration.match(/SET search_path = ''/g)).toHaveLength(
      3,
    );
    expect(
      webhookClaimsMigration.match(/FROM PUBLIC, anon, authenticated/g),
    ).toHaveLength(3);
  });
});
