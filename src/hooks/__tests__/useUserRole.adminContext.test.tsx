import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  adminState: {
    isMasterAdmin: true,
    isLoading: false,
    activeTenantId: null as string | null,
    hasHydratedTenantContext: true,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin-1" } }),
}));

vi.mock("@/contexts/AdminContext", () => ({
  useAdmin: () => mocks.adminState,
}));

import { useUserRole } from "@/hooks/useUserRole";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function accessFor(tenantId: string) {
  return {
    data: {
      tenantId,
      role: "owner_admin",
      locationIds: [],
      permissions: ["customers.read", "campaigns.read", "reports.read"],
    },
    error: null,
  };
}

describe("useUserRole master-admin tenant scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminState.isMasterAdmin = true;
    mocks.adminState.isLoading = false;
    mocks.adminState.activeTenantId = null;
    mocks.adminState.hasHydratedTenantContext = true;
  });

  it("does not call tenant-scoped CRM access while a master admin has no selected tenant", async () => {
    const { result } = renderHook(() => useUserRole(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(result.current.tenantId).toBeNull();
    expect(result.current.permissions).toEqual([]);
  });

  it("refetches CRM access when a master admin switches tenants", async () => {
    mocks.adminState.activeTenantId = "tenant-a";
    mocks.rpc.mockResolvedValueOnce(accessFor("tenant-a"));

    const { result, rerender } = renderHook(() => useUserRole(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.tenantId).toBe("tenant-a");
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);

    mocks.adminState.activeTenantId = "tenant-b";
    mocks.rpc.mockResolvedValueOnce(accessFor("tenant-b"));
    rerender();

    await waitFor(() => {
      expect(result.current.tenantId).toBe("tenant-b");
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});
