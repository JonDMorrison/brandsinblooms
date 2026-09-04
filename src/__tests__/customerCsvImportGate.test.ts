import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903161724_identity_safe_customer_csv_import.sql",
  "utf8",
);
const importDialog = readFileSync(
  "src/components/crm/segments/EnhancedSegmentImportDialog.tsx",
  "utf8",
);
const csvAnalyzer = readFileSync(
  "supabase/functions/analyze-csv-intelligent/index.ts",
  "utf8",
);

describe("identity-safe customer CSV imports", () => {
  it("uses normalized email and phone identity resolution", () => {
    expect(migration).toContain("public.resolve_crm_customer_identity(");
    expect(migration).toContain("public.normalize_customer_email");
    expect(migration).toContain("public.normalize_customer_phone");
    expect(migration).toContain("Identity is ambiguous");
    expect(migration).toContain("Email and phone identify different customers");
    expect(migration).toContain("'{}'::jsonb");
    expect(migration).toContain("CONTINUE;");
  });

  it("preserves suppression and existing consent when the owner is unsure", () => {
    expect(migration).toContain("public.global_email_suppression_list");
    expect(migration).toContain("v_email_protected");
    expect(migration).toContain("v_attestation_type = 'unsure'");
    expect(migration).toContain(
      "THEN coalesce(v_customer.email_opt_in, false)",
    );
  });

  it("writes consent evidence atomically with each imported customer", () => {
    expect(migration).toContain("public.crm_email_consent_events");
    expect(migration).toContain("public.crm_sms_consent_events");
    expect(migration).toContain("public.customer_consents");
    expect(migration).toContain("p_attestation_id");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("FROM PUBLIC, anon");
  });

  it("routes the UI through the guarded RPC and honors source column indexes", () => {
    expect(importDialog).toContain('"begin_customer_csv_import"');
    expect(importDialog).toContain('"import_crm_customer_batch"');
    expect(importDialog).toContain(
      "row[emailMapping.sourceIndex ?? emailMappingIndex]",
    );
    expect(importDialog).toMatch(
      /if \(!value\) return;\s+if \(fieldKey === "email_opt_in"\)/,
    );
    expect(importDialog).not.toContain('.from("crm_customers").upsert');
    expect(importDialog).not.toContain("recordImportConsentEvents");
  });

  it("keeps the parsed headers authoritative when AI suggestions are incomplete", () => {
    expect(importDialog).toContain("parsed.headers.map");
    expect(importDialog).toContain(
      "candidate.columnIndex === columnIndex",
    );
    expect(importDialog).toContain("csvHeader: header");
    expect(importDialog).toContain("sourceIndex: columnIndex");
    expect(importDialog).toContain(
      "parsed.sampleData[columnIndex].samples",
    );
  });

  it("validates the user session before spending AI quota", () => {
    expect(csvAnalyzer).toContain("supabaseAuth.auth.getUser(token)");
    expect(csvAnalyzer).toContain("Invalid or expired session");
    expect(csvAnalyzer).not.toMatch(
      /if \(!authHeader\)[\s\S]{0,250}const \{ csvRows/,
    );
  });
});
