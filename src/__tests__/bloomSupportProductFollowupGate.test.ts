import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const intake = readFileSync("supabase/functions/bloom-support-intake/index.ts", "utf8");
const runtime = readFileSync("supabase/functions/_shared/bloom-support/runtime.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261107011102_enterprise_bloom_support_reliability_v2.sql",
  "utf8",
);

describe("signed product same-thread support follow-up", () => {
  it("requires the number/action pair and a durable idempotency key", () => {
    expect(intake).toContain("append_to_ticket_number and client_action are required together");
    expect(intake).toContain('clientAction !== "still_needs_help"');
    expect(intake).toContain('clientAction !== "confirm_resolved"');
    expect(intake).toContain("An idempotency_key is required for a ticket follow-up");
    expect(intake).toContain("productClientAction<Record<string, unknown>>");
    expect(runtime).toContain('db().rpc("bloom_support_product_client_action"');
  });

  it("authorizes the signed principal, account and product without leaking ticket numbers", () => {
    const fn = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION bloom_support.product_client_action"),
      migration.indexOf("REVOKE ALL ON FUNCTION bloom_support.product_client_action"),
    );
    expect(fn).toContain("actor.kind <> 'external_user'");
    expect(fn).toContain("actor.product IS DISTINCT FROM p_product");
    expect(fn).toContain("member.principal_id = p_actor");
    expect(fn).toContain("AND product = p_product");
    expect(fn).toContain("AND account_id = p_account");
    expect(fn).toContain("RAISE EXCEPTION 'not_found: ticket'");
  });

  it("appends once through the normal client-message path before applying the action", () => {
    const fn = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION bloom_support.product_client_action"),
      migration.indexOf("REVOKE ALL ON FUNCTION bloom_support.product_client_action"),
    );
    expect(fn).toContain("product_client_action_receipts");
    expect(fn).toContain("fingerprint IS DISTINCT FROM p_fingerprint");
    expect(fn).toContain("PERFORM bloom_support.add_message");
    expect(fn).toContain("action_result := bloom_support.client_action");
    expect(fn.indexOf("PERFORM bloom_support.add_message")).toBeLessThan(
      fn.indexOf("action_result := bloom_support.client_action"),
    );
    expect(fn).toContain("'duplicate_delivery', false");
    expect(fn).toContain("'{\"duplicate_delivery\":true}'::jsonb");
  });
});
