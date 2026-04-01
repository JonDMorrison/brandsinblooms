import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
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

let authState: AuthState;
let tenantState: TenantState;

const fromMock = vi.fn();

function buildQueryBuilder(result: unknown) {
  const query = {
    eq: () => query,
    order: () => query,
    in: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (error: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
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

vi.mock("@/hooks/useIsSuperAdmin", () => ({
  useIsSuperAdmin: () => ({
    data: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api/oauth", () => ({
  fetchOAuthConfig: vi.fn(),
}));

vi.mock("@/utils/environmentUtils", () => ({
  getOAuthRedirectUri: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useIntegrationDetailData } from "@/hooks/useIntegrationDetailData";

function MailchimpBootstrapProbe() {
  const detail = useIntegrationDetailData("mailchimp");

  if (detail.isLoading) {
    return <div data-testid="detail-state">loading</div>;
  }

  if (detail.marketingImportDetail) {
    return (
      <div>
        <div data-testid="detail-state">mailchimp-detail</div>
        <div data-testid="account-name">
          {detail.marketingImportDetail.accountName ?? "none"}
        </div>
      </div>
    );
  }

  if (detail.item) {
    return <div data-testid="detail-state">fallback-detail</div>;
  }

  return <div data-testid="detail-state">empty</div>;
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
      <MailchimpBootstrapProbe />
    </QueryClientProvider>,
  );
}

describe("useIntegrationDetailData Mailchimp bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authState = {
      user: null,
      loading: true,
    };

    tenantState = {
      tenant: null,
      loading: true,
    };

    fromMock.mockImplementation((table: string) => {
      if (table === "provider_connections") {
        return buildQueryBuilder({
          data: [
            {
              id: "connection-1",
              provider: "mailchimp",
              provider_account_name: "Bloom Mailchimp",
              provider_account_id: "acct-1",
              connected_at: "2026-03-20T10:00:00.000Z",
              created_at: "2026-03-20T10:00:00.000Z",
              updated_at: "2026-03-21T10:00:00.000Z",
              status: "connected",
              token_expires_at: null,
              metadata: {
                accountName: "Bloom Mailchimp",
              },
            },
          ],
          error: null,
        });
      }

      if (table === "provider_artifacts") {
        return buildQueryBuilder({
          data: [],
          error: null,
        });
      }

      if (table === "import_jobs") {
        return buildQueryBuilder({
          data: [],
          error: null,
        });
      }

      throw new Error(`Unexpected table access: ${table}`);
    });
  });

  it("keeps Mailchimp on loading until auth and tenant resolve", async () => {
    const view = renderProbe();

    expect(screen.getByTestId("detail-state").textContent).toBe("loading");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("detail-state").textContent).toBe("loading");

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

    view.rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <MailchimpBootstrapProbe />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("detail-state").textContent).toBe(
        "mailchimp-detail",
      );
    });

    expect(screen.getByTestId("account-name").textContent).toBe(
      "Bloom Mailchimp",
    );
    expect(screen.queryByText("fallback-detail")).toBeNull();
  });
});
