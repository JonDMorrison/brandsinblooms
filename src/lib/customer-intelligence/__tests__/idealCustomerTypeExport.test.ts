import { describe, expect, it } from "vitest";
import {
  IDEAL_CUSTOMER_COLUMNS,
  parseIdealCustomerCsv,
  reviewIdealCustomerTypeExport,
  draftIdealCustomerTypeCsv,
  type IdealCustomerRow,
} from "../idealCustomerTypeExport";
const make = (CODE: string, TYPE = "REGULAR"): IdealCustomerRow => ({
  CODE,
  LASTNAME: "O'Brien",
  FIRSTNAME: "Mary",
  MOBILE: "+1 604 555 0100",
  EMAIL: "test@example.invalid",
  TYPE,
  MAILOUT: "Y",
  ACCOUNT: "0",
  PRICELEVEL: "2",
});
const mk = (
  rows: IdealCustomerRow[],
  ids = ["crm1"],
  links = [
    { crm_customer_id: "crm1", external_id: "023069", provider: "ideal" },
  ],
  newType = "VIP",
  confirmedExistingTypes = ["REGULAR", "VIP"],
) =>
  reviewIdealCustomerTypeExport({
    originalRows: rows,
    audienceCustomerIds: ids,
    identityLinks: links,
    newType,
    confirmedExistingTypes,
  });
describe("Ideal Customer Types export safety", () => {
  it("preserves leading zeros and untouched source fields", () => {
    const v = mk([make("023069"), make("100232")]);
    expect(v.state).toBe("ready_to_review");
    expect(v.changedCodes).toEqual(["023069"]);
    expect(v.rows[0].CODE).toBe("023069");
    expect(v.rows[1]).toEqual(make("100232"));
    const encoded = draftIdealCustomerTypeCsv(v);
    expect(parseIdealCustomerCsv(encoded)).toEqual(v.rows);
    expect(encoded).toContain('"023069"');
  });
  it("preserves notes and commas in literal CSV data", () => {
    const raw =
      "\uFEFF" +
      IDEAL_CUSTOMER_COLUMNS.join(",") +
      '\r\n"023069","O""Brien, Jr","Mary","+1 604","test@example.invalid","REGULAR","Y","0","2"\r\n';
    const [r] = parseIdealCustomerCsv(raw);
    expect(r.LASTNAME).toBe('O"Brien, Jr');
    expect(r.CODE).toBe("023069");
    expect(draftIdealCustomerTypeCsv(mk([r]))).toContain('"O""Brien, Jr"');
  });
  it("never changes MAILOUT, ACCOUNT, PRICELEVEL, phone, email or the source IDs", () => {
    const r = {
      ...make("023069"),
      MAILOUT: "N",
      ACCOUNT: "ABC-12",
      PRICELEVEL: "04",
    };
    const v = mk([r]);
    expect({ ...v.rows[0], TYPE: r.TYPE }).toEqual(r);
  });
  it("blocks missing source/customer mappings without dropping people", () => {
    const v = mk([make("900")]);
    expect(v.state).toBe("blocked");
    expect(v.unknownCustomerCodes).toEqual(["023069"]);
    expect(() => draftIdealCustomerTypeCsv(v)).toThrow("Fix unmatched");
  });
  it("does not turn names/emails into matching identifiers", () => {
    const v = mk(
      [make("99")],
      ["crm1"],
      [{ crm_customer_id: "crm1", external_id: "99", provider: "other" }],
    );
    expect(v.state).toBe("blocked");
    expect(v.errors.some((s) => s.includes("verified Ideal"))).toBe(true);
  });
  it("prevents duplicate CODE rows and conflicts", () => {
    expect(mk([make("023069"), make("023069")]).state).toBe("blocked");
    const v = mk(
      [make("023069")],
      ["crm1", "crm2"],
      [
        { crm_customer_id: "crm1", external_id: "023069", provider: "ideal" },
        { crm_customer_id: "crm2", external_id: "023069", provider: "ideal" },
      ],
    );
    expect(v.state).toBe("blocked");
  });
  it("refuses unconfirmed type codes and >20 known customer types", () => {
    expect(
      mk(
        [make("023069")],
        ["crm1"],
        [{ crm_customer_id: "crm1", external_id: "023069", provider: "ideal" }],
        "UNVERIFIED",
      ).state,
    ).toBe("blocked");
    expect(
      reviewIdealCustomerTypeExport({
        originalRows: [make("023069")],
        audienceCustomerIds: ["crm1"],
        identityLinks: [
          { crm_customer_id: "crm1", external_id: "023069", provider: "ideal" },
        ],
        newType: "VIP",
        confirmedExistingTypes: Array.from(
          { length: 21 },
          (_, i) => "TYPE" + i,
        ),
      }).state,
    ).toBe("blocked");
  });
  it("does not claim a change when already assigned", () => {
    const v = mk([make("023069", "VIP")]);
    expect(v.rowsAlreadyAssigned).toBe(1);
    expect(v.rowsChanged).toBe(0);
    expect(() => draftIdealCustomerTypeCsv(v)).toThrow("No TYPE changes");
  });
  it.each(["023069,Jane", "023069", '"023069', '023069"BAD', ""])(
    "rejects malformed CSV without partial transformation",
    (suffix) => {
      expect(() =>
        parseIdealCustomerCsv(IDEAL_CUSTOMER_COLUMNS.join(",") + "\n" + suffix),
      ).toThrow();
    },
  );
  it("does not infer lost leading zeros from a numeric code", () => {
    expect(() =>
      parseIdealCustomerCsv(
        IDEAL_CUSTOMER_COLUMNS.join(",") + "\n=23069,A,B,C,D,E,F,G,H",
      ),
    ).toThrow("invalid CODE");
  });
  it("does not flatten quoted embedded newlines in original cells", () => {
    const src =
      IDEAL_CUSTOMER_COLUMNS.join(",") +
      '\n"023069","Mary\nAnn",a,b,c,VIP,Y,0,2';
    expect(parseIdealCustomerCsv(src)[0].LASTNAME).toBe("Mary\nAnn");
  });
  it("blocks formula-like original cells rather than altering source values or exporting an unsafe spreadsheet", () => {
    const suspicious = {
      ...make("023069"),
      LASTNAME: '=HYPERLINK("https://example.invalid","click")',
    };
    const v = mk([suspicious]);
    expect(v.state).toBe("blocked");
    expect(v.errors.some((e) => e.includes("spreadsheet formula"))).toBe(true);
    expect(() => draftIdealCustomerTypeCsv(v)).toThrow();
  });
  it("blocks oversize sources rather than silently truncating", () => {
    expect(() => parseIdealCustomerCsv("x".repeat(25_000_001))).toThrow(
      "25 MB",
    );
  });
});
