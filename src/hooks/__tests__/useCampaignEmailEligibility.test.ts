import { describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import {
  deriveEmailEligibilityGate,
  fetchCampaignEmailEligibility,
  fetchCustomerEmailEligibility,
  toCampaignEmailEligibility,
  toCustomerEmailEligibility,
} from "@/hooks/useCampaignEmailEligibility";

const row = (patch: Record<string, number | string | boolean | null> = {}) => ({
  audience_configured: true,
  total: 7600,
  eligible: 0,
  waiting: 0,
  asked_to_stop: 0,
  never_opted_in: 0,
  unsendable: 7600,
  duplicates: 0,
  blocked: 7600,
  eligible_with_consent_override: 0,
  eligible_with_soft_override: 0,
  eligible_with_both_overrides: 0,
  single_eligible_email: null,
  ...patch,
});

describe("campaign email eligibility", () => {
  it("maps Northfield's Email Subscribers: 7,600 opted in, all on a reserved domain, 0 eligible", () => {
    // email_campaign_eligibility logic run read-only on production, 2026-11-27.
    const result = toCampaignEmailEligibility(row());
    expect(result).toMatchObject({ total: 7600, eligible: 0, unsendable: 7600, blocked: 7600 });
    expect(deriveEmailEligibilityGate({ data: result, isError: false })).toBe("none");
  });

  it("rejects buckets that do not add up instead of showing them", () => {
    expect(() => toCampaignEmailEligibility(row({ eligible: 7600 }))).toThrow(/add up/);
    expect(() => toCampaignEmailEligibility(undefined)).toThrow();
  });

  it("is checking until the server answers, and an error is not zero", () => {
    expect(deriveEmailEligibilityGate({ data: undefined, isError: false })).toBe("checking");
    expect(deriveEmailEligibilityGate({ data: undefined, isError: true })).toBe("error");
    const ready = toCampaignEmailEligibility(row({ eligible: 5, unsendable: 7595 }));
    expect(deriveEmailEligibilityGate({ data: ready, isError: false })).toBe("ready");
  });

  it("sends the editor's audience to the one server function", async () => {
    rpc.mockResolvedValue({ data: [row({ total: "3", eligible: "3", unsendable: "0", blocked: "0" })], error: null });
    const result = await fetchCampaignEmailEligibility({
      tenantId: "tenant-a",
      includeAllCustomers: false,
      segmentIds: ["seg-1"],
      personaIds: ["loyal-regulars"],
      additionalCustomerIds: ["cust-1"],
    });
    expect(result.eligible).toBe(3);
    expect(rpc).toHaveBeenCalledWith("email_campaign_eligibility", {
      p_tenant_id: "tenant-a",
      p_include_all_customers: false,
      p_segment_ids: ["seg-1"],
      p_persona_ids: ["loyal-regulars"],
      p_customer_ids: ["cust-1"],
    });
  });

  it("surfaces read failures", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("eligibility read failed") });
    await expect(
      fetchCampaignEmailEligibility({
        tenantId: "tenant-a", includeAllCustomers: true, segmentIds: [], personaIds: [], additionalCustomerIds: [],
      }),
    ).rejects.toThrow("eligibility read failed");
  });

  it("maps per-customer verdicts to plain-English reasons and rejects unknown ones", () => {
    const verdicts = toCustomerEmailEligibility([
      { customer_id: "a", can_receive: true, reason: "eligible" },
      { customer_id: "b", can_receive: false, reason: "undeliverable_address" },
      { customer_id: "c", can_receive: false, reason: "unsubscribed" },
    ]);
    expect(verdicts.get("a")).toMatchObject({ canReceive: true });
    expect(verdicts.get("b")).toMatchObject({ canReceive: false, label: "Email address can't receive mail" });
    expect(verdicts.get("c")?.label).toBe("Unsubscribed");
    expect(() =>
      toCustomerEmailEligibility([{ customer_id: "d", can_receive: false, reason: "made_up" }]),
    ).toThrow(/Unknown email eligibility reason/);
  });

  it("asks the per-customer function once per id set and skips empty lists", async () => {
    rpc.mockReset();
    expect((await fetchCustomerEmailEligibility("tenant-a", [])).size).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: [{ customer_id: "a", can_receive: true, reason: "eligible" }], error: null });
    await fetchCustomerEmailEligibility("tenant-a", ["b", "a", "a"]);
    expect(rpc).toHaveBeenCalledWith("email_campaign_customer_eligibility", {
      p_tenant_id: "tenant-a",
      p_customer_ids: ["a", "b"],
    });
  });
});
