import {readProductSearchPages} from './bounded-search.ts';
import type {PersistenceClient} from '../../bloom-assist/types.ts';
import type {PurchaseFact, PurchaseRule} from './purchase-exploration.ts';
import {loadEligibleDatedFacts} from './load-analysis-facts.ts';
import {loadReportLedger, loadSummaryRows} from './load-reported-evidence.ts';
import {legacySummaryCertificate, verifyLegacySummarySnapshot} from './legacy-summary-evidence.ts';
import {currentSummaryImports, periodSummaryFacts, type PeriodSummaryEvent} from './period-summary.ts';
import {idealEvidenceTimestamp} from './ideal-metric-projection.ts';

/**
 * Company-wide product search without reading every report row.
 *
 * The database returns only report lines that could match the search, plus
 * the list of customers that have any report evidence. The exact matching
 * still happens here, with the same rules as the full scan. Every report
 * import is verified in full (ledger, shape and, for the reconciled legacy
 * snapshot, its certificate) once, and again whenever its fingerprint
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

type Identity = {id: string; tenant_id: string; external_id: string | null};
/**
 * Every live customer's code, read by ID cursor. Offset paging re-scans every
 * earlier row per page and timed out on the last pages of a 48,000-customer company.
 */
export async function readCustomerIdentities(client: PersistenceClient, tenantId: string, pageSize = 1000, maximum = 250000): Promise<Identity[]> {
  const rows: Identity[] = [];
  let after: string | null = null;
  for (;;) {
    let query = client.from('crm_customers').select('id,tenant_id,external_id').eq('tenant_id', tenantId).is('deleted_at', null).is('merged_into_customer_id', null);
    if (after) query = query.gt('id', after);
    const {data, error} = await query.order('id').range(0, pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Identity[];
    if (rows.length + page.length > maximum) throw new Error(`The analysis exceeds the ${maximum.toLocaleString()}-record safety limit. No partial total was returned.`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
    after = page[page.length - 1].id;
  }
}

type RpcResult = {data: unknown; error: {message: string; code?: string} | null};
/**
 * A first search on a cold cache can pass the 8 second statement limit while
 * it reads report rows from disk; those rows are then in memory and the same
 * query takes about a second. Retry exactly once, and only for a timeout.
 */
export async function retryOnceOnTimeout(call: () => PromiseLike<RpcResult>): Promise<RpcResult> {
  const first = await call();
  const timedOut = first.error && (first.error.code === '57014' || /statement timeout|canceling statement/i.test(first.error.message));
  return timedOut ? await call() : first;
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

  // Each active import is verified in full once, then again only when its fingerprint changes.
  // Returns false when the import has blank product lines, which only the full scan classifies exactly.
  const verifyImports = async (): Promise<boolean> => {
    let searchable = true;
    for (const parent of parents) {
      const before = await store.fingerprint(parent.id);
      if (before && (await store.get(parent.id)) === before) continue;
      const rows = (await loadSummaryRows(client, tenantId, cutoff, parent.id)).filter(row => row.import_id === parent.id);
      const certificate = legacy.get(parent.id);
      if (certificate) {
        const identities = await readCustomerIdentities(client, tenantId);
        await verifyLegacySummarySnapshot(rows as (PeriodSummaryEvent & {external_customer_code?: string})[], certificate, identities);
      } else {
        for (const row of rows) checkRowAgainstLedger(row, parent, false);
      }
      const facts = periodSummaryFacts(rows, tenantId); // Full shape validation.
      if (facts.some(fact => !fact.product_name?.trim() && !fact.product_code?.trim())) { searchable = false; continue; }
      const after = await store.fingerprint(parent.id);
      if (after !== before) throw Error('The report changed while it was being verified. Try the search again.');
      await store.set(parent.id, after);
    }
    return searchable;
  };
  const checkRowAgainstLedger = (row: CandidateEvent, parent: typeof parents[number] | undefined, isLegacy: boolean) => {
    const raw = row.raw_data as {period_start?: unknown; period_end?: unknown; source_sha256?: unknown} | null;
    if (!parent || row.tenant_id !== tenantId || row.source !== parent.source
      || !Number.isFinite(idealEvidenceTimestamp(row.created_at)) || idealEvidenceTimestamp(row.created_at) > idealEvidenceTimestamp(cutoff)
      || (!isLegacy && raw?.source_sha256 !== parent.source_sha256)
      || raw?.period_start !== parent.source_period_start || raw?.period_end !== parent.source_period_end)
      throw Error('Report facts do not match their completed source ledger.');
  };

  const importIds = parents.map(parent => parent.id);
  const [searchable, dated, pageResult] = await Promise.all([
    verifyImports(),
    loadEligibleDatedFacts(client, tenantId, cutoff),
    readProductSearchPages(client,tenantId,cutoff,importIds,terms),
  ]);
  const candidates = pageResult.candidates as CandidateEvent[];
  const scope = {customer_ids:pageResult.customer_ids};

  if (!searchable) return null;
  for (const row of candidates) {
    const parent = parents.find(p => p.id === row.import_id);
    checkRowAgainstLedger(row, parent, Boolean(parent && legacy.has(parent.id)));
  }

  const evidenceCustomerIds = new Set<string>(scope.customer_ids.filter((id): id is string => typeof id === 'string'));
  for (const fact of dated) if (fact.customer_id) evidenceCustomerIds.add(fact.customer_id);
  return {facts: [...dated, ...periodSummaryFacts(candidates, tenantId)], evidenceCustomerIds};
}
