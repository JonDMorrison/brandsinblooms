import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261105051655_crm_selected_tenant_catalog_reads.sql",
  "utf8",
);

describe("selected-tenant catalogue read policies", () => {
  it("adds only SELECT policies for the three existing catalog tables", () => {
    expect(migration.match(/CREATE POLICY /g)).toHaveLength(3);
    expect(migration.match(/FOR SELECT/g)).toHaveLength(3);
    expect(migration.match(/TO authenticated/g)).toHaveLength(3);
    expect(migration).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/);
    expect(migration).not.toMatch(/GRANT|CREATE ROLE|SECURITY DEFINER|ALTER TABLE|DROP POLICY/);
  });

  it("requires canonical per-tenant permissions for SMS and contact reads", () => {
    expect(migration).toContain("'campaign.read'");
    expect(migration.match(/'customer.read'/g)).toHaveLength(2);
    expect(migration.match(/public.has_tenant_permission/g)).toHaveLength(3);
    expect(migration).toContain("tenant_id IS NOT NULL");
  });

  it("validates that tag and contact belong to the same tenant", () => {
    expect(migration).toContain("tag.tenant_id = contact.tenant_id");
    expect(migration).toContain("contact.id = customer_tags.contact_id");
    expect(migration).toContain("tag.id = customer_tags.tag_id");
  });
});
