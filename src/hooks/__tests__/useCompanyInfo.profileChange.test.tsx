import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  getTenantBusinessProfileUserId: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => mocks.maybeSingle(),
  };
  // The footer website reads (tenants, domains, crm_connected_websites):
  // nothing stored, and not counted as profile loads.
  const empty = { data: null, error: null };
  const websiteChain = {
    select: () => websiteChain,
    eq: () => websiteChain,
    order: () => websiteChain,
    maybeSingle: () => Promise.resolve(empty),
    then: (resolve: (value: typeof empty) => unknown) =>
      Promise.resolve(empty).then(resolve),
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: (table: string) =>
        table === "company_profiles" ? chain : websiteChain,
      channel: () => channel,
      removeChannel: vi.fn(),
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin" }, loading: false }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenant: { id: "client-tenant", name: "Client Garden Co" },
    loading: false,
  }),
}));

vi.mock("@/lib/profile/businessProfileUserId", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/profile/businessProfileUserId")>();
  return {
    ...actual,
    getTenantBusinessProfileUserId: (...args: [string, string | null]) =>
      mocks.getTenantBusinessProfileUserId(...args),
  };
});

import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { notifyBusinessProfileChanged } from "@/lib/profile/businessProfileUserId";

const profile = (street: string | null) => ({
  data: {
    company_name: "Client Garden Co",
    street_address: street,
    city: street ? "Springfield" : null,
    state_province: null,
    postal_code: null,
    country: null,
    feature_flags: null,
  },
  error: null,
});

describe("useCompanyInfo business profile changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTenantBusinessProfileUserId.mockResolvedValue("client-owner");
  });

  it("reloads the tenant's profile when Contact & Footer settings save it", async () => {
    mocks.maybeSingle.mockResolvedValue(profile(null));
    const { result } = renderHook(() => useCompanyInfo());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.companyInfo.address).toBe("");
    expect(mocks.getTenantBusinessProfileUserId).toHaveBeenCalledWith(
      "admin",
      "client-tenant",
    );

    mocks.maybeSingle.mockResolvedValue(profile("1 Orchard Lane"));
    const loadsBefore = mocks.maybeSingle.mock.calls.length;
    notifyBusinessProfileChanged({
      tenantId: "client-tenant",
      profileUserId: "client-owner",
    });

    await waitFor(() =>
      expect(result.current.companyInfo.address).toBe(
        "1 Orchard Lane, Springfield",
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    // One reload per save, not one per delivery mechanism.
    expect(mocks.maybeSingle.mock.calls.length).toBe(loadsBefore + 1);
  });

  it("ignores saves for a different tenant", async () => {
    mocks.maybeSingle.mockResolvedValue(profile(null));
    const { result } = renderHook(() => useCompanyInfo());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const loads = mocks.maybeSingle.mock.calls.length;

    notifyBusinessProfileChanged({
      tenantId: "other-tenant",
      profileUserId: "someone",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.maybeSingle.mock.calls.length).toBe(loads);
  });
});
