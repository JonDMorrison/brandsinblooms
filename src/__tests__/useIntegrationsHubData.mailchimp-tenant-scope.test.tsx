import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockUser = {
  id: string;
  email: string;
};

type AuthState = {
  user: MockUser | null;
  loading: boolean;
};

type TenantState = {
  tenant: { id: string } | null;
  loading: boolean;
};

type QueryState = {
  eq: Map<string, unknown>;
  in: Map<string, unknown[]>;
  is: Map<string, unknown>;
};

let authState: AuthState;
let tenantState: TenantState;

const fromMock = vi.fn();

function buildResult(table: string, state: QueryState) {
  if (table === "provider_connections") {
    const provider = state.eq.get("provider");
    const providers = state.in.get("provider") ?? [];
    const userId = state.eq.get("user_id");

    if (provider === "mailchimp") {
      return {
        data:
          userId === undefined
            ? [
                {
                  id: "mailchimp-connection-1",
                  provider: "mailchimp",
                  provider_account_name: "Bloom Mailchimp",
                  status: "connected",
                  connected_at: "2026-04-02T10:00:00.000Z",
                  updated_at: "2026-04-02T10:05:00.000Z",
                  revoked_at: null,
                  tenant_id: "tenant-1",
                  user_id: "user-2",
                },
              ]
            : [],
        error: null,
      };
    }

    if (providers.includes("mailchimp")) {
      return {
        data: userId === "user-1" ? [] : [],
        error: null,
      };
    }

    return {
      data: [],
      error: null,
    };
  }

  return {
    data: [],
    error: null,
  };
}

function createQueryBuilder(table: string) {
  const state: QueryState = {
    eq: new Map(),
    in: new Map(),
    is: new Map(),
  };

  const resolve = () => Promise.resolve(buildResult(table, state));

  const query = {
    eq: (column: string, value: unknown) => {
      state.eq.set(column, value);
      return query;
    },
    in: (column: string, value: unknown[]) => {
      state.in.set(column, value);
      return query;
    },
    is: (column: string, value: unknown) => {
      state.is.set(column, value);
      return query;
    },
    order: () => query,
    limit: () => query,
    maybeSingle: () =>
      resolve().then((result) => ({
        data: Array.isArray(result.data)
          ? (result.data[0] ?? null)
          : result.data,
        error: result.error,
      })),
    single: () =>
      resolve().then((result) => ({
        data: Array.isArray(result.data)
          ? (result.data[0] ?? null)
          : result.data,
        error: result.error,
      })),
    then: (
      onFulfilled?: (value: Awaited<ReturnType<typeof resolve>>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => resolve().then(onFulfilled, onRejected),
  };

  return {
    select: () => query,
  };
}

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    loading: authState.loading,
  }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenant: tenantState.tenant,
    loading: tenantState.loading,
  }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    hasRole: () => true,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { useIntegrationsHubData } from "@/hooks/useIntegrationsHubData";

function MailchimpHubProbe() {
  const { itemMap, isLoading } = useIntegrationsHubData();
  const mailchimpItem = itemMap.get("mailchimp");

  if (isLoading) {
    return <div data-testid="hub-state">loading</div>;
  }

  return (
    <div>
      <div data-testid="hub-state">ready</div>
      <div data-testid="mailchimp-status">
        {mailchimpItem?.status ?? "missing"}
      </div>
      <div data-testid="mailchimp-action">
        {mailchimpItem?.actionLabel ?? "missing"}
      </div>
      <div data-testid="mailchimp-meta">
        {mailchimpItem?.metaLabel ?? "missing"}
      </div>
    </div>
  );
}

function renderProbe() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MailchimpHubProbe />
    </QueryClientProvider>,
  );
}

describe("useIntegrationsHubData Mailchimp tenant scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authState = {
      user: {
        id: "user-1",
        email: "owner@example.com",
      },
      loading: false,
    };

    tenantState = {
      tenant: { id: "tenant-1" },
      loading: false,
    };

    fromMock.mockImplementation((table: string) => createQueryBuilder(table));
  });

  it("treats Mailchimp as connected when the tenant connection belongs to another teammate", async () => {
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("hub-state")).toHaveTextContent("ready");
    });

    expect(screen.getByTestId("mailchimp-status")).toHaveTextContent(
      "connected",
    );
    expect(screen.getByTestId("mailchimp-action")).toHaveTextContent(
      "Configure",
    );
    expect(screen.getByTestId("mailchimp-meta")).toHaveTextContent(
      "Bloom Mailchimp",
    );
  });
});
