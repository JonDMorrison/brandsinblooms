import { describe, expect, it } from "vitest";
import {
  CRM_ROLES,
  CRM_ROLE_LABELS,
  CRM_ROLE_DESCRIPTIONS,
  normalizeCrmAccess,
  canQueueCampaignForTenant,
} from "@/lib/auth/crmAccess";

describe("Mike at Arts specialist CRM role contracts", () => {
  it("exposes the designer, list manager and sender as distinct roles", () => {
    expect(CRM_ROLES).toEqual(expect.arrayContaining(["owner_admin", "marketing", "designer", "list_manager", "sender"]));
    expect(new Set(["designer", "list_manager", "sender"].map(role => CRM_ROLE_LABELS[role as keyof typeof CRM_ROLE_LABELS])).size).toBe(3);
    expect(CRM_ROLE_DESCRIPTIONS.designer).toMatch(/cannot send/i);
    expect(CRM_ROLE_DESCRIPTIONS.list_manager).toMatch(/cannot send/i);
    expect(CRM_ROLE_DESCRIPTIONS.sender).toMatch(/cannot manage customer lists/i);
  });

  it("does not accept unrecognized role or permission claims", () => {
    const access = normalizeCrmAccess({
      tenantId: "tenant-one",
      role: "designer",
      locationIds: ["store-one", "store-one"],
      permissions: ["campaigns.read", "campaigns.write", "content.design", "not-a-permission"],
    });
    expect(access.role).toBe("designer");
    expect(access.locationIds).toEqual(["store-one"]);
    expect(access.permissions).toEqual(["campaigns.read", "campaigns.write", "content.design"]);
    expect(normalizeCrmAccess({ role: "custom_superuser", permissions: ["access.manage"] }).role).toBeNull();
  });
  it("requires both an explicitly authorized sender role and a matching tenant", () => {
    const access = (role: string, permissions: string[]) => ({
      tenantId: "arts-nursery",
      role,
      locationIds: [],
      permissions,
    });
    expect(canQueueCampaignForTenant(access("sender", ["campaigns.send"]), "arts-nursery")).toBe(true);
    expect(canQueueCampaignForTenant(access("marketing", ["campaigns.send"]), "arts-nursery")).toBe(true);
    expect(canQueueCampaignForTenant(access("owner_admin", ["campaigns.send"]), "arts-nursery")).toBe(true);
    expect(canQueueCampaignForTenant(access("designer", ["campaigns.send"]), "arts-nursery")).toBe(false);
    expect(canQueueCampaignForTenant(access("list_manager", ["campaigns.send"]), "arts-nursery")).toBe(false);
    expect(canQueueCampaignForTenant(access("sender", []), "arts-nursery")).toBe(false);
    expect(canQueueCampaignForTenant(access("sender", ["campaigns.send"]), "other-tenant")).toBe(false);
    expect(canQueueCampaignForTenant(null, "arts-nursery")).toBe(false);
  });

});
