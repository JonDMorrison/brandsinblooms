import type { PersistenceClient } from '../../bloom-assist/types.ts';
import { loadReportLedger, visitReportedEvidence, type ReportLedger } from './load-reported-evidence.ts';
import { readAllPages } from './query-pages.ts';
import { currentSummaryImports } from './period-summary.ts';
import { assertDate, finiteNumber, localDate, type PurchaseFact } from './purchase-exploration.ts';
import { moneyMinorUnits } from './customer-growth.ts';

/** Source-observed cohorts, never a certification of the entire business or lifetime. */
export function reportedCustomerGrowth(facts: PurchaseFact[], population: string[], tenantId: string, sources: ReportLedger[], currentId: string, previousId: string, currency: string) {
  const accumulator = createGrowthAccumulator(population, tenantId, sources, currentId, previousId, currency);
  accumulator.add(facts);
  return accumulator.finish();
}
function createGrowthAccumulator(population: string[], tenantId: string, sources: ReportLedger[], currentId: string, previousId: string, currency: string) {
  const current = sources.find(s => s.id === currentId), previous = sources.find(s => s.id === previousId);
  if (!current || !previous) throw Error('Both exact report periods are required.');
  const year = Number(current.source_period_start?.slice(0, 4));
  if (current.source_period_start !== `${year}-01-01` || previous.source_period_start !== `${year - 1}-01-01` || previous.source_period_end !== `${year - 1}-12-31`) throw Error('Growth requires a January-start current report and the entire previous calendar year.');
  const bySource = new Map(sources.map(source => {
    if (source.tenant_id !== tenantId || source.status !== 'completed' || !source.source_period_start || !source.source_period_end) throw Error('Invalid company report source.');
    assertDate(source.source_period_start); assertDate(source.source_period_end);
    return [source.id, new Map<string, { cents: number; positiveQuantity: boolean }>()] as const;
  }));
  const allowed = new Set(population), seen = new Map<string, string>();
  const unlinkedSummaries = new Set<string>(), unavailableCustomerIds = new Set<string>();
  function add(facts: Iterable<PurchaseFact>) {
  for (const fact of facts) {
    const source = sources.find(s => s.id === fact.import_id);
    if (!source || fact.tenant_id !== tenantId || fact.source !== source.source || fact.evidence_kind !== 'period_summary' || fact.purchased_at !== null || fact.source_period_start !== source.source_period_start || fact.source_period_end !== source.source_period_end) throw Error('Report facts disagree with their source period.');
    const fingerprint = JSON.stringify(fact);
    if (seen.has(fact.id)) { if (seen.get(fact.id) !== fingerprint) throw Error('Conflicting report fact identity.'); continue; }
    seen.set(fact.id, fingerprint);
    const cents = moneyMinorUnits(fact.net_amount), quantity = finiteNumber(fact.quantity);
    if (cents === null || quantity === null || fact.currency !== currency) throw Error('Source amounts, quantities or currency need reconciliation.');
    if (!fact.customer_id) { unlinkedSummaries.add(`${source.id}:${fact.id.slice(0, fact.id.lastIndexOf(':'))}`); continue; }
    if (!allowed.has(fact.customer_id)) { unavailableCustomerIds.add(fact.customer_id); continue; }
    const group = bySource.get(source.id)!;
    const value = group.get(fact.customer_id) ?? { cents: 0, positiveQuantity: false };
    value.cents += cents; value.positiveQuantity ||= quantity > 0 && cents > 0;
    if (!Number.isSafeInteger(value.cents)) throw Error('Reported total exceeds exact monetary range.');
    group.set(fact.customer_id, value);
  }
  }
  function finish() {
  const buyers = (id: string) => new Set([...bySource.get(id)!].filter(([, row]) => row.cents > 0 && row.positiveQuantity).map(([id]) => id));
  const before = buyers(previousId), active = buyers(currentId), earlier = new Set<string>();
  for (const source of sources) if (source.source_period_end! < previous.source_period_start!) for (const id of buyers(source.id)) earlier.add(id);
  const retained = [...active].filter(id => before.has(id));
  const recovered = [...active].filter(id => !before.has(id) && earlier.has(id));
  const firstObserved = [...active].filter(id => !before.has(id) && !earlier.has(id));
  const notReturned = [...before].filter(id => !active.has(id));
  const average = (ids: string[]) => {
    if (!ids.length) return null;
    let cents = 0; for (const id of ids) { cents += bySource.get(currentId)!.get(id)!.cents; if (!Number.isSafeInteger(cents)) throw Error('Reported total exceeds exact monetary range.'); }
    return cents / ids.length / 100;
  };
  const percent = (n: number) => before.size ? n / before.size * 100 : null;
  const sourceQuarantines = sources.map(source => {
    const value = (source.reconciliation as { quarantinedGroups?: unknown } | null)?.quarantinedGroups;
    return { importId: source.id, groups: typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null };
  });
  return { current, previous, sources, currency,
    loadedFactExclusions: { unlinkedSummaries: unlinkedSummaries.size, unavailableCustomerIds: unavailableCustomerIds.size },
    sourceQuarantines,
    counts: { previous: before.size, current: active.size, retained: retained.length, recovered: recovered.length, firstObserved: firstObserved.length, notReturned: notReturned.length, net: active.size - before.size },
    percentages: { retained: percent(retained.length), recovered: percent(recovered.length), firstObserved: percent(firstObserved.length), net: percent(active.size - before.size) },
    averages: { retained: average(retained), recovered: average(recovered), firstObserved: average(firstObserved) },
    firstEver: null, estimatedAnnualSalesEffect: null,
  };
  }
  return { add, finish, releaseSourceFingerprints: () => seen.clear() };
}

export async function loadReportedCustomerGrowth(client: PersistenceClient, tenantId: string, cutoff: string, year: number, currency: string, population: string[], timezone = 'UTC') {
  const ledger = await loadReportLedger(client, tenantId, cutoff);
  if (!ledger.length) return null;
  const activeIds = new Set(currentSummaryImports(ledger).map(s => s.id));
  const active = ledger.filter(s => activeIds.has(s.id));
  const today = localDate(cutoff, timezone)!;
  const current = active.filter(s => s.source_period_start === `${year}-01-01` && s.source_period_end! <= `${year}-12-31` && s.source_period_end! <= today).sort((a, b) => b.source_period_end!.localeCompare(a.source_period_end!))[0];
  const previous = active.find(s => s.source_period_start === `${year - 1}-01-01` && s.source_period_end === `${year - 1}-12-31`);
  if (!current || !previous) throw Error(`No supported report pair for ${year}. Available source periods: ${active.map(s => `${s.source_period_start} through ${s.source_period_end}`).join('; ')}. No zero customer totals were inferred.`);
  const selected = active.filter(s => s.id === current.id || s.id === previous.id || s.source_period_end! < previous.source_period_start!);
  const accumulator = createGrowthAccumulator(population, tenantId, selected, current.id, previous.id, currency);
  await visitReportedEvidence(client, tenantId, cutoff, { historicalImportIds: selected.map(s => s.id) }, facts => {
    accumulator.add(facts);
    accumulator.releaseSourceFingerprints();
  });
  const spendingSources = await readAllPages<ReportLedger & { rejected_row_count: number }>((from, to) => client.from('customer_intelligence_imports').select('id,tenant_id,source,status,source_sha256,source_filename,source_period_start,source_period_end,created_at,completed_at,reconciliation,rejected_row_count').eq('tenant_id', tenantId).eq('source', 'ideal').eq('report_type', 'customer_spending').eq('status', 'completed').lte('created_at', cutoff).lte('completed_at', cutoff).order('completed_at', { ascending: false }).order('id').range(from, to));
  if (spendingSources.some(s => s.tenant_id !== tenantId || s.source !== 'ideal' || s.status !== 'completed')) throw Error('Spending source scope mismatch.');
  return { ...accumulator.finish(), spendingSources };

}
export type ReportedCustomerGrowth = NonNullable<Awaited<ReturnType<typeof loadReportedCustomerGrowth>>>;
