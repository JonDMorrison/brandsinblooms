import { describe, expect, it } from "vitest";

import {
  cacheGet,
  cacheInvalidate,
  cacheSet,
} from "../../supabase/functions/bloom-assist/cache";
import { validateTenantIsolation } from "../../supabase/functions/bloom-assist/security/tenant-isolation";
import type { ToolResult } from "../../supabase/functions/bloom-assist/tools/types";

const result = (data: ToolResult["data"]): ToolResult => ({
  success: true,
  data,
  count: Array.isArray(data) ? data.length : 1,
  message: "ok",
  error: null,
  block_type: "data_table",
  confirmation_required: false,
  confirmation_details: null,
});

describe("Bloom tool cache scope", () => {
  it("never hands one user's cached result to another user in the same tenant", () => {
    const ownerView = result([{ id: "c1", name: "Every location" }]);
    cacheSet("tenant-a", "owner", "query_customers", { limit: 10 }, ownerView);

    expect(cacheGet("tenant-a", "owner", "query_customers", { limit: 10 })).toEqual(ownerView);
    expect(cacheGet("tenant-a", "store-manager", "query_customers", { limit: 10 })).toBeNull();
    expect(cacheGet("tenant-b", "owner", "query_customers", { limit: 10 })).toBeNull();
  });

  it("does not cache without a user", () => {
    cacheSet("tenant-a", "", "query_products", {}, result([{ id: "p1" }]));
    expect(cacheGet("tenant-a", "", "query_products", {})).toBeNull();
  });

  it("clears every user's entries when anyone in the tenant changes that entity", () => {
    cacheSet("tenant-c", "user-1", "query_customers", {}, result([{ id: "c1" }]));
    cacheSet("tenant-c", "user-2", "query_customers", {}, result([{ id: "c1" }]));
    cacheSet("tenant-c", "user-1", "query_products", {}, result([{ id: "p1" }]));

    cacheInvalidate("tenant-c", "customer");

    expect(cacheGet("tenant-c", "user-1", "query_customers", {})).toBeNull();
    expect(cacheGet("tenant-c", "user-2", "query_customers", {})).toBeNull();
    expect(cacheGet("tenant-c", "user-1", "query_products", {})).not.toBeNull();
  });
});

describe("Bloom tool result tenant check", () => {
  it("catches a foreign row that is not the first row", () => {
    const check = validateTenantIsolation(
      result([
        { id: "c1", tenant_id: "tenant-a" },
        { id: "c2", tenant_id: "tenant-b" },
      ]),
      "tenant-a",
    );
    expect(check.valid).toBe(false);
    expect(check.violationDetails).toContain("tenant-b");
  });

  it("accepts results whose rows all belong to the tenant, or carry no tenant column", () => {
    expect(
      validateTenantIsolation(result([{ tenant_id: "tenant-a" }, { tenant_id: "tenant-a" }]), "tenant-a").valid,
    ).toBe(true);
    expect(validateTenantIsolation(result([{ name: "aggregate" }]), "tenant-a").valid).toBe(true);
    expect(validateTenantIsolation(result({ tenant_id: "tenant-a", total: 3 }), "tenant-a").valid).toBe(true);
  });
});
