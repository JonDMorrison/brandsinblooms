import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockChain {
  // Used to assemble the call chain in order.
  calls: string[];
  match: Record<string, unknown>;
}

type MockResponse = { data: unknown; error: unknown };

const { fromMock, insertResolver, updateResolver, deleteResolver, selectResolver } =
  vi.hoisted(() => {
    return {
      fromMock: vi.fn(),
      insertResolver: { value: { data: null, error: null } as MockResponse },
      updateResolver: { value: { data: null, error: null } as MockResponse },
      deleteResolver: { value: { error: null } as { error: unknown } },
      selectResolver: { value: { data: [], error: null } as MockResponse },
    };
  });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "tenant-1" } }),
}));

import { useSavedTemplates } from "@/hooks/useSavedTemplates";

function buildBuilder(chain: MockChain) {
  // Each method returns the same builder until a terminal method
  // (`single` / awaited `order`) is invoked. Awaiting the builder
  // returns the resolver for the recorded path so tests can swap
  // them between calls.
  const builder: Record<string, unknown> = {};
  const record = (method: string) => {
    chain.calls.push(method);
    return builder;
  };
  builder.select = (...args: unknown[]) => {
    chain.calls.push(`select:${args[0] ?? ""}`);
    return builder;
  };
  builder.eq = (column: string, value: unknown) => {
    chain.calls.push(`eq:${column}=${String(value)}`);
    chain.match[column] = value;
    return builder;
  };
  builder.order = () => {
    chain.calls.push("order");
    return Promise.resolve(selectResolver.value);
  };
  builder.insert = (payload: Record<string, unknown>) => {
    chain.calls.push("insert");
    chain.match.insertPayload = payload;
    return builder;
  };
  builder.update = (payload: Record<string, unknown>) => {
    chain.calls.push("update");
    chain.match.updatePayload = payload;
    return builder;
  };
  builder.delete = () => record("delete");
  builder.single = () => {
    chain.calls.push("single");
    if (chain.calls.includes("update")) {
      return Promise.resolve(updateResolver.value);
    }
    if (chain.calls.includes("insert")) {
      return Promise.resolve(insertResolver.value);
    }
    return Promise.resolve(selectResolver.value);
  };
  builder.then = (onResolve: (value: unknown) => unknown) => {
    if (chain.calls.includes("delete")) {
      return Promise.resolve(deleteResolver.value).then(onResolve);
    }
    return Promise.resolve(selectResolver.value).then(onResolve);
  };
  return builder;
}

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const allChains: MockChain[] = [];

function findChain(predicate: (chain: MockChain) => boolean) {
  // Search in reverse so callers naturally get the most recent
  // matching chain even when an invalidating refetch has happened.
  for (let i = allChains.length - 1; i >= 0; i -= 1) {
    if (predicate(allChains[i])) return allChains[i];
  }
  return undefined;
}

beforeEach(() => {
  allChains.length = 0;
  selectResolver.value = { data: [], error: null };
  insertResolver.value = { data: null, error: null };
  updateResolver.value = { data: null, error: null };
  deleteResolver.value = { error: null };
  fromMock.mockReset();
  fromMock.mockImplementation((table: string) => {
    const chain: MockChain = { calls: [`from:${table}`], match: {} };
    allChains.push(chain);
    return buildBuilder(chain);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSavedTemplates", () => {
  it("queries saved_campaign_templates scoped to the current user", async () => {
    selectResolver.value = {
      data: [
        {
          id: "tpl-1",
          user_id: "user-1",
          tenant_id: "tenant-1",
          name: "Spring",
          description: "Saved",
          layout_json: [{ id: "b1", type: "plain-text" }],
          created_at: "2026-05-01T00:00:00Z",
          updated_at: "2026-05-01T00:00:00Z",
        },
      ],
      error: null,
    };

    const { result } = renderHook(() => useSavedTemplates(), {
      wrapper: buildWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fromMock).toHaveBeenCalledWith("saved_campaign_templates");
    expect(result.current.savedTemplates).toHaveLength(1);
    expect(result.current.savedTemplates[0].name).toBe("Spring");
    expect(result.current.savedTemplates[0].layout_json).toHaveLength(1);
  });

  it("saveTemplate inserts the row with user_id, tenant_id, name, blocks", async () => {
    insertResolver.value = {
      data: {
        id: "tpl-new",
        user_id: "user-1",
        tenant_id: "tenant-1",
        name: "New",
        description: null,
        layout_json: [],
        created_at: "2026-05-02T00:00:00Z",
        updated_at: "2026-05-02T00:00:00Z",
      },
      error: null,
    };

    const { result } = renderHook(() => useSavedTemplates(), {
      wrapper: buildWrapper(),
    });

    await act(async () => {
      await result.current.saveTemplate({
        name: "  New  ",
        description: null,
        contentBlocks: [{ id: "b", type: "plain-text" } as never],
      });
    });

    const insertChain = findChain((chain) =>
      chain.calls.includes("insert"),
    );
    const inserted = insertChain?.match.insertPayload as Record<
      string,
      unknown
    >;
    expect(inserted.user_id).toBe("user-1");
    expect(inserted.tenant_id).toBe("tenant-1");
    expect(inserted.name).toBe("New");
    expect(inserted.description).toBeNull();
    expect(inserted.is_public).toBe(false);
    expect(inserted.automation_ready).toBe(false);
    expect(Array.isArray(inserted.layout_json)).toBe(true);
  });

  it("saveTemplate rejects when the name is empty", async () => {
    const { result } = renderHook(() => useSavedTemplates(), {
      wrapper: buildWrapper(),
    });

    await expect(
      result.current.saveTemplate({
        name: "   ",
        contentBlocks: [],
      }),
    ).rejects.toThrow("Template name is required");
  });

  it("renameTemplate updates name and description for the given id", async () => {
    updateResolver.value = {
      data: {
        id: "tpl-1",
        user_id: "user-1",
        tenant_id: "tenant-1",
        name: "Renamed",
        description: "New desc",
        layout_json: [],
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-02T00:00:00Z",
      },
      error: null,
    };

    const { result } = renderHook(() => useSavedTemplates(), {
      wrapper: buildWrapper(),
    });

    await act(async () => {
      await result.current.renameTemplate("tpl-1", "  Renamed  ", "  New desc  ");
    });

    const updateChain = findChain((chain) =>
      chain.calls.includes("update"),
    );
    const update = updateChain?.match.updatePayload as Record<
      string,
      unknown
    >;
    expect(update.name).toBe("Renamed");
    expect(update.description).toBe("New desc");
    expect(updateChain?.match.id).toBe("tpl-1");
  });

  it("archiveTemplate hard-deletes by id", async () => {
    const { result } = renderHook(() => useSavedTemplates(), {
      wrapper: buildWrapper(),
    });

    await act(async () => {
      await result.current.archiveTemplate("tpl-1");
    });

    const deleteChain = findChain((chain) => chain.calls.includes("delete"));
    expect(deleteChain).toBeDefined();
    expect(deleteChain?.match.id).toBe("tpl-1");
  });
});
