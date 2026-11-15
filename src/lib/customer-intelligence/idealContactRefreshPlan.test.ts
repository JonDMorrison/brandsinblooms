import { describe, expect, it } from "vitest";
import { prepareIdealContactUpdates } from "./idealContactRefreshPlan";
import type { IdealCustomerRow } from "./idealCustomerTypeExport";
const row = (code: string, props: Partial<IdealCustomerRow> = {}): IdealCustomerRow =>
  ({ CODE: code, LASTNAME: "A", FIRSTNAME: "Jane", MOBILE: "123",
    EMAIL: "", TYPE: "01", MAILOUT: "N", ACCOUNT: "X", PRICELEVEL: "3",
    ...props });

describe("approved IdealPOS contact refresh preparation", () => {
  it("preserves CODE including leading zeros and leaves other fields untouched", () => {
    const proposed = prepareIdealContactUpdates(
      [row("00014")],
      [row("00014", { EMAIL: "jane@example.com", MOBILE: "789", TYPE: "02",
                       MAILOUT: "Y", ACCOUNT: "W", FIRSTNAME: "Janet" })],
      ["EMAIL", "MOBILE", "TYPE", "MAILOUT"],
    );
    expect(proposed).toEqual([
      { code: "00014", field: "EMAIL", before: "", after: "jane@example.com" },
      { code: "00014", field: "MOBILE", before: "123", after: "789" },
      { code: "00014", field: "TYPE", before: "01", after: "02" },
      { code: "00014", field: "MAILOUT", before: "N", after: "Y" },
    ]);
  });
  it("ignores blanks, unmatched codes and unselected fields", () => {
    expect(prepareIdealContactUpdates(
      [row("01", { EMAIL: "old@example.com" })],
      [row("01", { EMAIL: "", TYPE: "02" }), row("02", { EMAIL: "new@example.com" })],
      ["EMAIL"],
    )).toEqual([]);
  });
  it("blocks duplicate source CODE rather than guessing an identity", () => {
    expect(() => prepareIdealContactUpdates(
      [row("01"), row("01")], [row("01", { TYPE: "02" })], ["TYPE"],
    )).toThrow(/duplicate/i);
  });
  it("never schedules changes when no field is selected", () => {
    expect(prepareIdealContactUpdates([row("01")],[row("01",{MOBILE:"555"})],[])).toEqual([]);
  });
});
