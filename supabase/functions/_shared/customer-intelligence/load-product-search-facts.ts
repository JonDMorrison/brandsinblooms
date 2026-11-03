import type {PersistenceClient} from '../../bloom-assist/types.ts';
import type {PurchaseFact, PurchaseRule} from './purchase-exploration.ts';
import {loadEligibleDatedFacts} from './load-analysis-facts.ts';
import {loadReportLedger, loadSummaryRows} from './load-reported-evidence.ts';
import {legacySummaryCertificate, verifyLegacySummarySnapshot} from './legacy-summary-evidence.ts';
import {currentSummaryImports, periodSummaryFacts, type PeriodSummaryEvent} from './period-summary.ts';
import {idealEvidenceTimestamp} from './ideal-metric-projection.ts';
import {readAllPages} from './query-pages.ts';

/**
 * Company-wide product search without reading every report row.
 *
 * The database returns only report lines that could match the search, plus
 * the list of customers that have any report evidence. The exact matching and
 * all row validation still happen here, with the same rules as the full scan.
 * A reconciled legacy snapshot is fully re-verified whenever its fingerprint
 * differs from the one recorded after its last successful verification.
 */

/** Records the fingerprint of a fully verified report snapshot. Service-role only. */
export interface VerifiedSnapshotStore {
  fingerprint(importId: string): Promise<string>;
  get(importId: string): Promise<string | null>;
  set(importId: string, fingerprint: string): Promise<void>;
}

const normalized = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en-CA');
/** Database matching is plain lower-case ASCII, so only push down terms it can match exactly as a superset. */
const SAFE_TERM = /^[\x20-\x21\x23-\x5b\x5d-\x7e]+$/;

/** Lower-case search terms the database may filter by, or null when the full scan is required. */
export function productSearchTerms(rule: PurchaseRule): string[] | null {
  if (rule.mode === 'all' || rule.category) return null;
  let term: string | null = null;
  if (rule.product) term = normalized(rule.product);
  else if (rule.department) {
    // Every named word must appear in the label, so any one of them narrows safely.
    const words = normalized(rule.department).replace(/^[\d,.\s-]+(?=\D)/, '').split(/\s+/).filter(Boolean);
    term = words.sort((a, b) => b.length - a.length)[0] ?? null;
    // "tropicals" must still find "tropical".
    if (term && term.length > 3 && term.endsWith('s')) term = term.slice(0, -1);
  }
  if (!term || term.length < 2 || !SAFE_TERM.test(term)) return null;
  return [term];
}

interface CandidateEvent extends PeriodSummaryEvent { external_customer_code?: string | null; }

export interface ProductSearchFacts { facts: PurchaseFact[]; evidenceCustomerIds: Set<string>; }

export async function loadProductSearchFacts(
  client: PersistenceClient, tenantId: string, cutoff: string, rule: PurchaseRule, store: VerifiedSnapshotStore,
): Promise<ProductSearchFacts | null> {
  if (!tenantId || !Number.isFinite(idealEvidenceTimestamp(cutoff))) throw Error('Company and valid evidence cutoff are required.');
  const terms = productSearchTerms(rule);
  if (!terms) return null;

  const ledger = await loadReportLedger(client, tenantId, cutoff);
  const active = currentSummaryImports(ledger);
  const parents = active.map(row => ledger.find(entry => entry.id === row.id)!);
  const legacy = new Map(parents.flatMap(parent => {const certificate = legacySummaryCertificate(parent); return certificate ? [[parent.id, certificate] as const] : [];}));

  const verifyLegacy = async () => {
    for (const [importId, certificate] of legacy) {
      const before = await store.fingerprint(importId);
      if (before && (await store.get(importId)) === before) continue;
      const rows = (await loadSummaryRows(client, tenantId, cutoff, importId)).filter(row => row.import_id === importId);
      const identities = await readAllPages<{id: string; tenant_id: string; external_id: string | null}>((from, to) => client.from('crm_customers').select('id,tenant_id,external_id').eq('tenant_id', tenantId).is('deleted_at', null).is('merged_into_customer_id', null).order('id').range(from, to));
      await verifyLegacySummarySnapshot(rows as (PeriodSummaryEvent & {external_customer_code?: string})[], certificate, identities);
      const after = await store.fingerprint(importId);
      if (after !== before) throw Error('The reconciled report changed while it was being verified. Try the search again.');
      await store.set(importId, after);
    }
  };

  const importIds = parents.map(parent => parent.id);
  const [, dated, scopeResult, candidateResult] = await Promise.all([
    verifyLegacy(),
    loadEligibleDatedFacts(client, tenantId, cutoff),
    importIds.length ? client.rpc('bloom_summary_evidence_scope', {
      p_tenant_id: tenantId, p_cutoff: cutoff,
      p_imports: parents.map(parent => ({id: parent.id, sha: parent.source_sha256, start: parent.source_period_start, end: parent.source_period_end, legacy: legacy.has(parent.id)})),
    }) : Promise.resolve({data: {customer_ids: [], rows: 0, invalid_rows: 0}, error: null}),
    importIds.length ? client.rpc('bloom_summary_product_candidates', {p_tenant_id: tenantId, p_import_ids: importIds, p_terms: terms, p_cutoff: cutoff})
      : Promise.resolve({data: [], error: null}),
  ]);
  if (scopeResult.error) throw new Error(scopeResult.error.message);
  if (candidateResult.error) throw new Error(candidateResult.error.message);
  const scope = scopeResult.data as {customer_ids?: unknown; invalid_rows?: unknown} | null;
  if (!scope || !Array.isArray(scope.customer_ids) || typeof scope.invalid_rows !== 'number') throw Error('The report evidence scope could not be read.');
  if (scope.invalid_rows !== 0) throw Error('Report facts do not match their completed source ledger.');
  const candidates = candidateResult.data as CandidateEvent[] | null;
  if (!Array.isArray(candidates)) throw Error('The report evidence could not be read.');

  for (const row of candidates) {
    const parent = parents.find(p => p.id === row.import_id);
    const raw = row.raw_data as {period_start?: unknown; period_end?: unknown; source_sha256?: unknown} | null;
    if (!parent || row.tenant_id !== tenantId || row.source !== parent.source
      || !Number.isFinite(idealEvidenceTimestamp(row.created_at)) || idealEvidenceTimestamp(row.created_at) > idealEvidenceTimestamp(cutoff)
      || (!legacy.has(parent.id) && raw?.source_sha256 !== parent.source_sha256)
      || raw?.period_start !== parent.source_period_start || raw?.period_end !== parent.source_period_end)
      throw Error('Report facts do not match their completed source ledger.');
  }

  const evidenceCustomerIds = new Set<string>(scope.customer_ids.filter((id): id is string => typeof id === 'string'));
  for (const fact of dated) if (fact.customer_id) evidenceCustomerIds.add(fact.customer_id);
  return {facts: [...dated, ...periodSummaryFacts(candidates, tenantId)], evidenceCustomerIds};
}
