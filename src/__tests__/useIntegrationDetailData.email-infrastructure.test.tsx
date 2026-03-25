import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
const rpcMock = vi.fn();
const functionsInvokeMock = vi.fn();

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
    rpc: (...args: unknown[]) => rpcMock(...args),
    functions: {
      invoke: (...args: unknown[]) => functionsInvokeMock(...args),
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

function EmailInfrastructureHookProbe() {
  const detail = useIntegrationDetailData("email-infrastructure");

  if (detail.isError) {
    return <div data-testid="error-state">{String(detail.error)}</div>;
  }

  if (!detail.emailInfrastructureDetail) {
    return <div>loading</div>;
  }

  return (
    <div>
      <div data-testid="primary-domain">
        {detail.emailInfrastructureDetail.primaryDomain}
      </div>
      <div data-testid="environment-label">
        {detail.emailInfrastructureDetail.environmentLabel}
      </div>
      <div data-testid="dns-coverage">
        {`${detail.emailInfrastructureDetail.dnsVerifiedCount}/${detail.emailInfrastructureDetail.dnsRecordCount}`}
      </div>
      <div data-testid="spf-status">
        {
          detail.emailInfrastructureDetail.protocolRows.find(
            (row) => row.label === "SPF",
          )?.value
        }
      </div>
      <div data-testid="dkim-status">
        {
          detail.emailInfrastructureDetail.protocolRows.find(
            (row) => row.label === "DKIM",
          )?.value
        }
      </div>
      <div data-testid="dmarc-status">
        {
          detail.emailInfrastructureDetail.protocolRows.find(
            (row) => row.label === "DMARC",
          )?.value
        }
      </div>
      <div data-testid="logs-path">
        {detail.emailInfrastructureDetail.sendingLogsPath}
      </div>
      <button
        type="button"
        onClick={() => {
          void detail.runEmailInfrastructureHealthCheck();
        }}
      >
        Run infrastructure health check
      </button>
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

  render(
    <QueryClientProvider client={queryClient}>
      <EmailInfrastructureHookProbe />
    </QueryClientProvider>,
  );
}

describe("useIntegrationDetailData email infrastructure flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromMock.mockImplementation((table: string) => {
      if (table === "email_domains") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "domain-1",
                      domain: "bloomflowers.co",
                      status: "active",
                      created_at: "2026-03-20T10:00:00.000Z",
                      updated_at: "2026-03-22T10:00:00.000Z",
                      env: "prod",
                      is_sandbox: false,
                      verified_at: "2026-03-21T11:00:00.000Z",
                      last_verify_attempt_at: "2026-03-22T09:00:00.000Z",
                      last_verify_error: null,
                      error: null,
                      daily_limit: 500,
                      daily_sent_count: 184,
                      warmup_stage: 3,
                      entri_provider: "Cloudflare",
                      is_entri_managed: true,
                      healthy_days_counter: 12,
                      resend_status: {
                        direct_dns: {
                          checks: [
                            {
                              record_type: "TXT",
                              fqdn: "bloomflowers.co",
                              expected: "v=spf1 include:resend.email ~all",
                              found: true,
                              verified: true,
                              actual_values: [
                                "v=spf1 include:resend.email ~all",
                              ],
                              last_checked_at: "2026-03-22T14:00:00.000Z",
                            },
                            {
                              record_type: "CNAME",
                              fqdn: "selector1._domainkey.bloomflowers.co",
                              expected: "selector1.domainkey.resend.email",
                              found: false,
                              verified: false,
                              actual_values: [],
                              last_checked_at: "2026-03-22T14:00:00.000Z",
                            },
                            {
                              record_type: "TXT",
                              fqdn: "_dmarc.bloomflowers.co",
                              expected:
                                "v=DMARC1; p=none; rua=mailto:dmarc@bloomsuite.app",
                              found: true,
                              verified: false,
                              actual_values: ["v=DMARC1; p=reject"],
                              last_checked_at: "2026-03-22T14:00:00.000Z",
                            },
                          ],
                        },
                        records: [
                          {
                            type: "TXT",
                            name: "bloomflowers.co",
                            dns_verified: true,
                          },
                          {
                            type: "CNAME",
                            name: "selector1._domainkey.bloomflowers.co",
                            dns_verified: false,
                          },
                        ],
                      },
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "email_dns_records") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "dns-1",
                      name: "bloomflowers.co",
                      type: "TXT",
                      value: "v=spf1 include:resend.email ~all",
                      purpose: "spf",
                      required: true,
                    },
                    {
                      id: "dns-2",
                      name: "selector1._domainkey.bloomflowers.co",
                      type: "CNAME",
                      value: "selector1.domainkey.resend.email",
                      purpose: "dkim",
                      required: true,
                    },
                    {
                      id: "dns-3",
                      name: "_dmarc.bloomflowers.co",
                      type: "TXT",
                      value:
                        "v=DMARC1; p=none; rua=mailto:dmarc@bloomsuite.app",
                      purpose: "dmarc",
                      required: true,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "deliverability_summary_30d") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    sent_30d: 4320,
                    delivered_30d: 4236,
                    opened_30d: 1940,
                    clicked_30d: 814,
                    bounced_30d: 61,
                    complained_30d: 8,
                  },
                  error: null,
                }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    });

    rpcMock.mockResolvedValue({
      data: {
        reputation_score: 93,
        reputation_tier: "Strong",
        trend_direction: "up",
        sent_24h: 184,
        delivered_24h: 180,
        bounce_rate_24h: 1.2,
        complaint_rate_24h: 0.2,
      },
      error: null,
    });

    functionsInvokeMock.mockImplementation((name: string, options?: any) => {
      if (name !== "domain-health-check") {
        throw new Error(`Unexpected function invoke: ${name}`);
      }

      if (options?.body?.method === "GET") {
        return Promise.resolve({
          data: {
            checks: [
              {
                id: "check-1",
                check_type: "dns",
                status: "healthy",
                details: {},
                response_time_ms: 120,
                checked_at: "2026-03-22T14:00:00.000Z",
              },
            ],
          },
          error: null,
        });
      }

      return Promise.resolve({ data: { ok: true }, error: null });
    });
  });

  it("maps tenant-scoped email infrastructure data and runs health checks", async () => {
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("primary-domain").textContent).toBe(
        "bloomflowers.co",
      );
    });

    expect(screen.getByTestId("environment-label").textContent).toBe(
      "Production",
    );
    expect(screen.getByTestId("dns-coverage").textContent).toBe("1/3");
    expect(screen.getByTestId("spf-status").textContent).toBe("Verified");
    expect(screen.getByTestId("dkim-status").textContent).toBe("Missing");
    expect(screen.getByTestId("dmarc-status").textContent).toBe("Incorrect");
    expect(screen.getByTestId("logs-path").textContent).toBe(
      "/activity?q=email",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Run infrastructure health check",
      }),
    );

    await waitFor(() => {
      expect(functionsInvokeMock).toHaveBeenCalledWith("domain-health-check", {
        body: {
          domainId: "domain-1",
          checkTypes: ["dns", "tls", "http"],
        },
      });
    });
  });
});
