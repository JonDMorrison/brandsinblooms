import { describe, expect, it } from "vitest";
import type { IdealCustomerRow } from "../idealCustomerTypeExport";
import { reviewIdealCustomerRefresh } from "../customerRefreshReview";

const row = (CODE: string, overrides: Partial<IdealCustomerRow> = {}): IdealCustomerRow => ({
  CODE, FIRSTNAME: "Alex", LASTNAME: "Garden", EMAIL: "alex@example.com",
  MOBILE: "6045550111", TYPE: "VIP", MAILOUT: "N", ACCOUNT: "A1", PRICELEVEL: "01",
  ...overrides,
});

describe("IdealPOS customer refresh review", () => {
  it("matches exact customer CODE, preserving leading zeroes", () => {
    const result = reviewIdealCustomerRefresh(
      [row("0001"), row("0002")],
      [row("0001", { MOBILE: "6045550222" }), row("0002")],
    );
    expect(result.changed).toBe(1);
    expect(result.contactChanges).toBe(1);
    expect(result.changes[0]).toMatchObject({
      code: "0001", fields: ["MOBILE"], requiresReview: true,
    });
  });
  it("never treats blank refreshed values as a deletion", () => {
    const result = reviewIdealCustomerRefresh(
      [row("0001")], [row("0001", { EMAIL: "", MOBILE: "", FIRSTNAME: "" })],
    );
    expect(result.unchanged).toBe(1);
    expect(result.contactChanges).toBe(0);
  });
  it("flags TYPE, MAILOUT, account and price level changes without writing", () => {
    const result = reviewIdealCustomerRefresh(
      [row("0001")],
      [row("0001", { TYPE: "OTHER", MAILOUT: "Y", ACCOUNT: "B2", PRICELEVEL: "02" })],
    );
    expect(result.classificationChanges).toBe(1);
    expect(result.protectedFieldChanges).toBe(1);
    expect(result.changes[0].requiresReview).toBe(true);
  });
  it("does not interpret a missing customer as deletion or merge", () => {
    const result = reviewIdealCustomerRefresh(
      [row("0001"), row("0002")],
      [row("0001"), row("0003")],
    );
    expect(result.added).toBe(1);
    expect(result.missingFromCurrent).toBe(1);
    expect(result.changes.map((d) => d.code)).toEqual(["0003", "0002"]);
  });
  it("blocks ambiguous CODE identities before proposing differences", () => {
    const result = reviewIdealCustomerRefresh(
      [row("0001"), row("0001")], [row("0001", { FIRSTNAME: "Jamie" })],
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.changed).toBe(0);
  });
});
