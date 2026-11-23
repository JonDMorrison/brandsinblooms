import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveIds, rpc } = vi.hoisted(() => ({
  resolveIds: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/computeAudienceRecipientCount", () => ({
  resolveAudienceRecipientIds: resolveIds,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import {
  fetchCampaignAudienceHealth,
  fetchTenantAudienceHealth,
  toAudienceHealth,
} from "@/hooks/useTenantAudienceHealth";

const row = (total: number, reachable: number, waiting: number, stopped: number, unsendable: number) => ({
  total, reachable, waiting, stopped, unsendable,
});

describe("email reachability bucket math", () => {
  it("maps the four exclusive buckets and they add up to the total", () => {
    const health = toAudienceHealth([row(270, 244, 1, 21, 4)]);
    expect(health).toEqual({ total: 270, confirmed: 244, eligible: 244, pending: 1, optedOut: 21, suppressed: 4 });
    expect(health.confirmed + health.pending + health.optedOut + health.suppressed).toBe(health.total);
  });

  it("reports a fully suppressed tenant as 0 reachable, not 7,600 said yes", () => {
    // Greenfield: 7,600 opted in but all 9,500 are suppressed.
    expect(toAudienceHealth([row(9500, 0, 0, 0, 9500)])).toMatchObject({ total: 9500, confirmed: 0, eligible: 0, suppressed: 9500 });
  });

  it("sums batches and accepts bigint counts returned as strings", () => {
    expect(toAudienceHealth([row(3, 1, 1, 1, 0), { total: "2", reachable: "2", waiting: "0", stopped: "0", unsendable: "0" }]))
      .toMatchObject({ total: 5, confirmed: 3 });
  });

  it("rejects buckets that do not add up instead of showing them", () => {
    expect(() => toAudienceHealth([row(9500, 7600, 0, 0, 9500)])).toThrow(/add up/);
  });
});

describe("campaign-scoped consent health", () => {
  const options = {
    tenantId: "tenant-a",
    includeAllCustomers: false,
    additionalCustomerIds: [],
    segmentIds: ["selected-segment"],
    personaIds: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: [row(4, 1, 1, 1, 1)], error: null });
  });

  it("counts only the resolved customers with the shared definition", async () => {
    resolveIds.mockResolvedValue(["a", "b", "c", "d"]);
    expect(await fetchCampaignAudienceHealth(options)).toEqual({
      total: 4, confirmed: 1, eligible: 1, pending: 1, optedOut: 1, suppressed: 1,
    });
    expect(resolveIds).toHaveBeenCalledWith({ ...options, fallbackToAllCustomers: false });
    expect(rpc).toHaveBeenCalledWith("email_reachability_summary", {
      p_tenant_id: "tenant-a",
      p_customer_ids: ["a", "b", "c", "d"],
    });
  });

  it("does not replace an empty explicit audience with the whole tenant", async () => {
    resolveIds.mockResolvedValue([]);
    expect((await fetchCampaignAudienceHealth(options)).total).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the whole tenant, like the dashboard, when no audience is chosen", async () => {
    await fetchCampaignAudienceHealth({ ...options, segmentIds: [] });
    expect(resolveIds).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("email_reachability_summary", { p_tenant_id: "tenant-a" });
    await fetchTenantAudienceHealth("tenant-a");
    expect(rpc).toHaveBeenLastCalledWith("email_reachability_summary", { p_tenant_id: "tenant-a" });
  });

  it("reads large audiences in bounded batches", async () => {
    const ids = Array.from({ length: 1001 }, (_, index) => `customer-${index}`);
    resolveIds.mockResolvedValue(ids);
    await fetchCampaignAudienceHealth(options);
    expect(rpc.mock.calls.map((call) => call[1].p_customer_ids.length)).toEqual([1000, 1]);
  });

  it("reports read failures instead of presenting misleading partial counts", async () => {
    resolveIds.mockResolvedValue(["a"]);
    rpc.mockResolvedValue({ data: null, error: new Error("health read failed") });
    await expect(fetchCampaignAudienceHealth(options)).rejects.toThrow("health read failed");
  });
});

// Pure predicate copied from the audience step UI — if the production code
// shifts this logic, this test should be updated to match. Centralising the
// threshold (10%) here in tests keeps it visible.
function shouldShowPendingConfirmationWarning(health: {
  total: number;
  pending: number;
}) {
  if (health.pending <= 0) return false;
  if (health.total <= 0) return false;
  return health.pending / health.total > 0.1;
}

describe("audience-step pending-confirmation warning predicate", () => {
  it("fires when pending is more than 10% of total", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 100, pending: 11 }),
    ).toBe(true);
  });

  it("does not fire when pending is exactly 10% of total", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 100, pending: 10 }),
    ).toBe(false);
  });

  it("does not fire when pending is less than 10%", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 1000, pending: 50 }),
    ).toBe(false);
  });

  it("does not fire when pending is 0", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 1000, pending: 0 }),
    ).toBe(false);
  });

  it("does not fire when total is 0 (avoid divide by zero)", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 0, pending: 0 }),
    ).toBe(false);
  });

  it("fires for the Erin Minter shape (most of list pending)", () => {
    // Real-world shape: ~4,300 customers, only a handful confirmed.
    expect(
      shouldShowPendingConfirmationWarning({ total: 4346, pending: 4200 }),
    ).toBe(true);
  });
});
