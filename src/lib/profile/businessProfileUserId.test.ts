import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, getSession, memberTenant } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
  memberTenant: { current: null as string | null },
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: { tenant_id: memberTenant.current }, error: null }),
  };
  return { supabase: { rpc, auth: { getSession }, from: () => chain } };
});

import {
  clearBusinessProfileUserIdCache,
  getBusinessProfileUserId,
  getTenantBusinessProfileUserId,
  notifyBusinessProfileChanged,
  subscribeBusinessProfileChanged,
} from "@/lib/profile/businessProfileUserId";
import { resolveBusinessProfileUserId } from "../../../supabase/functions/_shared/businessProfileUserId.ts";

const signedInAs = (id: string) =>
  getSession.mockResolvedValue({ data: { session: { user: { id } } } });

describe("getBusinessProfileUserId", () => {
  beforeEach(() => {
    clearBusinessProfileUserIdCache();
    rpc.mockReset();
    getSession.mockReset();
  });

  it("returns the business owner's id for a teammate", async () => {
    signedInAs("teammate");
    rpc.mockResolvedValue({ data: "owner", error: null });

    await expect(getBusinessProfileUserId("teammate")).resolves.toBe("owner");
    expect(rpc).toHaveBeenCalledWith("current_profile_user_id");
  });

  it("returns the user's own id for a single-user business", async () => {
    signedInAs("owner");
    rpc.mockResolvedValue({ data: "owner", error: null });

    await expect(getBusinessProfileUserId("owner")).resolves.toBe("owner");
  });

  it("resolves once per user", async () => {
    signedInAs("teammate");
    rpc.mockResolvedValue({ data: "owner", error: null });

    await getBusinessProfileUserId("teammate");
    await getBusinessProfileUserId("teammate");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("falls back to the given id when the lookup fails, and retries later", async () => {
    signedInAs("teammate");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    rpc.mockResolvedValueOnce({ data: "owner", error: null });

    await expect(getBusinessProfileUserId("teammate")).resolves.toBe("teammate");
    await expect(getBusinessProfileUserId("teammate")).resolves.toBe("owner");
  });

  it("uses any id other than the signed-in user's as given", async () => {
    signedInAs("admin");

    await expect(getBusinessProfileUserId("someone-else")).resolves.toBe("someone-else");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("getTenantBusinessProfileUserId", () => {
  beforeEach(() => {
    clearBusinessProfileUserIdCache();
    rpc.mockReset();
    getSession.mockReset();
  });

  it("uses the active tenant's profile for an admin working in another tenant, never their own", async () => {
    signedInAs("admin");
    memberTenant.current = "admin-home";
    rpc.mockResolvedValue({ data: "northfield-owner", error: null });

    await expect(getTenantBusinessProfileUserId("admin", "northfield")).resolves.toBe("northfield-owner");
    expect(rpc).toHaveBeenCalledWith("tenant_profile_user_id", { p_tenant_id: "northfield" });
  });

  it("returns null rather than the admin's own profile when the tenant lookup fails", async () => {
    signedInAs("admin");
    memberTenant.current = "admin-home";
    rpc.mockResolvedValue({ data: null, error: { message: "missing function" } });

    await expect(getTenantBusinessProfileUserId("admin", "northfield")).resolves.toBeNull();
  });

  it("uses the business profile resolution in the user's own tenant", async () => {
    signedInAs("teammate");
    memberTenant.current = "northfield";
    rpc.mockResolvedValue({ data: "owner", error: null });

    await expect(getTenantBusinessProfileUserId("teammate", "northfield")).resolves.toBe("owner");
    expect(rpc).toHaveBeenCalledWith("current_profile_user_id");
  });
});

describe("business profile change notifications", () => {
  beforeEach(() => {
    clearBusinessProfileUserIdCache();
    rpc.mockReset();
    getSession.mockReset();
  });

  it("forgets a tenant cached as having no profile, so readers find the new row", async () => {
    signedInAs("admin");
    memberTenant.current = "admin-home";
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(getTenantBusinessProfileUserId("admin", "client")).resolves.toBeNull();
    // Cached: no second lookup.
    await expect(getTenantBusinessProfileUserId("admin", "client")).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);

    notifyBusinessProfileChanged({ tenantId: "client", profileUserId: "client-owner" });

    rpc.mockResolvedValueOnce({ data: "client-owner", error: null });
    await expect(getTenantBusinessProfileUserId("admin", "client")).resolves.toBe("client-owner");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("tells listeners in this tab, and stops after unsubscribing", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBusinessProfileChanged(listener);

    notifyBusinessProfileChanged({ tenantId: "client", profileUserId: "client-owner" });
    expect(listener).toHaveBeenCalledWith({ tenantId: "client", profileUserId: "client-owner" });

    unsubscribe();
    notifyBusinessProfileChanged({ tenantId: "client", profileUserId: "client-owner" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tells listeners in other tabs (the editor's settings link opens a new tab)", async () => {
    if (typeof BroadcastChannel === "undefined") return;
    const listener = vi.fn();
    const unsubscribe = subscribeBusinessProfileChanged(listener);

    // Simulate another tab posting on the shared channel.
    const otherTab = new BroadcastChannel("bloomsuite-business-profile");
    otherTab.postMessage({
      source: "other-tab",
      change: { tenantId: "client", profileUserId: "client-owner" },
    });

    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith({ tenantId: "client", profileUserId: "client-owner" }),
    );
    otherTab.close();
    unsubscribe();
  });

  it("runs a same-tab listener once per save", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBusinessProfileChanged(listener);

    notifyBusinessProfileChanged({ tenantId: "client", profileUserId: "client-owner" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("resolveBusinessProfileUserId (edge functions)", () => {
  it("returns the resolved id", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: "owner", error: null }) };

    await expect(resolveBusinessProfileUserId(client, "teammate")).resolves.toBe("owner");
    expect(client.rpc).toHaveBeenCalledWith("profile_user_id_for", { p_user_id: "teammate" });
  });

  it("falls back to the given id on error or a thrown call", async () => {
    const failing = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } }) };
    const throwing = { rpc: vi.fn().mockRejectedValue(new Error("network")) };

    await expect(resolveBusinessProfileUserId(failing, "u1")).resolves.toBe("u1");
    await expect(resolveBusinessProfileUserId(throwing, "u2")).resolves.toBe("u2");
  });
});
