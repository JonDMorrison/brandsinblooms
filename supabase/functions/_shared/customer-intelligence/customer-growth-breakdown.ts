import type { GrowthOrder } from './customer-growth.ts';
import { assertDate, localDate } from './purchase-exploration.ts';
import { capturePeriod, type CoverageReview, type MeasurementSettings } from '../loyalty/programme-measurement.ts';

export interface GrowthBreakdownSettings {
  year: number;
  currentEnd: string;
  currency: MeasurementSettings['currency'];
  timezone: string;
  cutoff: string;
  periods: CoverageReview;
  earlierHistory: CoverageReview;
}
const sum = (values: number[]) => values.reduce((total, value) => {
  const result = total + value;
  if (!Number.isSafeInteger(result)) throw new Error('The sales total exceeds the exact monetary range.');
  return result;
}, 0);

/** Unique customers, not the weighted customer-over-customer Growth Index.
 * Coverage reviews are explicit human evidence statements, never inferred from
 * a completed import, a customer first-purchase field, or a missing source row.
 */
export function customerGrowthBreakdown(orders: GrowthOrder[], customerIds: string[], tenantId: string, settings: GrowthBreakdownSettings) {
  if (!Number.isInteger(settings.year) || settings.year < 1901 || settings.year > 9998) throw new Error('Choose a valid reporting year.');
  assertDate(settings.currentEnd);
  const start = `${settings.year}-01-01`, annualEnd = `${settings.year}-12-31`;
  const today = localDate(settings.cutoff, settings.timezone);
  if (!today || settings.currentEnd < start || settings.currentEnd > annualEnd || settings.currentEnd > today)
    throw new Error('Choose an end date within the reporting year and no later than the evidence cutoff.');
  const prior = { start: `${settings.year - 1}-01-01`, end: `${settings.year - 1}-12-31` };
  const measurement = { currency: settings.currency, timezone: settings.timezone, spendWeight: 100, transactionsWeight: 0 };
  // capturePeriod validates source timestamps, cents, duplicate IDs, tenant scope,
  // refund consistency and both coverage reviews using the established contract.
  const baseline = capturePeriod(orders, customerIds, customerIds, tenantId, prior, measurement, settings.cutoff, settings.periods);
  const current = capturePeriod(orders, customerIds, customerIds, tenantId, { start, end: settings.currentEnd }, measurement, settings.cutoff, settings.earlierHistory);
  const previousById = new Map(baseline.customers.map(row => [row.customerId, row]));
  const rows = current.customers.map(row => ({
    current: row, previous: previousById.get(row.customerId)!,
  }));
  const badRows = new Set([...baseline.customers, ...current.customers].flatMap(row => row.missingOrderIds));
  const relevantOrders = orders.filter(order => {
    if (Number.isFinite(Date.parse(order.created_at)) && Date.parse(order.created_at) > Date.parse(settings.cutoff)) return false;
    const day = localDate(order.order_date, settings.timezone);
    return !day || day <= settings.currentEnd;
  });
  // Earlier unlinked purchases can invalidate first-ever identity just as much as
  // an unlinked order in either selected year. Do not drop that lifetime gap.
  const unlinked = new Set(relevantOrders.filter(order => !order.crm_customer_id).map(order => order.id));
  const allowed = new Set(customerIds);
  const outOfPopulation = new Set(relevantOrders.filter(order => order.crm_customer_id && !allowed.has(order.crm_customer_id)).map(order => order.id));
  // Never call a first CAD purchase a first-ever purchase when other currencies
  // or inaccessible identities are present. The displayed scope stays explicit.
  const otherCurrency = relevantOrders.some(order => order.currency && order.currency.toUpperCase() !== settings.currency);
  const reliable = badRows.size === 0 && unlinked.size === 0 && outOfPopulation.size === 0 && !otherCurrency;
  const periodComplete = reliable && settings.periods.status === 'reviewed_complete';
  const lifetimeComplete = periodComplete && settings.earlierHistory.status === 'reviewed_complete';
  const before = rows.filter(row => row.previous.recordedTransactions > 0);
  const active = rows.filter(row => row.current.recordedTransactions > 0);
  const retained = active.filter(row => row.previous.recordedTransactions > 0);
  const recovered = active.filter(row => row.previous.recordedTransactions === 0 && row.previous.knownEarlierTransactions > 0);
  const firstObserved = active.filter(row => row.previous.recordedTransactions === 0 && row.previous.knownEarlierTransactions === 0);
  const lost = before.filter(row => row.current.recordedTransactions === 0);
  const percent = (value: number) => before.length > 0 ? value / before.length * 100 : null;
  const average = (cohort: typeof rows) => cohort.length ? sum(cohort.map(row => row.current.recordedSpendMinor)) / cohort.length / 100 : null;
  const net = active.length - before.length;
  // December 31 is still in progress until the next business-local date.
  const fullYear = settings.currentEnd === annualEnd && annualEnd < today;
  const retainedAverage = periodComplete ? average(retained) : null;
  const estimatedSalesEffect = fullYear && retainedAverage !== null ? net * retainedAverage : null;
  if (estimatedSalesEffect !== null && (!Number.isFinite(estimatedSalesEffect) || Math.abs(estimatedSalesEffect * 100) > Number.MAX_SAFE_INTEGER)) throw new Error('The sales estimate exceeds the exact monetary range.');
  const reviewed = periodComplete ? {
    previous: before.length, retained: retained.length, recovered: recovered.length,
    newCustomers: lifetimeComplete ? firstObserved.length : null,
    unclassified: lifetimeComplete ? 0 : firstObserved.length,
    lost: lost.length, current: active.length, net,
    retentionPercent: percent(retained.length), recoveredPercent: percent(recovered.length),
    newPercent: lifetimeComplete ? percent(firstObserved.length) : null,
    unclassifiedPercent: percent(lifetimeComplete ? 0 : firstObserved.length),
    lossPercent: percent(lost.length), growthPercent: percent(net),
    retainedAverage, recoveredAverage: average(recovered), newAverage: lifetimeComplete ? average(firstObserved) : null,
    estimatedAnnualSalesEffect: estimatedSalesEffect,
  } : null;
  return {
    settings, currentPeriod: { start, end: settings.currentEnd }, previousPeriod: prior, fullYear,
    status: !reliable ? 'reconciliation_required' as const : !periodComplete ? 'coverage_unverified' as const : !lifetimeComplete && firstObserved.length > 0 ? 'earlier_history_unverified' as const : 'reviewed' as const,
    observed: { previous: before.length, current: active.length, retained: retained.length, recoveredCandidates: recovered.length, firstObserved: firstObserved.length, notReturned: lost.length },
    reviewed,
    unknown: { invalidOrderRows: badRows.size, unlinkedOrders: unlinked.size, outsidePopulationOrders: outOfPopulation.size, otherCurrency },
    source: 'Accessible linked customer identities and dated POS order ledger only. Completed positive-net purchases establish activity; fully returned/free orders do not. Sales are net of recorded refunds.',
    formula: 'Customer growth % = retention % + new-customer contribution % + recovered-customer contribution % − 100%. Every percentage uses previous-year active customers.',
    estimateAssumption: 'Estimated annual sales effect = net customer change × current-year average annual sales per retained customer. Assumes each net customer gained or lost spends like a retained customer; not a forecast or campaign attribution.',
  };
}
