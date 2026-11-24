/**
 * West Coast Gardens / IdealPOS — reviewed outbound TYPE update files.
 * Never guesses source fields, infers newsletter consent or sends a POS write.
 * TYPE is the ONLY field allowed to change. Import semantics require Ideal review.
 */
export const IDEAL_CUSTOMER_COLUMNS = [
  "CODE",
  "LASTNAME",
  "FIRSTNAME",
  "MOBILE",
  "EMAIL",
  "TYPE",
  "MAILOUT",
  "ACCOUNT",
  "PRICELEVEL",
] as const;
export type IdealCustomerField = (typeof IDEAL_CUSTOMER_COLUMNS)[number];
export type IdealCustomerRow = Record<IdealCustomerField, string>;
export type IdealIdentityLink = {
  crm_customer_id: string;
  external_id: string;
  provider: string;
};

export type IdealExportPreview = {
  state: "ready_to_review" | "blocked";
  sourceRows: number;
  selectedCustomers: number;
  matchedCustomers: number;
  rowsChanged: number;
  rowsAlreadyAssigned: number;
  errors: string[];
  unknownCustomerCodes: string[];
  oldTypeCounts: Record<string, number>;
  newType: string;
  changedCodes: string[];
  rows: IdealCustomerRow[];
};

// Explicit, verified IdealPOS full Customer Details export layout. Never persist
// the other 42 fields (including credentials and financial details).
export const IDEAL_FULL_CUSTOMER_COLUMNS = "CODE,LASTNAME,FIRSTNAME,MIDDLENAME,TITLE,ADDRESS1,ADDRESS2,SUBURB,STATE,POSTCODE,PHONE,MOBILE,FAX,EMAIL,GENDER,COMPANY,OCCUPATION,MARITALSTATUS,DOB,DOB2,NEXTOFKIN,CONTACTNO,COMMENTS1,COMMENTS2,TYPE,PASSWORD,MAILOUT,ACCOUNT,CREDITLIMIT,PRICELEVEL,ABN,POINTS,SCAN,SALESPROMPT,UDTEXT1,UDTEXT2,UDTEXT3,UDTEXT4,UDTEXT5,UDTEXT6,UDTEXT7,UDTEXT8,UDTEXT9,UDTEXT10,UDYESNO1,UDYESNO2,UDYESNO3,UDYESNO4,UDYESNO5,AUTODISCOUNT,OTHERCODES".split(",");
const typeCode = (s: string) =>
  s.length <= 30 && /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(s);
const safeString = (v: unknown): v is string =>
  typeof v === "string" && !v.includes("\0");
const unsafeSpreadsheetCell = (v: string) =>
  /^[\s]*[=@]/.test(v) || /^[\s]*[+-][^0-9]/.test(v);
// CODE is opaque text: do not strip leading zeros or rewrite legacy punctuation.
const code = (s: string) =>
  s.length >= 1 && s.length <= 64 && s === s.trim() &&
  /^[\x20-\x7e]+$/.test(s) && !unsafeSpreadsheetCell(s) &&
  !/^[+-]/.test(s);
const headerText = (header: string) =>
  header.trim().replace(/^\uFEFF/, "").toUpperCase();

export function decodeIdealCustomerBytes(bytes: ArrayBuffer): string {
  if (bytes.byteLength > 25_000_000) throw new Error("Choose a customer export smaller than 25 MB.");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Original IdealPOS exports can be Windows-1252, unlike the UTF-8 review CSV.
    const text = new TextDecoder("windows-1252", { fatal: true }).decode(bytes);
    const first = text.split(/\r?\n/, 1)[0]?.replace(/"/g, "").split(",").map(headerText);
    if (!first || first.length !== IDEAL_FULL_CUSTOMER_COLUMNS.length ||
        first.some((column, i) => column !== IDEAL_FULL_CUSTOMER_COLUMNS[i])) {
      throw new Error("The file is not a verified original IdealPOS export or UTF-8 review CSV.");
    }
    return text;
  }
}
/** Accept only the two verified layouts. Project the nine allowed fields row by
 * row so private extra columns never enter the returned records or remote state.
 * Preserve exact CSV cells and embedded CR/LF; no spreadsheet type inference. */
export function parseIdealCustomerCsv(source: string, maxRows = 100_000): IdealCustomerRow[] {
  if (typeof source !== "string" || source.length > 25_000_000)
    throw new Error("Choose a customer export smaller than 25 MB.");
  let row: string[] = [], cell = "", quoted = false, closed = false;
  let headers: string[] | null = null, projection: number[] = [], record = 0;
  const result: IdealCustomerRow[] = [];
  const acceptRow = (values: string[]) => {
    record++;
    if (!headers) {
      headers = values.map(headerText);
      const exact = (expected: readonly string[]) => headers!.length === expected.length &&
        headers!.every((h, index) => h === expected[index]);
      if (!exact(IDEAL_CUSTOMER_COLUMNS) && !exact(IDEAL_FULL_CUSTOMER_COLUMNS))
        throw new Error("Choose the original 51-column IdealPOS Customer Details export or the confirmed nine-column review CSV in its original order.");
      projection = IDEAL_CUSTOMER_COLUMNS.map(h => headers!.indexOf(h));
      return;
    }
    if (values.length !== headers.length) throw new Error("Row " + record + " has the wrong number of fields. No partial export produced.");
    if (result.length >= maxRows) throw new Error("Too many rows. No rows were silently omitted.");
    const fields = projection.map(index => values[index]);
    if (!code(fields[0])) throw new Error("Row " + record + " has a missing or invalid CODE; leading zeros cannot be inferred.");
    if (!fields.every(safeString)) throw new Error("Row " + record + " contains an invalid field.");
    result.push(Object.fromEntries(IDEAL_CUSTOMER_COLUMNS.map((h, i) => [h, fields[i]])) as IdealCustomerRow);
  };
  let pendingBlank = 0;
  const finish = () => {
    row.push(cell); cell = ""; closed = false;
    if (row.length === 1 && row[0] === "" && headers) {
      pendingBlank++;
    } else {
      if (pendingBlank) throw new Error("Unexpected blank record inside customer export.");
      acceptRow(row);
    }
    row = [];
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"') {
      if (cell.length || closed) throw new Error("Invalid quotation in CSV record " + (record + 1) + ".");
      quoted = true;
    } else if (char === ",") {
      row.push(cell); cell = ""; closed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      finish();
    } else {
      if (closed) throw new Error("Unexpected content after quoted CSV value in record " + (record + 1) + ".");
      cell += char;
    }
  }
  if (quoted) throw new Error("Unterminated quoted field.");
  if (cell.length || row.length || closed) finish();
  if (!result.length) throw new Error("The customer export has no data rows.");
  return result;
}
export function reviewIdealCustomerTypeExport(input: {
  originalRows: IdealCustomerRow[];
  audienceCustomerIds: string[];
  identityLinks: IdealIdentityLink[];
  newType: string;
  confirmedExistingTypes?: string[];
}): IdealExportPreview {
  const { originalRows, audienceCustomerIds, identityLinks } = input;
  const errors: string[] = [];
  if (!typeCode(input.newType))
    errors.push(
      "TYPE must match an existing, verified Ideal Customer Type code.",
    );
  const knownTypes = input.confirmedExistingTypes?.length
    ? input.confirmedExistingTypes
    : [...new Set(originalRows.map((r) => r.TYPE).filter(Boolean))];
  if (new Set(knownTypes).size > 20)
    errors.push(
      "The supplied type catalogue exceeds the 20-type IdealPOS limit and needs reconciliation.",
    );
  if (!knownTypes.includes(input.newType))
    errors.push(
      "The proposed Customer Type is not in the confirmed existing type list. Do not create or guess one.",
    );
  if (!audienceCustomerIds.length)
    errors.push("Choose a nonempty, saved customer audience.");
  if (audienceCustomerIds.length > 100_000)
    errors.push("Audience exceeds the 100,000-customer review limit.");
  if (new Set(audienceCustomerIds).size !== audienceCustomerIds.length)
    errors.push("Audience contains duplicate CRM identities.");
  if (!originalRows.length || originalRows.length > 100_000)
    errors.push("The original Ideal customer file is empty or oversized.");

  const byCode = new Map<string, IdealCustomerRow>();
  for (const r of originalRows) {
    if (
      IDEAL_CUSTOMER_COLUMNS.some((c) => !safeString(r[c])) ||
      !code(r.CODE)
    ) {
      errors.push(
        "Original customer export contains invalid or missing CODE/field values.",
      );
      break;
    }
    if (IDEAL_CUSTOMER_COLUMNS.some((c) => unsafeSpreadsheetCell(r[c])))
      errors.push(
        `A source field for customer CODE ${r.CODE} could execute as a spreadsheet formula. Review the original file instead of silently rewriting it.`,
      );
    if (byCode.has(r.CODE))
      errors.push(
        `Duplicate Ideal customer CODE ${r.CODE}; file requires review.`,
      );
    byCode.set(r.CODE, r);
  }
  const selected = new Set(audienceCustomerIds);
  const mapped = new Map<string, string>();
  for (const link of identityLinks) {
    if (link.provider !== "ideal" || !selected.has(link.crm_customer_id))
      continue;
    if (!code(link.external_id)) {
      errors.push(
        `Invalid Ideal customer CODE mapping for CRM customer ${link.crm_customer_id}.`,
      );
      continue;
    }
    const prior = mapped.get(link.external_id);
    if (prior && prior !== link.crm_customer_id)
      errors.push(
        `Ideal customer CODE ${link.external_id} maps to multiple CRM identities.`,
      );
    mapped.set(link.external_id, link.crm_customer_id);
  }
  const mappedCrmIds = new Set(mapped.values());
  const missingIdentityLinks = [...selected].filter(
    (id) => !mappedCrmIds.has(id),
  );
  if (missingIdentityLinks.length)
    errors.push(
      `${missingIdentityLinks.length} selected CRM customers have no verified Ideal customer code.`,
    );
  const missingSourceCodes = [...mapped.keys()].filter((id) => !byCode.has(id));
  if (missingSourceCodes.length)
    errors.push(
      `${missingSourceCodes.length} selected Ideal codes were not found in the original customer file.`,
    );
  const oldTypeCounts: Record<string, number> = {};
  const changedCodes: string[] = [];
  let rowsAlreadyAssigned = 0;
  const rows = originalRows.map((row) => {
    if (!mapped.has(row.CODE)) return { ...row };
    oldTypeCounts[row.TYPE] = (oldTypeCounts[row.TYPE] ?? 0) + 1;
    if (row.TYPE === input.newType) {
      rowsAlreadyAssigned++;
      return { ...row };
    }
    changedCodes.push(row.CODE);
    return { ...row, TYPE: input.newType };
  });
  const matchedCustomers = [...mapped.keys()].filter((id) =>
    byCode.has(id),
  ).length;
  if (matchedCustomers !== selected.size)
    errors.push(
      `Source file match: ${matchedCustomers} of ${selected.size} unique selected CRM customers; investigate before exporting.`,
    );
  return {
    state: errors.length ? "blocked" : "ready_to_review",
    sourceRows: originalRows.length,
    selectedCustomers: selected.size,
    matchedCustomers,
    rowsChanged: changedCodes.length,
    rowsAlreadyAssigned,
    errors: [...new Set(errors)],
    unknownCustomerCodes: missingSourceCodes,
    oldTypeCounts,
    newType: input.newType,
    changedCodes,
    rows,
  };
}
/** Export the WHOLE source file, changing TYPE only on verified selected codes.
 * Never omit nonselected customers, so import/update semantics can be reviewed.
 * This is a draft until Ideal support confirms its import behaviour.
 */
export function draftIdealCustomerTypeCsv(preview: IdealExportPreview): string {
  if (preview.state !== "ready_to_review")
    throw new Error(
      "Fix unmatched customers and validation errors before exporting.",
    );
  if (!preview.rowsChanged) throw new Error("No TYPE changes to export.");
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
  return (
    [
      IDEAL_CUSTOMER_COLUMNS.join(","),
      ...preview.rows.map((row) =>
        IDEAL_CUSTOMER_COLUMNS.map((k) => quote(row[k])).join(","),
      ),
    ].join("\r\n") + "\r\n"
  );
}
