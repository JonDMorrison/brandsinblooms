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

const code = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);
const typeCode = (s: string) =>
  s.length <= 30 && /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(s);
const safeString = (v: unknown): v is string =>
  typeof v === "string" && !v.includes("\0");
const unsafeSpreadsheetCell = (v: string) =>
  /^[\s]*[=@]/.test(v) || /^[\s]*[+-][^0-9]/.test(v);
const headerText = (header: string) =>
  header
    .trim()
    .replace(/^\uFEFF/, "")
    .toUpperCase();
/** Preserve exact CSV cells and embedded CR/LF; no Excel-style type inference. */
export function parseIdealCustomerCsv(
  source: string,
  maxRows = 100_000,
): IdealCustomerRow[] {
  if (typeof source !== "string" || source.length > 25_000_000)
    throw new Error("Choose a customer export smaller than 25 MB.");
  const cells: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      if (cell.length || closed)
        throw new Error(`Invalid quotation in CSV record ${cells.length + 1}.`);
      quoted = true;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (char !== ",") {
        if (char === "\r" && source[i + 1] === "\n") i++;
        cells.push(row);
        row = [];
        if (cells.length > maxRows + 1)
          throw new Error(
            `Too many rows (limit ${maxRows}). No rows were silently omitted.`,
          );
      }
    } else {
      if (closed)
        throw new Error(
          `Unexpected content after quoted CSV value in record ${cells.length + 1}.`,
        );
      cell += char;
    }
  }
  if (quoted) throw new Error("Unterminated quoted field.");
  if (cell.length || row.length || closed) {
    row.push(cell);
    cells.push(row);
  }
  while (
    cells.length > 0 &&
    cells[cells.length - 1].length === 1 &&
    cells[cells.length - 1][0] === ""
  )
    cells.pop();
  if (cells.length < 2)
    throw new Error("The customer export has no data rows.");
  const headers = cells[0].map(headerText);
  if (
    headers.length !== IDEAL_CUSTOMER_COLUMNS.length ||
    headers.some((h, index) => h !== IDEAL_CUSTOMER_COLUMNS[index])
  ) {
    throw new Error(
      "Customer file must have the confirmed nine fields in their original order: " +
        IDEAL_CUSTOMER_COLUMNS.join(", ") +
        ".",
    );
  }
  const result: IdealCustomerRow[] = [];
  for (const [index, values] of cells.slice(1).entries()) {
    if (values.length !== 9)
      throw new Error(
        `Row ${index + 2} has ${values.length} fields instead of 9. No partial export produced.`,
      );
    if (!code(values[0]))
      throw new Error(
        `Row ${index + 2} has a missing or invalid CODE; leading zeros cannot be inferred.`,
      );
    if (!values.every(safeString))
      throw new Error(`Row ${index + 2} contains an invalid field.`);
    result.push(
      Object.fromEntries(
        IDEAL_CUSTOMER_COLUMNS.map((header, j) => [header, values[j]]),
      ) as IdealCustomerRow,
    );
  }
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
