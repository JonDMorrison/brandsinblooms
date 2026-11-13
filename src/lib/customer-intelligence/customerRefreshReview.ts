import type { IdealCustomerRow } from "./idealCustomerTypeExport";

export type RefreshDifference = {
  code: string;
  fields: string[];
  requiresReview: boolean;
};
export type CustomerRefreshReview = {
  priorCount: number;
  currentCount: number;
  unchanged: number;
  changed: number;
  added: number;
  missingFromCurrent: number;
  contactChanges: number;
  nameChanges: number;
  classificationChanges: number;
  protectedFieldChanges: number;
  errors: string[];
  changes: RefreshDifference[];
};

const CONTACT_FIELDS = ["EMAIL", "MOBILE"] as const;
const NAME_FIELDS = ["FIRSTNAME", "LASTNAME"] as const;
const CLASSIFICATION_FIELDS = ["TYPE", "MAILOUT"] as const;
const PROTECTED_FIELDS = ["ACCOUNT", "PRICELEVEL"] as const;

function indexSource(rows: IdealCustomerRow[], label: string, errors: string[]) {
  const byCode = new Map<string, IdealCustomerRow>();
  for (const row of rows) {
    if (!row.CODE || byCode.has(row.CODE)) {
      errors.push(`${label}: empty or duplicate IdealPOS CODE. Review the original source before proceeding.`);
      continue;
    }
    byCode.set(row.CODE, row);
  }
  return byCode;
}

/**
 * Read-only diff: no CRM mutation, no POS writeback, no consent decision.
 * Missing/blank updates are never interpreted as deletion instructions.
 */
export function reviewIdealCustomerRefresh(
  previous: IdealCustomerRow[],
  current: IdealCustomerRow[],
): CustomerRefreshReview {
  if (!previous.length || !current.length || previous.length > 100_000 || current.length > 100_000) {
    throw Error("Choose two complete customer files with at most 100,000 rows each.");
  }
  const errors: string[] = [];
  const oldByCode = indexSource(previous, "Previous file", errors);
  const newByCode = indexSource(current, "Current file", errors);
  const result: CustomerRefreshReview = {
    priorCount: previous.length, currentCount: current.length,
    unchanged: 0, changed: 0, added: 0, missingFromCurrent: 0,
    contactChanges: 0, nameChanges: 0, classificationChanges: 0,
    protectedFieldChanges: 0, errors, changes: [],
  };
  if (errors.length) return result;
  const fields = [...NAME_FIELDS, ...CONTACT_FIELDS, ...CLASSIFICATION_FIELDS, ...PROTECTED_FIELDS];
  for (const [code, row] of newByCode) {
    const prior = oldByCode.get(code);
    if (!prior) {
      result.added++;
      result.changes.push({ code, fields: ["New CODE not in previous file"], requiresReview: true });
      continue;
    }
    const changed = fields.filter((key) =>
      // A blank refreshed field is not an instruction to erase existing details.
      row[key].trim() !== "" && row[key] !== prior[key]
    );
    if (changed.length === 0) { result.unchanged++; continue; }
    result.changed++;
    if (changed.some((field) => (CONTACT_FIELDS as readonly string[]).includes(field))) result.contactChanges++;
    if (changed.some((field) => (NAME_FIELDS as readonly string[]).includes(field))) result.nameChanges++;
    if (changed.some((field) => (CLASSIFICATION_FIELDS as readonly string[]).includes(field))) result.classificationChanges++;
    if (changed.some((field) => (PROTECTED_FIELDS as readonly string[]).includes(field))) result.protectedFieldChanges++;
    result.changes.push({
      code, fields: changed,
      requiresReview: changed.some((field) => !(NAME_FIELDS as readonly string[]).includes(field)),
    });
  }
  for (const code of oldByCode.keys()) {
    if (!newByCode.has(code)) {
      result.missingFromCurrent++;
      result.changes.push({ code, fields: ["CODE absent from new file"], requiresReview: true });
    }
  }
  return result;
}
