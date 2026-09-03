import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeCrmAccess } from "./crmAccess";

const migration = readFileSync(
  "supabase/migrations/20260903154054_tenant_crm_role_foundation.sql",
  "utf8",
);
const roleHook = readFileSync("src/hooks/useUserRole.ts", "utf8");

describe("tenant CRM access", () => {
  it("normalizes only known roles, locations, and permissions", () => {
    expect(
      normalizeCrmAccess({
        tenantId: "tenant-1",
        role: "store_manager",
        locationIds: ["north", "north", null],
        permissions: ["customers.read", "root.everything"],
      }),
    ).toEqual({
      tenantId: "tenant-1",
      role: "store_manager",
      locationIds: ["north"],
      permissions: ["customers.read"],
    });
  });

  it("fails closed for an invalid access response", () => {
    expect(
      normalizeCrmAccess({ role: "superuser", permissions: ["*"] }),
    ).toEqual({ tenantId: null, role: null, locationIds: [], permissions: [] });
    expect(normalizeCrmAccess(null).permissions).toEqual([]);
  });

  it("protects role assignment at the database boundary", () => {
    expect(migration).toContain("protect_user_crm_role");
    expect(migration).toContain("Users cannot change their own CRM access");
    expect(migration).toContain("set_tenant_user_crm_access");
    expect(migration).toContain("crm_access_audit");
    expect(migration).toContain("context.active_tenant_id = p_tenant_id");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("FROM PUBLIC, anon");
  });

  it("loads server-backed access instead of granting every user editor rights", () => {
    expect(roleHook).toContain('supabase.rpc("get_current_crm_access")');
    expect(roleHook).not.toContain("const userRole: UserRole = 'editor'");
    expect(roleHook).toContain('hasPermission("content.design")');
  });
});
