import {describe, expect, it, vi} from 'vitest';
import {explorePurchases, groupMatches, type PurchaseFact, type PurchaseRule} from '../../../../supabase/functions/_shared/customer-intelligence/purchase-exploration';
import {periodSummaryFacts, type PeriodSummaryEvent} from '../../../../supabase/functions/_shared/customer-intelligence/period-summary';
import {loadProductSearchFacts, productSearchTerms, type VerifiedSnapshotStore} from '../../../../supabase/functions/_shared/customer-intelligence/load-product-search-facts';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';

const T = 'tenant';
type Item = [string, string, string, number, number, number];
const report = {id: 'r2025', tenant_id: T, status: 'completed', source: 'ideal', source_sha256: 'sha', source_filename: 'sales.xls',
  source_period_start: '2025-01-01', source_period_end: '2025-12-31', created_at: '2026-01-02T00:00:00Z', completed_at: '2026-01-02T00:00:00Z', reconciliation: null};
function event(id: string, customer: string, items: Item[]): PeriodSummaryEvent {
  return {id, tenant_id: T, customer_id: customer, import_id: report.id, source: 'ideal', created_at: '2026-01-02T00:00:00Z',
    raw_data: {kind: 'purchase_summary', currency: 'CAD', period_start: '2025-01-01', period_end: '2025-12-31', source_sha256: 'sha', items}};
}
const events = [
  event('e1', 'buyer', [['S1', 'Sea Soil 1cuft', '901    Bagged Outdoor Soil', 2, 25.5, 1], ['P1', 'Petunia 4in', '101    Annuals', 6, 18, 2]]),
  event('e2', 'other', [['M1', 'Monstera 6in', '1,501    Tropicals', 1, 40, 3]]),
  event('e3', 'blank', [['', ' ', '', 1, 5, 4], ['H1', 'Basil', '102    Herbs', 1, 4, 5]]),
  event('e4', 'both', [['F1', 'Fern 8in', '1,501    Tropicals', 1, 30, 6], ['S2', 'SEA SOIL Potting', '902    Bagged Indoor Soil', 1, 20, 7]]),
];
const population = ['blank', 'both', 'buyer', 'nohistory', 'other'];

/** What the database helper returns: candidate lines only, with their original positions. */
function serverCandidates(terms: string[]) {
  return events.flatMap(e => {
    const raw = e.raw_data as {items: Item[]};
    const kept = raw.items.map((item, index) => ({item, index})).filter(({item}) =>
      (!item[0].trim() && !item[1].trim()) || terms.some(term => `${item[0]} ${item[1]} ${item[2]}`.toLowerCase().includes(term)));
    return kept.length ? [{...e, raw_data: {...raw, items: kept.map(k => k.item)}, item_indexes: kept.map(k => k.index)}] : [];
  });
}
function fakeClient(candidates: unknown, scope: unknown = {customer_ids: ['buyer', 'other', 'blank', 'both'], rows: 4, invalid_rows: 0}) {
  const rpc = vi.fn(async (name: string) => ({data: name === 'bloom_summary_evidence_scope' ? scope : name === 'bloom_summary_product_candidates' ? candidates : null, error: null}));
  const from = (table: string) => {
    const data = table === 'customer_intelligence_imports' ? [report] : [];
    const q = {select: () => q, eq: () => q, is: () => q, lte: () => q, gte: () => q, in: () => q, order: () => q, range: async () => ({data, error: null})};
    return q;
  };
  return {rpc, from} as unknown as PersistenceClient & {rpc: typeof rpc};
}
const store: VerifiedSnapshotStore = {fingerprint: async () => 'fp', get: async () => 'fp', set: async () => undefined};
function run(rule: PurchaseRule, facts: PurchaseFact[], knownEvidence?: Set<string>) {
  return explorePurchases({tenantId: T, userId: 'u', conversationId: 'c', timezone: 'America/Vancouver', population, facts, rule, label: 'test', now: '2026-11-03T00:00:00Z', id: 'set', knownEvidence});
}

describe('department labels with POS codes', () => {
  it('matches the words a person uses, ignoring the numeric code and plurals', () => {
    expect(groupMatches('Tropical', '1,501    Tropicals')).toBe(true);
    expect(groupMatches('tropicals', '1,501    Tropical')).toBe(true);
    expect(groupMatches('Bagged Soil', '901    Bagged Outdoor Soil')).toBe(true);
    expect(groupMatches('1,501    Tropicals', '1,501    Tropicals')).toBe(true);
    expect(groupMatches('Herbs', '101    Annuals')).toBe(false);
    expect(groupMatches('Annuals', '203    Perennials')).toBe(false);
  });
});

describe('which searches the database may narrow', () => {
  it('narrows product and department searches only', () => {
    expect(productSearchTerms({mode: 'purchased', product: 'Sea Soil'})).toEqual(['sea soil']);
    expect(productSearchTerms({mode: 'not_purchased', product: 'wreath', start_date: '2025-01-01'})).toEqual(['wreath']);
    expect(productSearchTerms({mode: 'purchased', department: 'Tropicals'})).toEqual(['tropical']);
    expect(productSearchTerms({mode: 'purchased', department: '1,501    Tropicals'})).toEqual(['tropical']);
    expect(productSearchTerms({mode: 'all'})).toBeNull();
    expect(productSearchTerms({mode: 'purchased', category: 'Plants'})).toBeNull();
    expect(productSearchTerms({mode: 'purchased', start_date: '2025-01-01'})).toBeNull();
    expect(productSearchTerms({mode: 'purchased', product: 'say "hi"'})).toBeNull();
    expect(productSearchTerms({mode: 'purchased', product: 'Café'})).toBeNull();
  });
});

describe('narrowed search gives the same answer as the full scan', () => {
  const rules: PurchaseRule[] = [
    {mode: 'purchased', product: 'sea soil'},
    {mode: 'not_purchased', product: 'sea soil'},
    {mode: 'purchased', product: 'sea soil', start_date: '2025-01-01', end_date: '2025-12-31'},
    {mode: 'purchased', product: 'sea soil', start_date: '2025-06-01'},
    {mode: 'purchased', department: 'Tropical'},
    {mode: 'purchased', product: 's1', product_match: 'sku'},
  ];
  for (const rule of rules) it(JSON.stringify(rule), async () => {
    const full = run(rule, periodSummaryFacts(events, T));
    const narrowed = await loadProductSearchFacts(fakeClient(serverCandidates(productSearchTerms(rule)!)), T, '2026-11-03T00:00:00Z', rule, store);
    expect(narrowed).not.toBeNull();
    const fast = run(rule, narrowed!.facts, narrowed!.evidenceCustomerIds);
    expect(fast.included_ids).toEqual(full.included_ids);
    expect(fast.excluded_ids).toEqual(full.excluded_ids);
    expect(fast.unknown_ids).toEqual(full.unknown_ids);
    expect(fast.reasons).toEqual(full.reasons);
    expect(fast.evidence_ids).toEqual(full.evidence_ids);
  });

  it('finds Tropicals buyers and keeps customers without history unknown', async () => {
    const rule: PurchaseRule = {mode: 'purchased', department: 'Tropical'};
    const narrowed = await loadProductSearchFacts(fakeClient(serverCandidates(['tropical'])), T, '2026-11-03T00:00:00Z', rule, store);
    const set = run(rule, narrowed!.facts, narrowed!.evidenceCustomerIds);
    expect(set.included_ids).toEqual(['both', 'other']);
    expect(set.unknown_ids).toContain('nohistory');
    expect(set.reasons.nohistory).toBe('no_purchase_history');
    expect(set.evidence_ids.both).toEqual(['e4:0']);
  });
});

describe('narrowed report rows are still checked', () => {
  const rule: PurchaseRule = {mode: 'purchased', product: 'sea soil'};
  it('keeps original line positions in evidence IDs', async () => {
    const narrowed = await loadProductSearchFacts(fakeClient(serverCandidates(['sea soil'])), T, '2026-11-03T00:00:00Z', rule, store);
    expect(narrowed!.facts.map(f => f.id).sort()).toEqual(['e1:0', 'e3:0', 'e4:1']);
  });
  it('rejects a row from a different source file', async () => {
    const tampered = serverCandidates(['sea soil']).map(e => ({...e, raw_data: {...(e.raw_data as object), source_sha256: 'other'}}));
    await expect(loadProductSearchFacts(fakeClient(tampered), T, '2026-11-03T00:00:00Z', rule, store)).rejects.toThrow('ledger');
  });
  it('rejects the search when any report row disagrees with its import', async () => {
    await expect(loadProductSearchFacts(fakeClient(serverCandidates(['sea soil']), {customer_ids: [], rows: 4, invalid_rows: 1}), T, '2026-11-03T00:00:00Z', rule, store)).rejects.toThrow('ledger');
  });
  it('rejects line positions that do not line up with the lines', () => {
    const bad = {...serverCandidates(['sea soil'])[0], item_indexes: [0, 1]};
    expect(() => periodSummaryFacts([bad], T)).toThrow('reconciliation');
  });
  it('asks the database only for matching lines, never every report row', async () => {
    const client = fakeClient(serverCandidates(['sea soil']));
    await loadProductSearchFacts(client, T, '2026-11-03T00:00:00Z', rule, store);
    expect(client.rpc).toHaveBeenCalledWith('bloom_summary_product_candidates', expect.objectContaining({p_terms: ['sea soil'], p_import_ids: ['r2025']}));
  });
  it('falls back to the full scan for rules that need every line', async () => {
    expect(await loadProductSearchFacts(fakeClient([]), T, '2026-11-03T00:00:00Z', {mode: 'purchased', category: 'Plants'}, store)).toBeNull();
  });
});
