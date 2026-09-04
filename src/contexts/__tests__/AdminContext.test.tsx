import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  adminMaybeSingle: vi.fn(),
  contextMaybeSingle: vi.fn(),
  contextUpsert: vi.fn(),
  tenantsOrder: vi.fn(),
  user: { id: "admin-1", email: "admin@example.com" },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

import { AdminProvider, useAdmin } from "@/contexts/AdminContext";

type ContextResult = {
  data: { active_tenant_id: string | null } | null;
  error: unknown;
};

function makeDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AdminProvider>{children}</AdminProvider>;
}

describe("AdminProvider tenant context hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.adminMaybeSingle.mockResolvedValue({
      data: { email: "admin@example.com" },
      error: null,
    });
    mocks.contextUpsert.mockResolvedValue({ error: null });
    mocks.tenantsOrder.mockResolvedValue({ data: [], error: null });

    mocks.from.mockImplementation((table: string) => {
      if (table === "app_admin_emails") {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          maybeSingle: mocks.adminMaybeSingle,
        };
        return builder;
      }

      if (table === "admin_session_context") {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          maybeSingle: mocks.contextMaybeSingle,
          upsert: mocks.contextUpsert,
        };
        return builder;
      }

      if (table === "tenants") {
        const builder = {
          select: vi.fn(() => builder),
          order: mocks.tenantsOrder,
        };
        return builder;
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("does not overwrite a persisted tenant with null while master-admin context is still hydrating", async () => {
    const deferred = makeDeferred<ContextResult>();
    mocks.contextMaybeSingle.mockImplementation(() => deferred.promise);

    const { result } = renderHook(() => useAdmin(), { wrapper });

    await waitFor(() => {
      expect(result.current.isMasterAdmin).toBe(true);
      expect(mocks.contextMaybeSingle).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      mocks.contextUpsert.mock.calls.some(
        ([payload]) => payload?.active_tenant_id === null,
      ),
    ).toBe(false);

    await act(async () => {
      deferred.resolve({
        data: { active_tenant_id: "tenant-greenfield" },
        error: null,
      });
      await deferred.promise;
    });

    await waitFor(() => {
      expect(result.current.hasHydratedTenantContext).toBe(true);
      expect(result.current.activeTenantId).toBe("tenant-greenfield");
    });

    await waitFor(() => {
      expect(mocks.contextUpsert).toHaveBeenCalled();
    });

    const payloads = mocks.contextUpsert.mock.calls.map(([payload]) => payload);
    expect(payloads).not.toContainEqual(
      expect.objectContaining({ active_tenant_id: null }),
    );
    expect(payloads.at(-1)).toEqual(
      expect.objectContaining({
        admin_user_id: "admin-1",
        active_tenant_id: "tenant-greenfield",
      }),
    );
  });
});
