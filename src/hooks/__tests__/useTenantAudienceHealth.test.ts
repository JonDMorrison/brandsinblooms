import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveIds, fromQuery, idQuery, tenantQuery } = vi.hoisted(() => ({
  resolveIds: vi.fn(),
  fromQuery: vi.fn(),
  idQuery: vi.fn(),
  tenantQuery: vi.fn(),
}));

vi.mock("@/lib/computeAudienceRecipientCount", () => ({
  resolveAudienceRecipientIds: resolveIds,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromQuery },
}));

import { fetchCampaignAudienceHealth } from "@/hooks/useTenantAudienceHealth";

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
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: tenantQuery.mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      in: idQuery,
    };
    fromQuery.mockReturnValue(query);
    idQuery.mockResolvedValue({ data: [], error: null });
  });

  it("counts only resolved customers and excludes suppression from eligibility", async () => {
    resolveIds.mockResolvedValue(["a", "b", "c", "d"]);
    idQuery.mockResolvedValue({ data: [
      { id: "a", email_opt_in: true, email_consent_method: "form", suppressed: false },
      { id: "b", email_opt_in: true, email_consent_method: "form", suppressed: true },
      { id: "c", email_opt_in: false, email_consent_method: "pending_confirmation", suppressed: false },
      { id: "d", email_opt_in: false, email_consent_method: "opt_out", suppressed: true },
    ], error: null });
    expect(await fetchCampaignAudienceHealth(options)).toEqual({
      total: 4, confirmed: 2, pending: 1, optedOut: 1, suppressed: 2, eligible: 1,
    });
    expect(resolveIds).toHaveBeenCalledWith({ ...options, fallbackToAllCustomers: false });
    expect(tenantQuery).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(idQuery).toHaveBeenCalledWith("id", ["a", "b", "c", "d"]);
  });

  it("does not replace an empty explicit audience with the whole tenant", async () => {
    resolveIds.mockResolvedValue([]);
    expect((await fetchCampaignAudienceHealth(options)).total).toBe(0);
    expect(fromQuery).not.toHaveBeenCalled();
    expect(resolveIds).toHaveBeenCalledWith(expect.objectContaining({ fallbackToAllCustomers: false }));
  });

  it("retains the legacy all-contacts fallback only without an explicit audience", async () => {
    resolveIds.mockResolvedValue([]);
    await fetchCampaignAudienceHealth({ ...options, segmentIds: [] });
    expect(resolveIds).toHaveBeenCalledWith(expect.objectContaining({ fallbackToAllCustomers: true }));
  });

  it("reads large audiences in bounded tenant-scoped batches", async () => {
    const ids = Array.from({ length: 501 }, (_, index) => `customer-${index}`);
    resolveIds.mockResolvedValue(ids);
    await fetchCampaignAudienceHealth(options);
    expect(idQuery.mock.calls.map((call) => call[1].length)).toEqual([500, 1]);
    expect(tenantQuery).toHaveBeenCalledTimes(2);
  });

  it("reports read failures instead of presenting misleading partial counts", async () => {
    resolveIds.mockResolvedValue(["a"]);
    const error = new Error("health read failed");
    idQuery.mockResolvedValue({ data: null, error });
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
