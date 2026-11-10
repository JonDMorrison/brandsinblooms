import { describe, expect, it } from "vitest";

import type { CrmPermission } from "@/lib/auth/crmAccess";
import {
  filterTenantSidebarGroups,
  getDashboardSidebarGroups,
} from "./sidebarNavigation";

function visibleIds(permissions: CrmPermission[]) {
  const allowed = new Set(permissions);
  return filterTenantSidebarGroups(
    getDashboardSidebarGroups({ mode: "tenant" }),
    (permission) => allowed.has(permission),
  )
    .flatMap((group) => group.items)
    .flatMap((item) =>
      item.kind === "link"
        ? [item.id]
        : item.children.map((child) => child.id),
    );
}

describe("tenant sidebar permissions", () => {
  it("limits staff navigation to customer and loyalty lookup surfaces", () => {
    const items = visibleIds(["customers.read", "loyalty.read"]);

    expect(items).toEqual(
      expect.arrayContaining([
        "dashboard",
        "customers",
        "profile",
        "account",
        "support",
      ]),
    );
    expect(items).not.toEqual(
      expect.arrayContaining([
        "campaigns",
        "automations",
        "segments",
        "integrations",
        "settings",
        "sms-campaigns",
      ]),
    );
  });

  it("shows store managers reporting and campaigns but not company controls", () => {
    const items = visibleIds([
      "customers.read",
      "customers.write",
      "campaigns.read",
      "loyalty.read",
      "loyalty.write",
      "reports.read",
    ]);

    expect(items).toEqual(
      expect.arrayContaining([
        "customers",
        "campaigns",
        "analytics",
        "calendar",
        "products",
      ]),
    );
    expect(items).not.toEqual(
      expect.arrayContaining([
        "integrations",
        "settings",
        "segments",
        "automations",
      ]),
    );
  });

  it("keeps primary CRM destinations visible while removing duplicate editor entry points", () => {
    const workspace = getDashboardSidebarGroups({ mode: "tenant" }).find(
      (group) => group.id === "dashboard",
    );

    expect(workspace?.items.map((item) => item.id)).toEqual([
      "dashboard",
      "campaigns",
      "customers",
      "forms",
      "automations",
      "analytics",
    ]);
    const visible = getDashboardSidebarGroups({ mode: "tenant" })
      .flatMap((group) => group.items)
      .flatMap((item) => item.kind === "link" ? [item.id] : item.children.map((child) => child.id));
    expect(visible).not.toContain("newsletter");
    expect(visible).not.toContain("sms-campaigns");
  });

  it("shows every tenant item when every permission is granted", () => {
    const items = visibleIds([
      "access.manage",
      "customers.read",
      "customers.write",
      "campaigns.read",
      "campaigns.write",
      "campaigns.send",
      "segments.manage",
      "automations.manage",
      "loyalty.read",
      "loyalty.write",
      "reports.read",
      "integrations.manage",
      "content.design",
    ]);

    expect(items).toHaveLength(20);
    expect(items).toEqual(
      expect.arrayContaining(["customer-intelligence", "integrations", "connected-content", "settings", "campaigns", "forms"]),
    );
  });
});
