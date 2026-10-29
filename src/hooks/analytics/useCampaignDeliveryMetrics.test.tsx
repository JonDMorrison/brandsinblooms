import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  tenant: { id: "tenant-test" },
  rpc: vi.fn(),
}));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ tenant: state.tenant }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: state.rpc,
    from: (table: string) => {
      const data = table === "crm_campaigns" ? [{
        id: "campaign-test", name: "Newsletter", sent_at: "2026-10-29T14:00:00Z",
        total_sent: 9555, total_opens: 0, total_clicks: 0, open_rate: 0, click_rate: 0,
      }] : [];
      const query: Record<string, any> = {
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      };
      for (const method of ["select", "eq", "in", "gte", "order", "limit"]) {
        query[method] = () => query;
      }
      return query;
    },
  },
}));
import { useCampaignDeliveryMetrics } from "./useCampaignDeliveryMetrics";

afterEach(cleanup);
beforeEach(() => {
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({
    data: {
      metrics: {
        totals: { recipients: 9577, sent: 9555, delivered: 8726, failed: 22,
          skipped: 0, opens: 1381, clicks: 33 },
        rates: { open_reported: 15.85, click: 0.38 },
      },
    },
    error: null,
  });
});

describe("dashboard campaign reporting parity", () => {
  it("shows delivery and engagement from the live report even when caches are empty", async () => {
    const { result } = renderHook(() => useCampaignDeliveryMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(state.rpc).toHaveBeenCalledWith("get_email_campaign_reporting_snapshot",
      { p_campaign_id: "campaign-test" });
    expect(state.rpc.mock.calls.every(([name]) =>
      name === "get_email_campaign_reporting_snapshot")).toBe(true);
    expect(result.current.summary).toMatchObject({
      totalDelivered: 8726, totalFailed: 22, totalSkipped: 0,
    });
    expect(result.current.summary.avgOpenRate).toBeCloseTo(15.85, 2);
    expect(result.current.summary.avgClickRate).toBeCloseTo(0.38, 2);
    expect(result.current.campaigns[0]).toMatchObject({
      computedEnqueued: 9577, computedDelivered: 8726,
      totalOpens: 1381, totalClicks: 33, isStale: false,
    });
  });

  it("surfaces a reporting failure instead of silently displaying no results", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "Reporting unavailable" } });
    const { result } = renderHook(() => useCampaignDeliveryMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Reporting unavailable");
  });
});
