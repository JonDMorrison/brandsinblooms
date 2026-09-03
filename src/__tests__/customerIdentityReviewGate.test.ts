import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903165403_customer_identity_review_queue.sql",
  "utf8",
);
const dialog = readFileSync(
  "src/components/crm/customers/CustomerMergeReviewDialog.tsx",
  "utf8",
);
const customerPage = readFileSync("src/pages/crm/CRMCustomersPage.tsx", "utf8");

describe("customer identity review release gate", () => {
  it("detects normalized email and phone collisions without auto-merging", () => {
    expect(migration).toContain(
      "public.normalize_customer_email(customer.email)",
    );
    expect(migration).toContain(
      "public.normalize_customer_phone(customer.phone)",
    );
    expect(migration).toContain(
      "SELECT public.seed_historical_customer_merge_suggestions(NULL, 50000)",
    );
    expect(migration).not.toMatch(
      /SELECT public\.resolve_customer_merge_review\s*\(/,
    );
  });

  it("keeps review owner-only and removes direct candidate-table access", () => {
    expect(migration.match(/v_access->>'role' <> 'owner_admin'/g)?.length).toBe(
      3,
    );
    expect(migration).toContain(
      "REVOKE SELECT ON public.crm_customer_merge_suggestions FROM authenticated",
    );
    expect(migration).not.toMatch(/GRANT EXECUTE[^;]+TO anon/);
    expect(
      migration.match(/SET search_path = ''/g)?.length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("delegates explicit merges to the audited fail-closed engines", () => {
    expect(migration).toContain(
      "public.merge_external_provider_customer_suggestion(",
    );
    expect(migration).toContain("public.merge_crm_customers(");
    expect(migration).toContain(
      "v_remaining := array_remove(v_suggestion.candidate_customer_ids",
    );
    expect(migration).toContain("'mergeHistoryIds', v_history_ids");
  });

  it("shows identity, consent, purchase, messaging, and loyalty evidence", () => {
    expect(dialog).toContain('"get_customer_merge_review_queue"');
    expect(dialog).toContain('"scan_current_tenant_customer_duplicates"');
    expect(dialog).toContain('"resolve_customer_merge_review"');
    expect(dialog).toContain("Matching email");
    expect(dialog).toContain("Matching mobile");
    expect(dialog).toContain("candidate.posOrders");
    expect(dialog).toContain("candidate.emailSends");
    expect(dialog).toContain("candidate.smsMessages");
    expect(dialog).toContain("candidate.loyaltyEntries");
    expect(dialog).toContain("candidate.identityLinks");
  });

  it("only offers duplicate review to owners in the customer catalog", () => {
    expect(customerPage).toContain('crmRole === "owner_admin"');
    expect(customerPage).toContain("Review Duplicate Customers");
    expect(customerPage).toContain("<CustomerMergeReviewDialog");
  });
});
