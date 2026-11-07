import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261107011102_enterprise_bloom_support_reliability_v2.sql",
  "utf8",
);
const migrationName =
  "20261107011102_enterprise_bloom_support_reliability_v2.sql";

describe("Bloom Support CRM identity aliases", () => {
  it("resolves an explicitly linked auth identity before it can create a client principal", () => {
    const fn = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION bloom_support.resolve_crm_user"),
      migration.indexOf("REVOKE ALL ON FUNCTION bloom_support.resolve_crm_user"),
    );
    expect(fn).toContain("principal_auth_identities identity");
    expect(fn.indexOf("principal_auth_identities identity")).toBeLessThan(
      fn.indexOf("INSERT INTO bloom_support.principals"),
    );
    expect(fn).toContain("AND principal.active");
    expect(fn).toContain("ELSIF matched_alias THEN");
    const aliasBranch = fn.slice(fn.indexOf("ELSIF matched_alias THEN"), fn.indexOf("ELSE", fn.indexOf("ELSIF matched_alias THEN")));
    expect(aliasBranch).not.toContain("SET email");
  });

  it("links only Jon's exact verified login to the existing administrator", () => {
    expect(migration).toContain("lower(email) = 'jon@getclear.ca'");
    expect(migration).toContain("lower(email) = 'jon@brandsinblooms.com'");
    expect(migration).toContain("duplicate_role <> 'client'");
    expect(migration).toContain("principal.auth_alias_linked");
    expect(migration).not.toContain("@brandsinblooms.com%'");
    expect(migration).not.toMatch(/email_domains[\s\S]{0,100}platform_admin/);
  });

  it("replays the reliability migration in both disposable database suites", () => {
    for (const fixture of [
      "scripts/tests/bloom-support-db.sql",
      "scripts/tests/bloom-support-e2e-setup.sql",
    ]) {
      expect(readFileSync(fixture, "utf8")).toContain(migrationName);
    }
  });
});
