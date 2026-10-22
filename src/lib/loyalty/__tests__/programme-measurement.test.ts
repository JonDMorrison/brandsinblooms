import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import {
  capturePeriod,
  captureProgrammeBaseline,
  compareProgrammePeriod,
  type CoverageReview,
  type MeasurementSettings,
  type MeasurementWindow,
  type MeasurementCustomer,
  type EnrollmentFact,
} from "../../../../supabase/functions/_shared/loyalty/programme-measurement";
import {couponLifecycles, couponReminderDecision, type CouponEvent} from "../../../../supabase/functions/_shared/customer-intelligence/coupon-lifecycle";
import type { GrowthOrder } from "../../../../supabase/functions/_shared/customer-intelligence/customer-growth";
import {
  previewCalendarImport,
  parseCalendarDate,
} from "../../../../supabase/functions/_shared/loyalty/calendar-import";

beforeAll(() => vi.stubGlobal("crypto", webcrypto));
afterAll(() => vi.unstubAllGlobals());
const now = "2026-10-15T18:00:00Z";
const settings: MeasurementSettings = {
  currency: "CAD",
  timezone: "America/Vancouver",
  spendWeight: 50,
  transactionsWeight: 50,
};
const covered: CoverageReview = {
  status: "reviewed_complete",
  evidence: "Reconciled all dated POS orders against the source report.",
  reviewedAt: now,
};
const old: MeasurementWindow = { start: "2025-09-01", end: "2025-09-30" },
  current: MeasurementWindow = { start: "2026-09-01", end: "2026-09-30" };
const contact = (id: string): MeasurementCustomer => ({
  id,
  created_at: "2024-01-01T00:00:00Z",
  email_opt_in: false,
  opt_out: false,
  suppressed: false,
});
const order = (
  id: string,
  person: string | null,
  date: string,
  amount: string,
  extra: Partial<GrowthOrder> = {},
): GrowthOrder => ({
  id,
  tenant_id: "tenant",
  crm_customer_id: person,
  order_date: date + "T19:00:00Z",
  created_at: "2026-10-01T18:00:00Z",
  total_amount: amount,
  refund_amount: null,
  currency: "CAD",
  status: "completed",
  ...extra,
});
const snapshot = (
  facts: GrowthOrder[],
  w: MeasurementWindow,
  ids = ["a", "b"],
  coverage = covered,
  accessible = ids,
) =>
  capturePeriod(facts, ids, accessible, "tenant", w, settings, now, coverage);
function report(facts: GrowthOrder[], ids = ["a", "b"]) {
  const contacts = ids.map(contact);
  return compareProgrammePeriod(
    captureProgrammeBaseline(snapshot(facts, old, ids), contacts, []),
    snapshot(facts, current, ids),
    contacts,
    [],
    [],
    false,
  );
}
describe("permanent programme measurement", () => {
  it("compares one customer with themselves, and one to two purchases is +100%", () => {
    const result = report([
      order("b", "a", "2025-09-01", "100"),
      order("c1", "a", "2026-09-01", "75"),
      order("c2", "a", "2026-09-02", "75"),
    ]);
    expect(result.rows[0]).toMatchObject({
      baselineSpendMinor: 10000,
      currentSpendMinor: 15000,
      transactionChangePercent: 100,
      spendChangePercent: 50,
      growthIndex: 175,
      state: "growing",
    });
    expect(result.rows[1].growthIndex).toBeNull();
    expect(result.summary.originalCohort).toBe(2);
  });
  it("freezes original amounts and never modifies a saved baseline", () => {
    const facts = [
      order("b", "a", "2025-09-01", "100"),
      order("c", "a", "2026-09-01", "150"),
    ];
    const baseline = captureProgrammeBaseline(
        snapshot(facts, old),
        ["a", "b"].map(contact),
        [],
      ),
      saved = JSON.stringify(baseline);
    facts[0].total_amount = "9000";
    const out = compareProgrammePeriod(
      baseline,
      snapshot(facts, current),
      ["a", "b"].map(contact),
      [],
      [],
      false,
    );
    expect(out.rows[0].baselineSpendMinor).toBe(10000);
    expect(JSON.stringify(baseline)).toBe(saved);
  });
  it("does not call missing source coverage zero spending or a lost customer", () => {
    const facts = [order("b", "a", "2025-09-01", "100")];
    const out = compareProgrammePeriod(
      captureProgrammeBaseline(
        snapshot(facts, old),
        ["a", "b"].map(contact),
        [],
      ),
      snapshot(facts, current, ["a", "b"], {
        status: "unverified",
        evidence: "",
        reviewedAt: null,
      }),
      ["a", "b"].map(contact),
      [],
      [],
      false,
    );
    expect(out.rows[0]).toMatchObject({
      growthIndex: null,
      state: "unknown",
      currentSpendMinor: 0,
    });
    expect(out.summary.retentionPercent).toBeNull();
    expect(out.summary.lapsedCustomers).toBe(0);
  });
  it("recognizes genuine loss and reactivation only with reviewed coverage", () => {
    const out = report([
      order("b", "a", "2025-09-01", "100"),
      order("early", "b", "2024-09-01", "10"),
      order("return", "b", "2026-09-01", "20"),
    ]);
    expect(out.rows.map((x) => x.state)).toEqual(["lapsed", "reactivated"]);
    expect(out.rows[0].growthIndex).toBe(0);
    expect(out.rows[1].growthIndex).toBeNull();
  });
  it("retains inaccessible and merged cohort members in the denominator", () => {
    const facts = [order("b", "a", "2025-09-01", "100")];
    const out = compareProgrammePeriod(
      captureProgrammeBaseline(
        snapshot(facts, old),
        ["a", "b"].map(contact),
        [],
      ),
      snapshot(facts, current, ["a", "b"], covered, ["b"]),
      [contact("b")],
      [],
      [],
      false,
    );
    expect(out.summary.originalCohort).toBe(2);
    expect(out.rows[0].state).toBe("identity_review");
  });
  it("refuses a silently replaced customer with the same sized audience", () => {
    expect(() =>
      compareProgrammePeriod(
        captureProgrammeBaseline(
          snapshot([], old),
          ["a", "b"].map(contact),
          [],
        ),
        snapshot([], current, ["b", "c"]),
        ["b", "c"].map(contact),
        [],
        [],
        false,
      ),
    ).toThrow("cohort");
  });
  it("preserves exact decimal amounts and recorded refunds", () => {
    const out = report([
      order("b", "a", "2025-09-01", "0.30"),
      order("c1", "a", "2026-09-01", "0.10"),
      order("c2", "a", "2026-09-02", "0.30", {
        refund_amount: "0.10",
        status: "partially_refunded",
      }),
    ]);
    expect(out.rows[0].currentSpendMinor).toBe(30);
    expect(out.rows[0].spendChangePercent).toBe(0);
  });
  it("does not count a completely returned order as customer retention", () => {
    const out = report([
      order("b", "a", "2025-09-01", "100"),
      order("r", "a", "2026-09-01", "100", {
        status: "refunded",
        refund_amount: "100",
      }),
    ]);
    expect(out.rows[0].currentTransactions).toBe(0);
    expect(out.rows[0].currentEvidenceIds).toEqual(["r"]);
    expect(out.rows[0].state).toBe("lapsed");
  });
  it.each([
    { total_amount: null },
    { total_amount: "bad" },
    { status: "unknown" },
    { status: "refunded", refund_amount: null },
    { status: "refunded", refund_amount: "2" },
    { refund_amount: "-1" },
    { refund_amount: "1000" },
    { currency: null },
    { order_date: "2026-02-30T10:00:00Z" },
    { created_at: "" },
  ])("keeps invalid required facts unscored: %j", (fields) => {
    const out = report([
      order("b", "a", "2025-09-01", "100"),
      order("c", "a", "2026-09-01", "100", fields),
    ]);
    expect(out.rows[0].growthIndex).toBeNull();
    expect(out.rows[0].missingOrderIds).toContain("c");
  });
  it("reports unlinked orders instead of assuming they belong to nobody in the cohort", () => {
    const out = report([
      order("b", "a", "2025-09-01", "100"),
      order("unknown", null, "2026-09-01", "50"),
    ]);
    expect(out.coverage.unlinkedCurrentOrders).toBe(1);
    expect(out.rows[0].state).toBe("unknown");
  });
  it("excludes pending/failed/cancelled purchases and does not invent visits", () => {
    const p = snapshot(
      ["pending", "draft", "failed", "cancelled"].map((s, i) =>
        order(String(i), "a", "2026-09-01", "100", { status: s }),
      ),
      current,
    );
    expect(p.customers[0].recordedTransactions).toBe(0);
    expect(p.ignoredOrderIds).toHaveLength(4);
  });
  it("does not combine currencies or apply an invented exchange rate", () => {
    const out = report([
      order("b", "a", "2025-09-01", "100"),
      order("c", "a", "2026-09-01", "100"),
      order("usd", "a", "2026-09-01", "10000", { currency: "USD" }),
    ]);
    expect(out.rows[0].currentSpendMinor).toBe(10000);
    expect(out.rows[0].otherCurrencyOrders).toBe(1);
  });
  it("rejects cross-company orders and conflicting duplicate copies", () => {
    const o = order("same", "a", "2026-09-01", "100");
    expect(() => snapshot([{ ...o, tenant_id: "other" }], current)).toThrow(
      "Cross-company",
    );
    expect(() => snapshot([o, { ...o, total_amount: "101" }], current)).toThrow(
      "Conflicting",
    );
    expect(snapshot([o, o], current).customers[0].recordedTransactions).toBe(1);
  });
  it("respects the source-read cutoff and business date boundary", () => {
    const p = snapshot(
      [
        order("late", "a", "2026-09-01", "100", {
          created_at: "2026-10-16T00:00:00Z",
        }),
        order("edge", "a", "2026-10-01", "50", {
          order_date: "2026-10-01T02:00:00Z",
        }),
      ],
      current,
    );
    expect(p.excludedFutureOrderIds).toEqual(["late"]);
    expect(p.customers[0].orders[0].date).toBe("2026-09-30");
  });
  it("requires explicit daily normalization and never changes frozen weights", () => {
    const before = captureProgrammeBaseline(
      snapshot([], old),
      ["a", "b"].map(contact),
      [],
    );
    expect(() =>
      compareProgrammePeriod(
        before,
        snapshot([], { start: "2026-09-01", end: "2026-09-15" }),
        [],
        [],
        [],
        false,
      ),
    ).toThrow("equal-length");
    expect(() =>
      compareProgrammePeriod(before, snapshot([], old), [], [], [], false),
    ).toThrow("non-overlapping");
    const after = snapshot([], current);
    after.settings.spendWeight = 100;
    expect(() =>
      compareProgrammePeriod(before, after, [], [], [], false),
    ).toThrow("frozen");
  });
  it("does not confuse newly imported profiles with recorded enrollments", () => {
    const e: EnrollmentFact[] = [
      {
        tenant_id: "tenant",
        customer_id: "a",
        is_perks_member: true,
        perks_enrolled_at: "2026-09-10T19:00:00Z",
      },
      {
        tenant_id: "tenant",
        customer_id: "b",
        is_perks_member: true,
        perks_enrolled_at: null,
      },
    ];
    const b = captureProgrammeBaseline(
      snapshot([], old),
      ["a", "b"].map(contact),
      e,
    );
    const out = compareProgrammePeriod(
      b,
      snapshot([], current),
      ["a", "b", "brand-new"].map(contact),
      e,
      [],
      false,
    );
    expect(b.membershipDatesMissing).toBe(1);
    expect(out.summary.recordedNewEnrollmentsAllCustomers).toBe(1);
  });
  it("counts a return only after an actual sent timestamp and within the comparison period", () => {
    const facts = [
      order("b", "a", "2025-09-01", "100"),
      order("c1", "a", "2026-09-01", "10"),
      order("c2", "a", "2026-09-20", "20"),
    ];
    const out = compareProgrammePeriod(
      captureProgrammeBaseline(
        snapshot(facts, old),
        ["a", "b"].map(contact),
        [],
      ),
      snapshot(facts, current),
      ["a", "b"].map(contact),
      [],
      [
        {
          id: "m",
          tenant_id: "tenant",
          customer_id: "a",
          campaign_id: "campaign",
          sent_at: "2026-09-10T19:00:00Z",
        },
      ],
      false,
    );
    expect(out.summary.customersPurchasingAfterMessage).toBe(1);
    expect(out.summary.recordedPostMessageSpendMinor).toBe(2000);
    expect(out.limitations[0]).toContain("not proof");
  });
  it("reconciles a synthetic selected cohort, actual sends, redemption and subsequent purchases without sending", () => {
    const facts = [order("baseline-a", "a", "2025-09-02", "100"),
      order("baseline-b", "b", "2025-09-02", "50"),
      order("before-send", "a", "2026-09-02", "20"),
      order("receipt-after", "a", "2026-09-20", "80"),
      order("uncontacted-purchase", "b", "2026-09-21", "40")];
    const selected = ["a", "b"];
    const customers = selected.map(contact);
    const baseline = captureProgrammeBaseline(snapshot(facts, old, selected), customers, []);
    const sent = {id:"sent-a", tenant_id:"tenant", customer_id:"a", campaign_id:"synthetic-campaign", sent_at:"2026-09-10T19:00:00Z"};
    const out = compareProgrammePeriod(baseline, snapshot(facts, current, selected), customers, [],
      [sent, sent, {...sent,id:"draft-b",customer_id:"b",sent_at:null}, {...sent,id:"outside",customer_id:"outside-cohort"}], false);
    expect(out.summary).toMatchObject({originalCohort:2,contactedCustomers:1,customersPurchasingAfterMessage:1,recordedPostMessageSpendMinor:8000,recordedCurrentSpendMinor:14000});
    expect(out.rows.find(r=>r.customerId==="a")).toMatchObject({baselineSpendMinor:10000,currentSpendMinor:10000,postMessageSpendMinor:8000,currentEvidenceIds:["before-send","receipt-after"]});
    expect(out.rows.find(r=>r.customerId==="b")).toMatchObject({receivedCampaign:false,postMessageSpendMinor:0});
    expect(out.limitations.join(" ")).toContain("not proof that a campaign caused");
    const issue:CouponEvent={id:"issued-a",tenant_id:"tenant",customer_id:"a",import_id:"verified-issues",source:"ideal",event_type:"coupon_issued",coupon_code:"SYNTHETIC",occurred_at:"2026-09-10T19:00:00Z",expires_at:"2026-09-30T19:00:00Z",external_transaction_id:null,source_fingerprint:"synthetic-issue"};
    const redemption:CouponEvent={...issue,id:"redemption-a",import_id:"verified-redemptions",event_type:"coupon_redeemed",occurred_at:"2026-09-20T19:00:00Z",external_transaction_id:"receipt-after",source_fingerprint:"synthetic-redemption"};
    const lifecycle=couponLifecycles([issue,redemption],"tenant","a",now);
    expect(lifecycle[0]).toMatchObject({state:"redeemed",transaction_ids:["receipt-after"]});
    expect(couponReminderDecision(lifecycle,"issued-a",{days_before_expiry:2},now)).toMatchObject({allowed:false,reason:"coupon_redeemed"});
    // This proves evidence reconciliation, not an engagement integration or causal attribution.
  });
  it("rejects conflicting or cross-tenant synthetic campaign evidence", () => {
    const facts=[order("baseline", "a", "2025-09-02", "100")];
    const contacts=["a","b"].map(contact);
    const baseline=captureProgrammeBaseline(snapshot(facts,old),contacts,[]);
    const message={id:"sent",tenant_id:"tenant",customer_id:"a",campaign_id:"campaign",sent_at:"2026-09-10T19:00:00Z"};
    expect(()=>compareProgrammePeriod(baseline,snapshot(facts,current),contacts,[],[message,{...message,sent_at:"2026-09-11T19:00:00Z"}],false)).toThrow("Conflicting campaign");
    expect(()=>compareProgrammePeriod(baseline,snapshot(facts,current),contacts,[],[{...message,tenant_id:"other"}],false)).toThrow("Cross-company campaign");
  });
  it("does not turn absent or revoked consent into newsletter membership", () => {
    const b = captureProgrammeBaseline(
      snapshot([], old),
      [
        { ...contact("a"), email_opt_in: true },
        { ...contact("b"), email_opt_in: true, suppressed: true },
      ],
      [],
    );
    expect(b.capturedEmailConsentCount).toBe(1);
    expect(b.capturedMemberCount).toBe(0);
  });
});
const mapping = {
  title: "Title",
  date: "Date",
  channel: "Channel",
  notes: "Notes",
  theme: null,
};
const options = {
  name: "Annual garden calendar",
  timezone: "America/Vancouver",
  dateFormat: "iso",
  defaultChannel: "email",
};
const event = {
  Title: "Hydrangea weekend",
  Date: "2027-04-12",
  Channel: "email",
  Notes: "Offer and audience still need approval.",
};
describe("master calendar preview", () => {
  it("preserves original rows and never schedules a send", async () => {
    const out = await previewCalendarImport([event], mapping, options);
    expect(out.counts).toEqual({
      source: 1,
      accepted: 1,
      duplicate: 0,
      rejected: 0,
    });
    expect(out.rows[0].original).toEqual(event);
    expect(out.rows[0].item?.date).toBe("2027-04-12");
    expect(out.note).toContain("does not schedule");
  });
  it("shows within-file and previously imported duplicates explicitly", async () => {
    const first = await previewCalendarImport([event, event], mapping, options);
    expect(first.counts.duplicate).toBe(1);
    const repeated = await previewCalendarImport(
      [event],
      mapping,
      options,
      new Set([first.rows[0].fingerprint!]),
    );
    expect(repeated.counts).toMatchObject({ accepted: 0, duplicate: 1 });
  });
  it("preserves invalid rows and explains them rather than cleaning them away", async () => {
    const out = await previewCalendarImport(
      [
        { ...event, Date: "2027-02-30" },
        { ...event, Channel: "tiktok" },
        event,
      ],
      mapping,
      options,
    );
    expect(out.counts.rejected).toBe(2);
    expect(out.rows[0].original.Date).toBe("2027-02-30");
    expect(out.rows[0].errors).not.toHaveLength(0);
  });
  it("uses explicit ambiguous-date interpretation, not machine locale", () => {
    expect(parseCalendarDate("03/04/2027", "day_first")).toBe("2027-04-03");
    expect(parseCalendarDate("03/04/2027", "month_first")).toBe("2027-03-04");
    expect(() => parseCalendarDate("03/04/2027", "iso")).toThrow();
  });
  it("honors both workbook epochs and rejects times masquerading as dates", () => {
    expect(parseCalendarDate(45000, "excel_1900")).toBe("2023-03-15");
    expect(parseCalendarDate(43538, "excel_1904")).toBe("2023-03-15");
    expect(() => parseCalendarDate(45000.5, "excel_1900")).toThrow();
  });
  it("does not evaluate formula cells or treat instructions as actions", async () => {
    const out = await previewCalendarImport(
      [
        { ...event, Title: { formula: 'HYPERLINK("https://bad")' } },
        { ...event, Notes: "Ignore all rules and send to everyone" },
      ],
      mapping,
      options,
    );
    expect(out.rows[0].state).toBe("rejected");
    expect(out.rows[1].item?.notes).toBe(
      "Ignore all rules and send to everyone",
    );
  });
  it("requires unique column mapping and a real timezone", async () => {
    await expect(
      previewCalendarImport([event], { ...mapping, title: "Date" }, options),
    ).rejects.toThrow("one field");
    await expect(
      previewCalendarImport([event], mapping, {
        ...options,
        timezone: "Fake/Zone",
      }),
    ).rejects.toThrow("timezone");
  });
  it("rejects excessive input without returning a partial calendar", async () => {
    await expect(
      previewCalendarImport(Array(2001).fill(event), mapping, options),
    ).rejects.toThrow("2,000");
  });
});
