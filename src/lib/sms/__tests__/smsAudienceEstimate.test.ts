import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
type QueryCall = { method: string; args: unknown[] };
const queryCalls: QueryCall[][] = [];
const queryPages: Array<{ data: { id: string }[] | null; error: unknown }> = [];
function makeQuery(table: string) {
  const calls: QueryCall[] = [{ method: "from", args: [table] }];
  queryCalls.push(calls);
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "gte", "gt", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.limit = (...args: unknown[]) => {
    calls.push({ method: "limit", args });
    return Promise.resolve(queryPages.shift() ?? { data: [], error: null });
  };
  return builder;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (table: string) => makeQuery(table),
  },
}));
const resolveAudienceRecipientIds = vi.fn();
vi.mock("@/lib/computeAudienceRecipientCount", async (original) => ({
  ...(await original<typeof import("@/lib/computeAudienceRecipientCount")>()),
  resolveAudienceRecipientIds: (...args: unknown[]) => resolveAudienceRecipientIds(...args),
}));

import {
  fetchSmsAudienceEstimate,
  fetchSmsSegmentSendEstimate,
  parseSmsAudienceEstimate,
} from "../smsAudienceEstimate";

const NORTHFIELD = "3eade43c-2e5a-4ad0-80fb-500e3d7afbd4";

describe("SMS audience estimate (qa4 #6)", () => {
  beforeEach(() => {
    rpc.mockReset();
    resolveAudienceRecipientIds.mockReset();
  });

  it("asks get_sms_audience_estimate for all subscribers", async () => {
    // Northfield on 2026-11-24: its 4 opted-in customers with consent proof
    // are deleted, so nobody is eligible (the old estimate counted them).
    rpc.mockResolvedValue({ data: { audience: 9500, eligible: 0, excluded: 9500 }, error: null });
    await expect(fetchSmsAudienceEstimate({ tenantId: NORTHFIELD })).resolves.toEqual({ audience: 9500, eligible: 0, excluded: 9500 });
    expect(rpc).toHaveBeenCalledWith("get_sms_audience_estimate", {
      p_tenant_id: NORTHFIELD, p_segment_id: null, p_persona_ids: null, p_customer_ids: null,
    });
  });

  it("passes a custom segment or persona straight to the database", async () => {
    rpc.mockResolvedValue({ data: { audience: 10, eligible: 4, excluded: 6 }, error: null });
    const segment = "8f0e2a1c-3b4d-4e5f-8a6b-7c8d9e0f1a2b";
    await fetchSmsAudienceEstimate({ tenantId: NORTHFIELD, segmentId: segment });
    expect(rpc).toHaveBeenLastCalledWith("get_sms_audience_estimate", expect.objectContaining({ p_segment_id: segment, p_customer_ids: null }));
    await fetchSmsAudienceEstimate({ tenantId: NORTHFIELD, personaIds: ["p1"] });
    expect(rpc).toHaveBeenLastCalledWith("get_sms_audience_estimate", expect.objectContaining({ p_persona_ids: ["p1"], p_segment_id: null }));
    expect(resolveAudienceRecipientIds).not.toHaveBeenCalled();
  });

  it("resolves a built-in segment to customers, then applies the SMS rules to them", async () => {
    resolveAudienceRecipientIds.mockResolvedValue(["c1", "c2"]);
    rpc.mockResolvedValue({ data: { audience: 2, eligible: 1, excluded: 1 }, error: null });
    await expect(fetchSmsAudienceEstimate({ tenantId: NORTHFIELD, segmentId: "high-value" })).resolves.toMatchObject({ eligible: 1 });
    expect(rpc).toHaveBeenLastCalledWith("get_sms_audience_estimate", expect.objectContaining({ p_segment_id: null, p_customer_ids: ["c1", "c2"] }));
  });

  it("surfaces an error instead of a zero estimate", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Campaign access denied" } });
    await expect(fetchSmsAudienceEstimate({ tenantId: NORTHFIELD })).rejects.toMatchObject({ message: "Campaign access denied" });
  });

  it("parses counts defensively", () => {
    expect(parseSmsAudienceEstimate({ audience: "12", eligible: 3, excluded: 9 })).toEqual({ audience: 12, eligible: 3, excluded: 9 });
    expect(parseSmsAudienceEstimate(null)).toEqual({ audience: 0, eligible: 0, excluded: 0 });
  });
});

describe("Send SMS to segment uses the one SMS rule", () => {
  const BURNETTS = "baf927f2-3473-4b83-ac2c-cc9397c43b51";
  const ids = (count: number, offset = 0) =>
    Array.from({ length: count }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(offset + index).padStart(12, "0")}`,
    }));

  beforeEach(() => {
    rpc.mockReset();
    queryCalls.length = 0;
    queryPages.length = 0;
  });

  it("counts a custom segment with get_sms_audience_estimate", async () => {
    // Burnett's "Loyalty Members" on 2026-11-25: 9,406 eligible under the rule;
    // the old email opt_out filter showed 9,323 (91 email unsubscribers dropped).
    rpc.mockResolvedValue({ data: { audience: 10370, eligible: 9406, excluded: 964 }, error: null });
    const segment = "5389aa2f-ff03-4c61-a408-9433f8032ef0";
    await expect(
      fetchSmsSegmentSendEstimate({ tenantId: BURNETTS, segmentId: segment, isSystemSegment: false }),
    ).resolves.toEqual({ audience: 10370, eligible: 9406, excluded: 964 });
    expect(rpc).toHaveBeenCalledWith("get_sms_audience_estimate", {
      p_tenant_id: BURNETTS, p_segment_id: segment, p_persona_ids: null, p_customer_ids: null,
    });
    expect(queryCalls).toEqual([]);
  });

  it("pages a built-in segment past 1,000 customers, then applies the rule in the database", async () => {
    queryPages.push({ data: ids(1000), error: null }, { data: ids(250, 1000), error: null });
    rpc.mockResolvedValue({ data: { audience: 1250, eligible: 1100, excluded: 150 }, error: null });

    await expect(
      fetchSmsSegmentSendEstimate({ tenantId: BURNETTS, segmentId: "high-value", isSystemSegment: true }),
    ).resolves.toMatchObject({ eligible: 1100 });

    expect(queryCalls).toHaveLength(2);
    const [first, second] = queryCalls;
    expect(first).toContainEqual({ method: "eq", args: ["tenant_id", BURNETTS] });
    expect(first).toContainEqual({ method: "gte", args: ["total_spent", 500] });
    expect(first).not.toContainEqual(expect.objectContaining({ args: expect.arrayContaining(["opt_out"]) }));
    expect(second).toContainEqual({ method: "gt", args: ["id", ids(1, 999)[0].id] });
    const [, params] = rpc.mock.calls[0] as [string, { p_customer_ids: string[]; p_segment_id: null }];
    expect(rpc.mock.calls[0][0]).toBe("get_sms_audience_estimate");
    expect(params.p_segment_id).toBeNull();
    expect(params.p_customer_ids).toHaveLength(1250);
  });

  it("scopes Perks Members to the tenant's loyalty members", async () => {
    queryPages.push({ data: ids(3), error: null });
    rpc.mockResolvedValue({ data: { audience: 3, eligible: 2, excluded: 1 }, error: null });
    await fetchSmsSegmentSendEstimate({ tenantId: BURNETTS, segmentId: "perks-members", isSystemSegment: true });
    expect(queryCalls[0]).toContainEqual({ method: "eq", args: ["tenant_id", BURNETTS] });
    expect(queryCalls[0]).toContainEqual({ method: "eq", args: ["customer_loyalty_metrics.is_perks_member", true] });
  });

  it("returns zero without an RPC when a built-in segment is empty", async () => {
    await expect(
      fetchSmsSegmentSendEstimate({ tenantId: BURNETTS, segmentId: "new-customers", isSystemSegment: true }),
    ).resolves.toEqual({ audience: 0, eligible: 0, excluded: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects built-in segments the send path would treat as everyone", async () => {
    await expect(
      fetchSmsSegmentSendEstimate({ tenantId: BURNETTS, segmentId: "lapsed-customers", isSystemSegment: true }),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    expect(queryCalls).toEqual([]);
  });

  it("matches count_sms_campaign_recipients' built-in segment definitions", () => {
    const countFix = readFileSync("supabase/migrations/20261124190246_sms_campaign_count_frequent_buyers.sql", "utf8");
    const helper = readFileSync("src/lib/sms/smsAudienceEstimate.ts", "utf8");
    expect(countFix).toContain("WHEN 'high-value' THEN coalesce(customer.total_spent,0)>=500");
    expect(helper).toContain('query.gte("total_spent", 500)');
    expect(countFix).toContain("WHEN 'new-customers' THEN customer.created_at>=now()-interval '30 days'");
    expect(helper).toContain("30 * 24 * 60 * 60 * 1000");
    expect(countFix).toContain("WHEN 'frequent-buyers' THEN coalesce(customer.pos_order_count,0)>=3");
    expect(helper).toContain('query.gte("pos_order_count", 3)');
    expect(countFix).toContain("loyalty.is_perks_member");
    expect(helper).toContain('"customer_loyalty_metrics.is_perks_member", true');
  });

  it("no SMS segment-send surface filters on the email opt_out flag", () => {
    for (const file of [
      "src/components/sms/SegmentSMSDialog.tsx",
      "src/components/sms/SendToSegmentCard.tsx",
      "src/lib/sms/smsAudienceEstimate.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\.eq\(\s*["'](crm_customers\.)?opt_out["']/);
    }
    for (const file of ["src/components/sms/SegmentSMSDialog.tsx", "src/components/sms/SendToSegmentCard.tsx"]) {
      expect(readFileSync(file, "utf8"), file).toContain("fetchSmsSegmentSendEstimate");
    }
  });
});

describe("SMS eligibility parity: estimate, enqueue and send use one rule (qa4 #6)", () => {
  const migration = readFileSync("supabase/migrations/20261124170513_sms_eligible_audience.sql", "utf8");
  const worker = readFileSync("supabase/functions/sms-campaign-enqueue-worker/index.ts", "utf8");

  it("sms_eligible_customers mirrors check_sms_send_eligibility", () => {
    for (const rule of [
      "customer.deleted_at is null",
      "customer.merged_into_customer_id is null",
      "customer.sms_opt_in is true",
      "customer.sms_consent is distinct from false",
      "customer.sms_opt_in_at is not null",
      "nullif(trim(customer.sms_consent_source), '') is not null",
      "length(normalized.digits) = 10",
      "consent.channel = 'sms'",
      "suppression.channel = 'sms'",
      "suppression.lifted_at is null",
    ]) {
      expect(migration).toContain(rule);
    }
  });

  it("excludes suppressed customers everywhere and keeps email opt-out out of SMS (qa4 follow-up)", () => {
    const followUp = readFileSync(
      "supabase/migrations/20261124185955_sms_eligibility_suppressed_single_rule.sql",
      "utf8",
    );
    const countFix = readFileSync(
      "supabase/migrations/20261124190246_sms_campaign_count_frequent_buyers.sql",
      "utf8",
    );
    const personaFix = readFileSync(
      "supabase/migrations/20261124190213_sms_campaign_persona_text_ids.sql",
      "utf8",
    );
    expect(followUp).toContain("and customer.suppressed is not true");
    expect(followUp).toContain("IF v_customer.suppressed IS TRUE THEN");
    for (const sql of [followUp, countFix, personaFix]) {
      expect(sql).not.toContain("customer.opt_out");
      expect(sql).not.toContain("SET search_path TO 'public'");
    }
    // Send Now's count and the persona page read the one set-based rule.
    expect(countFix).toContain("FROM public.sms_eligible_customers(v_campaign.tenant_id) AS eligible");
    expect(personaFix).toContain("FROM public.sms_eligible_customers(v_campaign.tenant_id) AS eligible");
    // targeting_persona_ids is text[]; crm_customers has pos_order_count, not order_count.
    expect(countFix).toContain("assignment.persona_id::text=ANY(v_campaign.targeting_persona_ids)");
    expect(countFix).toContain("coalesce(customer.pos_order_count,0)>=3");
    expect(countFix).not.toContain("coalesce(customer.order_count");
  });

  it("the enqueue worker never queues a customer the rule rejects", () => {
    expect(worker).toContain('"filter_sms_eligible_customer_ids"');
    expect(worker.match(/\.is\("(crm_customers\.)?deleted_at", null\)/g)?.length).toBe(3);
    expect(worker.match(/\.is\("(crm_customers\.)?merged_into_customer_id", null\)/g)?.length).toBe(3);
    expect(worker).toContain("eligibleIdSet.has(c.id)");
  });
});
