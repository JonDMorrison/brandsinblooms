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
  event('e1', 'buyer', [['S1', 'Sea Soil 1cuft', '901    Bagged Outdoor Soil', 2, 25.5, 1], ['P1', 'Petunia 4in', '101    Annuals', 6, 18, 2], ['E1','Eucalyptus bunch','Floral',2,12,8], ['W1','Wreath','Holiday',1,20,9]]),
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
function fakeClient(candidates: unknown, scope: unknown = {customer_ids: ['buyer', 'other', 'blank', 'both'], rows: 4, invalid_rows: 0}, rows: unknown[] = events) {
  const rpc = vi.fn(async () => {
    const evidence = scope as {customer_ids:string[];invalid_rows:number};
    return evidence.invalid_rows ? {data:null,error:{message:'Report facts do not match their completed source ledger.'}} : {data:{scanned:rows.length,last_id:'e4',customer_ids:evidence.customer_ids,candidates,provenance:rows},error:null};
  });
  const neqCalls: Array<{table: string; column: string; value: unknown}> = [];
  const from = (table: string) => {
    const data = table === 'customer_intelligence_imports' ? [report] : table === 'customer_intelligence_source_events' ? rows : [];
    const q = {select: () => q, eq: () => q, neq: (column: string, value: unknown) => {neqCalls.push({table, column, value}); return q;},
      is: () => q, lte: () => q, gte: () => q, in: () => q, order: () => q, range: async () => ({data, error: null})};
    return q;
  };
  return {rpc, from, neqCalls} as unknown as PersistenceClient & {rpc: typeof rpc; neqCalls: typeof neqCalls};
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
    {mode: 'purchased', product: 'eucalyptus', start_date:'2025-01-01', end_date:'2025-12-31'},
    {mode: 'purchased', product: 'eucalyptus bunch'},
    {mode: 'purchased', product: 'wreath'},
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
  it('validates nonmatching-row provenance even when the full-snapshot fingerprint is cached', async () => {
    const bad=events.map(e=>e.id==='e2'?{...e,raw_data:{...(e.raw_data as object),source_sha256:'other'}}:e);
    await expect(loadProductSearchFacts(fakeClient(serverCandidates(['sea soil']),undefined,bad),T,'2026-11-03T00:00:00Z',rule,store)).rejects.toThrow('ledger');
  });
  it('rejects a concurrent source mutation after cached verification and paged reads',async()=>{
    const fingerprint=vi.fn().mockResolvedValueOnce('fp').mockResolvedValueOnce('changed');
    await expect(loadProductSearchFacts(fakeClient(serverCandidates(['sea soil'])),T,'2026-11-03T00:00:00Z',rule,{...store,fingerprint})).rejects.toThrow('changed during');
  });
  it('rejects line positions that do not line up with the lines', () => {
    const bad = {...serverCandidates(['sea soil'])[0], item_indexes: [0, 1]};
    expect(() => periodSummaryFacts([bad], T)).toThrow('reconciliation');
  });
  it('asks the database only for matching lines, never every report row', async () => {
    const client = fakeClient(serverCandidates(['sea soil']));
    await loadProductSearchFacts(client, T, '2026-11-03T00:00:00Z', rule, store);
    expect(client.rpc).toHaveBeenCalledWith('bloom_summary_search_page', expect.objectContaining({p_term: 'sea soil', p_import_id: 'r2025', p_after:null}));
  });
  it('never pages through stored IdealPOS journal lines, which Bloom does not use', async () => {
    const client = fakeClient(serverCandidates(['sea soil']));
    await loadProductSearchFacts(client, T, '2026-11-03T00:00:00Z', rule, store);
    expect(client.neqCalls).toContainEqual({table: 'customer_purchase_line_items', column: 'source', value: 'ideal'});
  });
  it('falls back to the full scan for rules that need every line', async () => {
    expect(await loadProductSearchFacts(fakeClient([]), T, '2026-11-03T00:00:00Z', {mode: 'purchased', category: 'Plants'}, store)).toBeNull();
  });
});

describe('search result wording', () => {
  it('reads as a complete answer, not a failed lookup', async () => {
    const {exploreMessage} = await import('../../../../supabase/functions/bloom-assist/tools/implementations/customer-exploration');
    const message = exploreMessage('purchased', 1828, 19791, 26315);
    expect(message).toBe('Search succeeded: 1,828 customers bought it. 19,791 have purchase records without it. 26,315 have no purchase records on file, so they are counted separately. This is a complete answer, not an error.');
    expect(message).not.toMatch(/unknown|require more data|could not/i);
  });
});

describe('each report import is verified once, then reused until it changes', () => {
  const rule: PurchaseRule = {mode: 'purchased', product: 'sea soil'};
  const verified = events.filter(e => e.customer_id !== 'blank');
  function memoryStore(fingerprint = 'fp1') {
    const saved = new Map<string, string>();
    return {saved, store: {fingerprint: async () => fingerprint, get: async (id: string) => saved.get(id) ?? null, set: async (id: string, value: string) => {saved.set(id, value);}} as VerifiedSnapshotStore};
  }
  it('verifies every row of a new import, then records its fingerprint', async () => {
    const {saved, store: s} = memoryStore();
    const result = await loadProductSearchFacts(fakeClient(serverCandidates(['sea soil']), undefined, verified), T, '2026-11-03T00:00:00Z', rule, s);
    expect(result).not.toBeNull();
    expect(saved.get('r2025')).toBe('fp1');
  });
  it('rejects the search when any row of the import disagrees with its ledger, even one that does not match the term', async () => {
    const {saved, store: s} = memoryStore();
    const tampered = verified.map(e => e.id === 'e2' ? {...e, raw_data: {...(e.raw_data as object), source_sha256: 'other'}} : e);
    await expect(loadProductSearchFacts(fakeClient(serverCandidates(['sea soil']), undefined, tampered), T, '2026-11-03T00:00:00Z', rule, s)).rejects.toThrow('ledger');
    expect(saved.size).toBe(0);
  });
  it('falls back to the full scan when an import has product lines with no name or code', async () => {
    const {saved, store: s} = memoryStore();
    expect(await loadProductSearchFacts(fakeClient(serverCandidates(['sea soil'])), T, '2026-11-03T00:00:00Z', rule, s)).toBeNull();
    expect(saved.size).toBe(0);
  });
  it('re-verifies when the fingerprint changed since the last verification', async () => {
    const {saved, store: s} = memoryStore('fp2');
    saved.set('r2025', 'fp1');
    const tampered = verified.map(e => e.id === 'e2' ? {...e, raw_data: {...(e.raw_data as object), period_end: '2025-06-30'}} : e);
    await expect(loadProductSearchFacts(fakeClient(serverCandidates(['sea soil']), undefined, tampered), T, '2026-11-03T00:00:00Z', rule, s)).rejects.toThrow('ledger');
  });
});

describe('customer codes are read by ID cursor', () => {
  it('returns every live customer once across pages, each page starting after the last ID', async () => {
    const {readCustomerIdentities} = await import('../../../../supabase/functions/_shared/customer-intelligence/load-product-search-facts');
    const all = Array.from({length: 2500}, (_, i) => ({id: `c${String(i).padStart(5, '0')}`, tenant_id: T, external_id: `X${i}`}));
    const cursors: (string | null)[] = [];
    const client = {from: () => {
      let after: string | null = null;
      const q = {select: () => q, eq: () => q, is: () => q, gt: (_c: string, v: string) => {after = v; return q;}, order: () => q,
        range: async (from: number, to: number) => {cursors.push(after); return {data: all.filter(r => !after || r.id > after).slice(from, to + 1), error: null};}};
      return q;
    }} as unknown as PersistenceClient;
    const rows = await readCustomerIdentities(client, T, 1000);
    expect(rows.map(r => r.id)).toEqual(all.map(r => r.id));
    expect(cursors).toEqual([null, 'c00999', 'c01999']);
  });
});

describe('a cold first search is retried once', () => {
  it('retries a statement timeout once and returns the second result', async () => {
    const {retryOnceOnTimeout} = await import('../../../../supabase/functions/_shared/customer-intelligence/load-product-search-facts');
    const call = vi.fn()
      .mockResolvedValueOnce({data: null, error: {message: 'canceling statement due to statement timeout', code: '57014'}})
      .mockResolvedValueOnce({data: ['ok'], error: null});
    expect(await retryOnceOnTimeout(call)).toEqual({data: ['ok'], error: null});
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('does not retry other errors or a second timeout', async () => {
    const {retryOnceOnTimeout} = await import('../../../../supabase/functions/_shared/customer-intelligence/load-product-search-facts');
    const denied = vi.fn().mockResolvedValue({data: null, error: {message: 'permission denied'}});
    expect((await retryOnceOnTimeout(denied)).error?.message).toBe('permission denied');
    expect(denied).toHaveBeenCalledTimes(1);
    const slow = vi.fn().mockResolvedValue({data: null, error: {message: 'canceling statement due to statement timeout', code: '57014'}});
    expect((await retryOnceOnTimeout(slow)).error?.code).toBe('57014');
    expect(slow).toHaveBeenCalledTimes(2);
  });
});

describe('one-year queries exclude irrelevant report pages without losing historical evidence',()=>{
  it('keeps historical customers classified as having evidence, and never scans old report lines',async()=>{
    const old={...report,id:'r2024',source_period_start:'2024-01-01',source_period_end:'2024-12-31'};
    const oldEvent={...event('older','previous-year', [['H1','Herb','Herbs',1,10,1]]),
      import_id:'r2024',raw_data:{kind:'purchase_summary',currency:'CAD',period_start:'2024-01-01',
      period_end:'2024-12-31',source_sha256:'sha',items:[['H1','Herb','Herbs',1,10,1]]}};
    const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>{
      if(name==='bloom_summary_evidence_scope'){
        expect(args.p_imports).toEqual([{id:'r2024'}]);
        return {data:{customer_ids:['previous-year'],rows:1,invalid_rows:0},error:null};
      }
      if(name!=='bloom_summary_search_page'||args.p_import_id!=='r2025')throw Error('Unexpected report page');
      return {data:{scanned:4,last_id:'e4',customer_ids:['buyer','other','blank','both'],
        candidates:serverCandidates(['sea soil']),provenance:events},error:null};
    });
    const from=(table:string)=>{
      const rows=table==='customer_intelligence_imports'?[report,old]:
        table==='customer_intelligence_source_events'?[...events,oldEvent]:[];
      const q={select:()=>q,eq:()=>q,lte:()=>q,is:()=>q,neq:()=>q,order:()=>q,range:async()=>({data:rows,error:null})};
      return q;
    };
    const client={rpc,from} as unknown as PersistenceClient;
    const rule:PurchaseRule={mode:'purchased',product:'sea soil',start_date:'2025-01-01',end_date:'2025-12-31'};
    const result=await loadProductSearchFacts(client,T,'2026-11-03T00:00:00Z',rule,store);
    expect(result!.evidenceCustomerIds.has('previous-year')).toBe(true);
    expect(rpc.mock.calls.filter(([name])=>name==='bloom_summary_search_page')).toHaveLength(1);
    expect(rpc).not.toHaveBeenCalledWith('bloom_summary_search_page',
      expect.objectContaining({p_import_id:'r2024'}));
  });
});
