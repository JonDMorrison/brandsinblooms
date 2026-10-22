import {assertDate, type PurchaseFact} from './purchase-exploration.ts';
import {moneyMinorUnits} from './customer-growth.ts';

export interface ReportedPeriod {start: string; end: string; currency: string;}
function validatePeriod(period: ReportedPeriod) {
  assertDate(period.start); assertDate(period.end);
  if (period.start > period.end || !/^[A-Z]{3}$/.test(period.currency)) throw new Error('Select an ordered period and one currency.');
  return (Date.parse(period.end) - Date.parse(period.start)) / 86400000 + 1;
}
/** Rank reported spend only. This cannot supply visits, CGI, or lifetime value. */
export function rankReportedPeriodSpend(facts: PurchaseFact[], population: string[], tenantId: string, period: ReportedPeriod) {
  validatePeriod(period);
  const allowed = new Set(population), seen = new Map<string, string>();
  const groups = new Map<string, {cents: number; imports: Set<string>; invalid: boolean}>();
  for (const fact of facts) {
    if (fact.tenant_id !== tenantId) throw new Error('Cross-company report evidence was rejected.');
    if (!fact.customer_id || !allowed.has(fact.customer_id)) continue;
    const fingerprint = JSON.stringify(fact);
    if (seen.has(fact.id)) {
      if (seen.get(fact.id) !== fingerprint) throw new Error('Conflicting report evidence was returned.');
      continue;
    }
    seen.set(fact.id, fingerprint);
    if (fact.evidence_kind !== 'period_summary') throw new Error('Dated purchases and report totals must be reconciled separately.');
    if (!fact.source_period_start || !fact.source_period_end) throw new Error('Report coverage is missing.');
    assertDate(fact.source_period_start); assertDate(fact.source_period_end);
    if (fact.source_period_start > fact.source_period_end) throw new Error('Report coverage is invalid.');
    if (fact.source_period_end < period.start || fact.source_period_start > period.end) continue;
    const group = groups.get(fact.customer_id) ?? {cents: 0, imports: new Set<string>(), invalid: false};
    groups.set(fact.customer_id, group);
    const cents = moneyMinorUnits(fact.net_amount);
    if (fact.source_period_start !== period.start || fact.source_period_end !== period.end ||
        fact.currency !== period.currency || !fact.import_id || cents === null) {group.invalid = true; continue;}
    group.imports.add(fact.import_id);
    group.cents += cents;
    if (!Number.isSafeInteger(group.cents)) throw new Error('The currency total exceeds the exact arithmetic limit.');
  }
  const rows = [...allowed].map(customer_id => {
    const group = groups.get(customer_id);
    return {customer_id, reported_spend: group && !group.invalid && group.imports.size === 1 ? group.cents / 100 : null,
      rank: null as number | null,
      import_ids: group ? [...group.imports].sort() : []};
  }).sort((a, b) => (b.reported_spend ?? -Infinity) - (a.reported_spend ?? -Infinity) || a.customer_id.localeCompare(b.customer_id));
  rows.forEach((row, index) => {
    if (row.reported_spend !== null) row.rank = index > 0 && rows[index - 1].reported_spend === row.reported_spend ? rows[index - 1].rank : index + 1;
  });
  return {period, rows, metric: 'reported_period_spend' as const,
    limitation: 'Only exact-period report totals are ranked. Missing, partial, mixed-currency or overlapping imports remain unscored. No visits or lifetime value are inferred.'};
}

export function compareReportedPeriodSpend(facts: PurchaseFact[], population: string[], tenantId: string, current: ReportedPeriod, baseline: ReportedPeriod) {
  const currentDays = validatePeriod(current), baselineDays = validatePeriod(baseline);
  const calendarAligned = current.start.slice(5) === baseline.start.slice(5) && current.end.slice(5) === baseline.end.slice(5)
    && current.start.slice(0, 4) === current.end.slice(0, 4) && baseline.start.slice(0, 4) === baseline.end.slice(0, 4);
  if ((!calendarAligned && currentDays !== baselineDays) || baseline.end >= current.start || current.currency !== baseline.currency)
    throw new Error('Choose equal-length or calendar-aligned, non-overlapping periods in one currency. Annual history cannot be compared with incomplete YTD as growth.');
  const previous = new Map(rankReportedPeriodSpend(facts, population, tenantId, baseline).rows.map(row => [row.customer_id, row]));
  return {current, baseline, current_days: currentDays, baseline_days: baselineDays,
    comparison_basis: calendarAligned ? 'matching_calendar_dates' : 'equal_duration', metric: 'reported_spend_change' as const,
    rows: rankReportedPeriodSpend(facts, population, tenantId, current).rows.map(row => {
      const before = previous.get(row.customer_id)!.reported_spend;
      return {customer_id: row.customer_id, current_spend: row.reported_spend, baseline_spend: before,
        spend_change_percent: row.reported_spend !== null && before !== null && before > 0 ? Math.round((row.reported_spend / before - 1) * 10000) / 100 : null};
    })};
}
