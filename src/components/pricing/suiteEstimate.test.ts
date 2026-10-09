import { describe, expect, it } from "vitest";
import { calculateSuiteEstimate as estimate, DEFAULT_SUITE_CONFIGURATION as defaults, normalizeConfiguration, suiteEstimateSummary } from "./suiteEstimate";

describe("draft suite price book", () => {
  it("prices the three entry paths consistently", () => {
    expect(estimate({...defaults, crm: false}).bloom).toBe(7900);
    expect(estimate(defaults).bloom).toBe(24900);
    expect(estimate({...defaults, pos: "replace"}).bloom).toBe(39900);
    expect(estimate({...defaults, pos: "replace", commerce: true}).bloom).toBe(44900);
  });
  it("charges extra locations/registers without duplicating contacts or discount", () => {
    expect(estimate({...defaults, commerce: true, pos: "replace", locations: 2, registers: 3}).bloom).toBe(70600);
    expect(estimate({...defaults, websites: 2}).bloom).toBe(32800);
  });
  it("uses exact contact boundaries and an explicit quote floor", () => {
    expect(estimate({...defaults, contacts: 5000}).bloom).toBe(24900);
    expect(estimate({...defaults, contacts: 5001}).bloom).toBe(34900);
    expect(estimate({...defaults, contacts: 15000}).bloom).toBe(34900);
    expect(estimate({...defaults, contacts: 15001}).bloom).toBe(54900);
    expect(estimate({...defaults, contacts: 25000}).quoteRequired).toBe(false);
    expect(estimate({...defaults, contacts: 25001}).quoteRequired).toBe(true);
  });
  it("counts SMS segments and email overages only for CRM", () => {
    expect(estimate({...defaults, sms: 2000, segments: 2, emails: 40000}).bloom).toBe(38900);
    expect(estimate({...defaults, crm: false, sms: 50000, emails: 500000}).bloom).toBe(7900);
    expect(estimate({...defaults, sms: 50000}).sms).toBe(150000);
  });
  it("discounts annual software but not usage or retained tools", () => {
    const e = estimate({...defaults, commerce: true, pos: "replace", annual: true, sms: 2000, retained: 100});
    expect(e.software).toBe(38165); expect(e.sms).toBe(6000);
    expect(e.annualPrepayment).toBe(457980); expect(e.total).toBe(54165);
  });
  it("includes retained tools in the proposal only, not twice in current spend", () => {
    const e = estimate({...defaults, sms: 2000, retained: 100, current: 400});
    expect(e.total).toBe(40900); expect(e.difference).toBe(900); expect(e.recurringOrders).toBe(1);
  });
  it("reconciles total and first-year costs with payments", () => {
    const e = estimate({...defaults, commerce: true, pos: "replace", sms: 2000, cardVolume: 60000, transactions: 1200, setup: 1500});
    expect(e.payments).toBe(162000); expect(e.total).toBe(212900); expect(e.firstYear).toBe(2704800);
  });
  it("handles empty selection, zero margin, nonfinite and maliciously large inputs", () => {
    expect(estimate({...defaults, site: false, crm: false, pos: "none"}).hasProducts).toBe(false);
    expect(estimate({...defaults, grossMargin: 0}).recurringOrders).toBeNull();
    const e = estimate({...defaults, contacts: Infinity, emails: NaN, retained: -100, locations: 999999});
    expect(Number.isFinite(e.firstYear)).toBe(true); expect(e.c.retained).toBe(0); expect(e.c.locations).toBe(100);
    expect(normalizeConfiguration({...defaults, site: false, commerce: true}).site).toBe(true);
  });
  it("does not bill POS while its need is undecided", () => {
    expect(estimate({...defaults, pos: "unsure"}).bloom).toBe(24900);
  });
  it("uses gross profit and shows savings without fabricated extra orders", () => {
    expect(estimate({...defaults, current: 0}).recurringOrders).toBe(13);
    expect(estimate({...defaults, current: 1000}).recurringOrders).toBe(0);
  });
  it("exports an editable versioned inquiry below the contact form limit", () => {
    const s = suiteEstimateSummary({...defaults, contacts: 50000, pos: "replace", locations: 100, registers: 20});
    expect(s).toContain("suite-exploration-2026-10-09-v1"); expect(s).toContain("not a purchase");
    expect(s).toContain("quote needed"); expect(s.length).toBeLessThan(900);
  });
});
