import {assertDate, localDate} from './purchase-exploration.ts';
export interface GrowthOrder {
  id: string; tenant_id: string | null; crm_customer_id: string | null;
  order_date: string; created_at: string; total_amount: number | string | null;
  refund_amount: number | string | null; currency: string | null; status: string | null;
}
export interface GrowthSettings {
  current_start: string; current_end: string; baseline_start: string; baseline_end: string;
  currency: string; timezone: string; data_cutoff: string;
  spend_weight: number; visits_weight: number; per_day_rates?: boolean;
}
/** Decimal currency arithmetic: never sum binary floating-point money. */
export function moneyMinorUnits(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!match) return null;
  const result = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(result) ? (match[1] ? -result : result) : null;
}
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const days = (start: string, end: string) => (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000 + 1;
export function validateGrowthSettings(settings: GrowthSettings) {
  for (const date of [settings.current_start, settings.current_end, settings.baseline_start, settings.baseline_end]) assertDate(date);
  const cutoff = localDate(settings.data_cutoff, settings.timezone);
  if (!cutoff || settings.current_start > settings.current_end || settings.baseline_start > settings.baseline_end || settings.baseline_end >= settings.current_start || settings.current_end > cutoff) throw new Error('Choose ordered, non-overlapping periods ending no later than the source-read date.');
  if (!/^[A-Z]{3}$/.test(settings.currency)) throw new Error('Select one currency. Different currencies are never added together.');
  if (![settings.spend_weight, settings.visits_weight].every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 100) || settings.spend_weight + settings.visits_weight <= 0) throw new Error('Weights must be non-negative, no greater than 100, and total more than zero.');
  const currentDays = days(settings.current_start, settings.current_end), baselineDays = days(settings.baseline_start, settings.baseline_end);
  if (currentDays !== baselineDays && !settings.per_day_rates) throw new Error('The periods have different lengths. Choose equal periods or explicitly compare per-day rates.');
  return {currentDays, baselineDays};
}
export function compareCustomerGrowth(orders: GrowthOrder[], customerIds: string[], tenantId: string, settings: GrowthSettings) {
  const {currentDays, baselineDays} = validateGrowthSettings(settings);
  const ids = [...new Set(customerIds)].sort(), allowed = new Set(ids);
  const groups = new Map<string, {current: number; baseline: number; currentVisits: number; baselineVisits: number; earlier: number; missing: number; foreign: number}>();
  const group = (id: string) => { if (!groups.has(id)) groups.set(id, {current: 0, baseline: 0, currentVisits: 0, baselineVisits: 0, earlier: 0, missing: 0, foreign: 0}); return groups.get(id)!; };
  const seen = new Map<string, string>(); let futureRows = 0, ignoredStatus = 0;
  for (const order of orders) {
    if (order.tenant_id !== tenantId) throw new Error('Cross-company orders were rejected.');
    if (!order.crm_customer_id || !allowed.has(order.crm_customer_id)) continue;
    const fingerprint = JSON.stringify(order);
    if (seen.has(order.id)) { if (seen.get(order.id) !== fingerprint) throw new Error('Conflicting versions of an order were returned. Retry the comparison.'); continue; }
    seen.set(order.id, fingerprint);
    const row = group(order.crm_customer_id);
    if (Date.parse(order.created_at) > Date.parse(settings.data_cutoff)) { futureRows++; continue; }
    const status = order.status?.toLowerCase();
    if (['cancelled', 'canceled', 'void', 'voided', 'draft', 'pending', 'failed'].includes(status ?? '')) { ignoredStatus++; continue; }
    if (!['completed', 'complete', 'paid', 'fulfilled', 'refunded', 'partially_refunded'].includes(status ?? '')) { row.missing++; continue; }
    const date = localDate(order.order_date, settings.timezone);
    if (!date) { row.missing++; continue; }
    if (date > settings.current_end) continue;
    if (date > settings.baseline_end && date < settings.current_start) continue;
    if (!order.currency) { row.missing++; continue; }
    if (order.currency.toUpperCase() !== settings.currency) { row.foreign++; continue; }
    if (['refunded', 'partially_refunded'].includes(status!) && order.refund_amount === null) { row.missing++; continue; }
    const gross = moneyMinorUnits(order.total_amount), refund = order.refund_amount === null ? 0 : moneyMinorUnits(order.refund_amount);
    if (gross === null || refund === null || refund < 0 || gross < 0 || refund > gross) { row.missing++; continue; }
    if (gross === 0) continue;
    const net = gross - refund;
    if (date < settings.baseline_start) { row.earlier++; continue; }
    if (date <= settings.baseline_end) { row.baseline += net; row.baselineVisits++; }
    else if (date >= settings.current_start) { row.current += net; row.currentVisits++; }
    if (!Number.isSafeInteger(row.current) || !Number.isSafeInteger(row.baseline)) throw new Error('The currency total exceeds the exact arithmetic limit.');
  }
  const rows = ids.map((customer_id) => {
    const totals = group(customer_id), currentFactor = settings.per_day_rates ? currentDays : 1, baselineFactor = settings.per_day_rates ? baselineDays : 1;
    const percentage = (current: number, baseline: number) => baseline > 0 ? (current / currentFactor / (baseline / baselineFactor) - 1) * 100 : null;
    const spend = percentage(totals.current, totals.baseline), visits = percentage(totals.currentVisits, totals.baselineVisits);
    const terms = [[settings.spend_weight, spend], [settings.visits_weight, visits]].filter(([weight]) => weight! > 0);
    const reliable = totals.missing === 0;
    const change = reliable && terms.every(([, value]) => value !== null) ? terms.reduce((sum, [weight, value]) => sum + weight! * value!, 0) / (settings.spend_weight + settings.visits_weight) : null;
    const state = !reliable ? 'incomplete_data' : totals.baselineVisits > 0 ? (totals.currentVisits > 0 ? 'retained' : 'lapsed') : totals.currentVisits > 0 ? (totals.earlier > 0 ? 'reactivated' : 'newly_observed') : 'no_comparable_history';
    return {customer_id, current_spend: totals.current / 100, baseline_spend: totals.baseline / 100,
      current_visits: totals.currentVisits, baseline_visits: totals.baselineVisits,
      spend_change_percent: reliable && spend !== null ? round(spend) : null,
      visits_change_percent: reliable && visits !== null ? round(visits) : null,
      growth_change_percent: change === null ? null : round(change),
      growth_index: change === null ? null : round(100 + change), state,
      incomplete_rows: totals.missing, other_currency_rows: totals.foreign,
      explanation: !reliable ? 'A required order field is missing or invalid. No growth score was fabricated.' : change === null ? 'There is no positive baseline for every weighted measure. No percentage growth was fabricated.' : 'Each customer is compared with their own baseline. Index 100 means unchanged.'};
  });
  const comparable = rows.filter((row) => row.growth_change_percent !== null);
  const established = rows.filter((row) => row.baseline_visits > 0 && row.incomplete_rows === 0);
  const retained = established.filter((row) => row.current_visits > 0);
  return {kind: 'customer_growth', settings, current_days: currentDays, baseline_days: baselineDays,
    formula: '(spend growth % × spend weight + visit growth % × visit weight) / total weight; index = 100 + change %',
    source: 'Canonical POS order ledger; net order value after recorded refunds; one visit per completed order, not per line item.',
    rows, summary: {customers: rows.length, comparable_customers: comparable.length, unscored_customers: rows.length - comparable.length,
      mean_customer_growth_percent: comparable.length ? round(comparable.reduce((sum, row) => sum + row.growth_change_percent!, 0) / comparable.length) : null,
      established_customers: established.length, retained_customers: retained.length,
      retention_percent: established.length ? round(retained.length / established.length * 100) : null,
      lapsed_customers: rows.filter((row) => row.state === 'lapsed').length,
      reactivated_customers: rows.filter((row) => row.state === 'reactivated').length,
      newly_observed_customers: rows.filter((row) => row.state === 'newly_observed').length,
      growing_customers: comparable.filter((row) => row.growth_change_percent! > 0).length,
      declining_customers: comparable.filter((row) => row.growth_change_percent! < 0).length},
    exclusions: {future_rows: futureRows, ignored_order_statuses: ignoredStatus},
    limitations: ['These are changes in recorded purchases, not proof that a campaign caused them.', 'No visits or spending were inferred from aggregate customer reports. A newly observed buyer is not necessarily a newly enrolled member.', 'No recorded purchase is different from a verified complete POS history. Verify import coverage before using this as a program success claim.']};
}
