import type { IdealCustomerRow } from "./idealCustomerTypeExport";
import { reviewIdealCustomerRefresh } from "./customerRefreshReview";

export const IDEAL_CONTACT_UPDATE_FIELDS = ["EMAIL", "MOBILE", "TYPE", "MAILOUT"] as const;
export type IdealContactUpdateField = (typeof IDEAL_CONTACT_UPDATE_FIELDS)[number];
export type IdealContactUpdate = {
  code: string;
  field: IdealContactUpdateField;
  before: string;
  after: string;
};

/**
 * Only exact original CODE and nonblank, changed source fields are eligible.
 * Name changes use the existing separate names-only worker. ACCOUNT/PRICELEVEL
 * and consent are never part of this plan.
 */
export function prepareIdealContactUpdates(
  previous: IdealCustomerRow[],
  current: IdealCustomerRow[],
  selectedFields: readonly IdealContactUpdateField[],
): IdealContactUpdate[] {
  const review = reviewIdealCustomerRefresh(previous, current);
  if (review.errors.length) throw Error(review.errors.join(" "));
  if (!selectedFields.length) return [];
  const beforeByCode = new Map(previous.map((row) => [row.CODE, row]));
  const results: IdealContactUpdate[] = [];
  const selected = new Set(selectedFields);
  for (const row of current) {
    const old = beforeByCode.get(row.CODE);
    if (!old) continue; // Never create or merge customers.
    for (const field of IDEAL_CONTACT_UPDATE_FIELDS) {
      if (!selected.has(field)) continue;
      const before = old[field];
      const after = row[field];
      if (after.trim() === "" || before === after) continue;
      results.push({ code: row.CODE, field, before, after });
    }
  }
  return results;
}
