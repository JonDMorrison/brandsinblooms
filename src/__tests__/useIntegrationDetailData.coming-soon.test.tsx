import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "sonner";

const insertMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "owner@example.com",
    },
  }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenant: { id: "tenant-1" },
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

function ComingSoonHookProbe() {
  const detail = useIntegrationDetailData("custom-webhooks");

  if (!detail.item || !detail.model || !detail.comingSoonDetail) {
    return <div>loading</div>;
  }

  return (
    <div>
      <div data-testid="notify-email">
        {detail.comingSoonDetail.notifyEmail}
      </div>
      <div data-testid="submitted">
        {detail.comingSoonDetail.isSubmitted ? "yes" : "no"}
      </div>
      <button
        type="button"
        onClick={() => {
          void detail.submitComingSoonInterest();
        }}
      >
        Submit interest
      </button>
    </div>
  );
}

function renderProbe() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ComingSoonHookProbe />
    </QueryClientProvider>,
  );
}

describe("useIntegrationDetailData coming-soon notify flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      if (table !== "integration_interest") {
        throw new Error(`Unexpected table access: ${table}`);
      }

      return {
        insert: insertMock,
      };
    });
    insertMock.mockResolvedValue({ error: null });
  });

  it("prefills the session email and records interest submissions", async () => {
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("notify-email").textContent).toBe(
        "owner@example.com",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit interest" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith({
        tenant_id: "tenant-1",
        user_id: "user-1",
        email: "owner@example.com",
        integration_slug: "custom-webhooks",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("submitted").textContent).toBe("yes");
    });
  });

  it("treats same-day duplicate submissions as already acknowledged", async () => {
    insertMock.mockResolvedValue({
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    });

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("submitted").textContent).toBe("no");
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit interest" }));

    await waitFor(() => {
      expect(screen.getByTestId("submitted").textContent).toBe("yes");
    });

    expect(toast.error).not.toHaveBeenCalled();
  });
});
