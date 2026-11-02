import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const HOME = "home-company";
const WEST_COAST = "west-coast";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "jon" } },
  assignedTenant: vi.fn(),
  tenantDelays: {} as Record<string, number>,
  adminState: {
    isMasterAdmin: false,
    activeTenantId: null as string | null,
    hasHydratedTenantContext: false,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      let id = "";
      const query = {
        select: () => query,
        eq: (_column: string, value: string) => {
          id = value;
          return query;
        },
        maybeSingle: () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ data: { id, name: id }, error: null }),
              mocks.tenantDelays[id] ?? 0,
            ),
          ),
      };
      return query;
    },
  },
}));

vi.mock("@/utils/getUserAssignedTenantId", () => ({
  getUserAssignedTenantId: mocks.assignedTenant,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/contexts/AdminContext", () => ({
  useAdmin: () => mocks.adminState,
}));

import { useTenant } from "@/hooks/useTenant";

describe("useTenant follows the admin workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assignedTenant.mockResolvedValue(HOME);
    mocks.tenantDelays = {};
    mocks.adminState.isMasterAdmin = false;
    mocks.adminState.activeTenantId = null;
    mocks.adminState.hasHydratedTenantContext = false;
  });

  it("does not pick the home company while admin status is still loading", async () => {
    const { result, rerender } = renderHook(() => useTenant());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.assignedTenant).not.toHaveBeenCalled();
    expect(result.current.tenant).toBeNull();

    mocks.adminState.isMasterAdmin = true;
    mocks.adminState.activeTenantId = WEST_COAST;
    mocks.adminState.hasHydratedTenantContext = true;
    rerender();

    await waitFor(() => expect(result.current.tenant?.id).toBe(WEST_COAST));
    expect(mocks.assignedTenant).not.toHaveBeenCalled();
  });

  it("never lets a slower, older company read overwrite the current one", async () => {
    mocks.adminState.hasHydratedTenantContext = true;
    mocks.tenantDelays[HOME] = 60;
    const { result, rerender } = renderHook(() => useTenant());

    mocks.adminState.isMasterAdmin = true;
    mocks.adminState.activeTenantId = WEST_COAST;
    rerender();

    await waitFor(() => expect(result.current.tenant?.id).toBe(WEST_COAST));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.tenant?.id).toBe(WEST_COAST);
  });

  it("keeps regular users on their own company", async () => {
    mocks.adminState.hasHydratedTenantContext = true;
    const { result } = renderHook(() => useTenant());
    await waitFor(() => expect(result.current.tenant?.id).toBe(HOME));
  });
});
