import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {explorePurchases,analyzeBasket,assertDate,finiteNumber,localDate,validatePurchaseRule,type PurchaseFact,type CustomerSet} from '../../../../supabase/functions/_shared/customer-intelligence/purchase-exploration';
import {compareCustomerGrowth,moneyMinorUnits,type GrowthOrder,type GrowthSettings} from '../../../../supabase/functions/_shared/customer-intelligence/customer-growth';
import {rankCustomerPopulation,parseScoreWeights,type RankingRow} from '../../../../supabase/functions/_shared/customer-intelligence/customer-ranking';
import {readAllPages} from '../../../../supabase/functions/_shared/customer-intelligence/query-pages';
import {customerExplorationTools} from '../../../../supabase/functions/bloom-assist/tools/customer-exploration-registry';
import {requireAnalysisAccess,exploreCustomerPurchases} from '../../../../supabase/functions/bloom-assist/tools/implementations/customer-exploration';
import type {ToolExecutionContext} from '../../../../supabase/functions/bloom-assist/tools/types';

beforeAll(()=>vi.stubGlobal('crypto',webcrypto));afterAll(()=>vi.unstubAllGlobals());
const now='2026-10-07T19:00:00Z';
const base={tenantId:'t',userId:'u',conversationId:'c',timezone:'America/Vancouver',population:['alice','bob','cara','dan'],label:'Hydrangea buyers',now};
const fact=(id:string,customer_id:string,product_name:string|null,extra:Partial<PurchaseFact>={}):PurchaseFact=>({id,customer_id,product_name,tenant_id:'t',product_code:'sku-'+id,sales_category:'Nursery',department:'Plants',quantity:1,net_amount:25,currency:'CAD',purchased_at:'2026-09-01T19:00:00Z',created_at:'2026-10-01T00:00:00Z',source:'synthetic-test',...extra});
const facts=[fact('a-h','alice','Hydrangea'),fact('a-f','alice','Fertilizer',{purchased_at:'2026-09-10T19:00:00Z'}),fact('b-h','bob','Hydrangea'),fact('b-f','bob','Fertilizer',{purchased_at:'2026-10-06T19:00:00Z'}),fact('c-h','cara',null)];
const search=(rule:Parameters<typeof explorePurchases>[0]['rule'],previous?:CustomerSet,inputFacts=facts)=>explorePurchases({...base,facts:inputFacts,rule,previous});
describe('deterministic follow-up customer exploration',()=>{
 it('finds purchase customers without inventing missing names',()=>{const s=search({mode:'purchased',product:'hydrangea'});expect(s.included_ids).toEqual(['alice','bob']);expect(s.unknown_ids).toEqual(['cara','dan']);});
 it('keeps the exact previous population for the next question',()=>{const first=search({mode:'purchased',product:'hydrangea'});const next=search({mode:'purchased',product:'fertilizer'},first,[...facts,fact('d-f','dan','Fertilizer')]);expect(next.included_ids).toEqual(['alice','bob']);expect(next.trail.at(-1)?.input).toBe(2);expect(next.parent_id).toBe(first.id);});
 it('measures elapsed days after a prior purchase',()=>{const first=search({mode:'purchased',product:'hydrangea'});const next=search({mode:'purchased',product:'fertilizer',within_days:30},first);expect(next.included_ids).toEqual(['alice']);expect(next.excluded_ids).toEqual(['bob']);});
 it('can branch from an earlier group rather than a previous answer count',()=>{const first=search({mode:'purchased',product:'hydrangea'});const narrowed=search({mode:'purchased',product:'fertilizer',within_days:30},first);expect(search({mode:'purchased',product:'fertilizer'},first).included_ids).toHaveLength(2);expect(narrowed.included_ids).toHaveLength(1);});
 it('distinguishes known non-matches from missing history',()=>{const s=search({mode:'not_purchased',product:'hydrangea'},undefined,[fact('a','alice','Rose'),fact('b','bob','Hydrangea'),fact('c','cara',null)]);expect(s.included_ids).toEqual(['alice']);expect(s.excluded_ids).toEqual(['bob']);expect(s.unknown_ids).toEqual(['cara','dan']);});
 it('can inspect everyone without hidden consent or persona filtering',()=>expect(search({mode:'all'}).included_ids).toEqual(base.population));
 it('matches exact SKU independently of a missing product name',()=>expect(search({mode:'purchased',product:'sku-c-h',product_match:'sku'}).included_ids).toEqual(['cara']));
 it('does not treat returns as new purchases',()=>expect(search({mode:'purchased',product:'Hydrangea'},undefined,[fact('a','alice','Hydrangea',{quantity:-1})]).included_ids).toEqual([]));
 it('keeps missing quantity unknown',()=>expect(search({mode:'purchased',product:'Hydrangea'},undefined,[fact('a','alice','Hydrangea',{quantity:null})]).unknown_ids).toContain('alice'));
 it('keeps zero-value coupon stock searchable without counting it as general shopping',()=>{
  const input=[fact('coupon','alice','Coupon',{net_amount:0})];
  expect(search({mode:'purchased',product:'Coupon'},undefined,input).included_ids).toEqual(['alice']);
  expect(search({mode:'purchased',product:'sku-coupon',product_match:'sku'},undefined,input).included_ids).toEqual(['alice']);
  expect(search({mode:'purchased'},undefined,input).excluded_ids).toEqual(['alice']);
  expect(search({mode:'all'},undefined,input).included_ids).toEqual(base.population);
 });
 it.each([0,-10,null,'bad'])('does not count %s value as general purchase activity',amount=>{
  const result=search({mode:'purchased'},undefined,[fact('a','alice','Coupon',{net_amount:amount})]);
  expect(result.included_ids).toEqual([]);
  expect(amount===null||amount==='bad'?result.unknown_ids:result.excluded_ids).toContain('alice');
 });
 it('excludes coupon-only prior history from repeat year intersections for dated and imported evidence',()=>{
  for(const summary of [false,true]){
   const evidence=(id:string,customer:string,year:number,amount:number)=>fact(id,customer,'Synthetic item',{
    net_amount:amount,purchased_at:summary?null:`${year}-09-01T19:00:00Z`,
    ...(summary?{evidence_kind:'period_summary' as const,source_period_start:`${year}-01-01`,source_period_end:`${year}-12-31`}:{})});
   const input=[evidence('a-old','alice',2025,0),evidence('a-now','alice',2026,50),evidence('b-old','bob',2025,20),evidence('b-now','bob',2026,30),evidence('c-old','cara',2025,20),evidence('c-now','cara',2026,0)];
   const prior=search({mode:'purchased',start_date:'2025-01-01',end_date:'2025-12-31'},undefined,input);
   expect(prior.included_ids).toEqual(['bob','cara']);
   expect(search({mode:'purchased',start_date:'2026-01-01',end_date:'2026-12-31'},prior,input).included_ids).toEqual(['bob']);
  }
 });
 it('deduplicates repeated identical purchase rows',()=>expect(search({mode:'purchased',product:'Hydrangea'},undefined,[facts[0],facts[0]]).evidence_ids.alice).toEqual(['a-h']));
 it('rejects conflicting duplicate purchase identities',()=>expect(()=>search({mode:'all'},undefined,[facts[0],{...facts[0],quantity:2}])).toThrow(/Conflicting/));
 it('rejects cross-tenant facts',()=>expect(()=>search({mode:'all'},undefined,[{...facts[0],tenant_id:'other'}])).toThrow(/Cross-company/));
 it.each(['tenant_id','user_id','conversation_id'] as const)('rejects result reuse across %s',field=>{const s=search({mode:'all'});expect(()=>search({mode:'all'},{...s,[field]:'other'})).toThrow(/outside/);});
 it('rejects invisibly shrinking an old audience after access changes',()=>{const s=search({mode:'all'});expect(()=>explorePurchases({...base,population:['alice'],facts,rule:{mode:'all'},previous:s})).toThrow(/no longer accessible/);});
 it('does not count facts created after the source-read time',()=>expect(search({mode:'purchased',product:'Hydrangea'},undefined,[fact('a','alice','Hydrangea',{created_at:'2027-01-01'})]).included_ids).toEqual([]));
 it('reuses timezone formatters across large ledgers while validating null dates', () => {
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  const constructor = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locales, options) => new NativeDateTimeFormat(locales, options));
  try {
   for (let i = 0; i < 2000; i++) expect(localDate('2025-01-01T01:00:00Z', 'Pacific/Honolulu')).toBe('2024-12-31');
   expect(constructor).toHaveBeenCalledTimes(1);
   expect(localDate(null, 'Pacific/Honolulu')).toBeNull();
   expect(() => localDate(null, 'Invalid/Timezone')).toThrow();
   expect(localDate('2025-01-01T01:00:00Z', 'Pacific/Kiritimati')).toBe('2025-01-01');
  } finally { constructor.mockRestore(); }
 });
 it('uses local rather than UTC day boundaries',()=>{const s=search({mode:'purchased',product:'Hydrangea',start_date:'2026-09-01',end_date:'2026-09-01'},undefined,[fact('a','alice','Hydrangea',{purchased_at:'2026-09-02T01:00:00Z'})]);expect(s.included_ids).toEqual(['alice']);});
 it('counts unique customers, not units, in basket percentages',()=>{const r=analyzeBasket([...facts,facts[0]],['alice','bob'],'t');expect(r.denominator).toBe(2);expect(r.products.find(p=>p.product==='Hydrangea')).toEqual({product:'Hydrangea',customers:2,percent:100});});
 it('requires earlier dated evidence for within-days questions',()=>expect(()=>search({mode:'purchased',product:'Fertilizer',within_days:30})).toThrow(/earlier result/));
 it('rejects unknown rule fields instead of ignoring them',()=>expect(()=>validatePurchaseRule({mode:'purchased',age:20})).toThrow(/Unsupported/));
 it('rejects hidden filters on an all-customer rule',()=>expect(()=>validatePurchaseRule({mode:'all',product:'x'})).toThrow(/hidden/));
 it.each(['2026-02-30','not-a-date','2026-9-1'])('rejects invalid calendar date %s',d=>expect(()=>assertDate(d)).toThrow());
 it('rejects reversed date ranges',()=>expect(()=>validatePurchaseRule({mode:'purchased',start_date:'2026-09-05',end_date:'2026-09-01'})).toThrow());
 it('does not manufacture zero from blank and null numbers',()=>{for(const v of [null,undefined,'',true,{},'NaN','Infinity'])expect(finiteNumber(v)).toBeNull();expect(finiteNumber('0')).toBe(0);});
 it('rejects invalid time zones',()=>expect(()=>localDate(now,'Bogus/Zone')).toThrow());
});
const settings:GrowthSettings={current_start:'2026-09-01',current_end:'2026-09-30',baseline_start:'2025-09-01',baseline_end:'2025-09-30',currency:'CAD',timezone:'America/Vancouver',data_cutoff:now,spend_weight:50,visits_weight:50};
const order=(id:string,customer:string,date:string,total:number|string=50,extra:Partial<GrowthOrder>={}):GrowthOrder=>({id,tenant_id:'t',crm_customer_id:customer,order_date:date+'T19:00:00Z',created_at:'2026-10-01T00:00:00Z',total_amount:total,refund_amount:null,currency:'CAD',status:'completed',...extra});
const growth=(orders:GrowthOrder[],s=settings)=>compareCustomerGrowth(orders,['alice'],'t',s);
describe('customer-over-customer growth, not invented estimates',()=>{
 it('calculates one visit to two as 100% growth, index 200',()=>{const r=growth([order('1','alice','2025-09-01'),order('2','alice','2026-09-01'),order('3','alice','2026-09-02')]);expect(r.rows[0]).toMatchObject({growth_index:200,growth_change_percent:100,visits_change_percent:100,spend_change_percent:100,state:'retained'});});
 it('keeps no-data customers unscored',()=>expect(growth([]).rows[0]).toMatchObject({growth_index:null,state:'no_comparable_history'}));
 it('does not invent percentage growth from a zero baseline',()=>expect(growth([order('1','alice','2026-09-01')]).rows[0]).toMatchObject({growth_index:null,state:'newly_observed'}));
 it('identifies lapsed customers',()=>expect(growth([order('1','alice','2025-09-01')]).rows[0]).toMatchObject({growth_index:0,state:'lapsed'}));
 it('identifies reactivation only when earlier purchase history exists',()=>expect(growth([order('1','alice','2024-09-01'),order('2','alice','2026-09-01')]).rows[0].state).toBe('reactivated'));
 it('excludes free and fully refunded visits from retention and reactivation',()=>{
  for(const refunded of [false,true]){
   const inactive=(id:string,date:string)=>order(id,'alice',date,refunded?50:0,refunded?{status:'refunded',refund_amount:50}:{});
   expect(growth([inactive('old','2025-09-01'),order('paid','alice','2026-09-01')]).rows[0]).toMatchObject({state:'newly_observed',baseline_visits:0,current_visits:1});
   expect(growth([inactive('earlier','2024-09-01'),order('paid','alice','2026-09-01')]).rows[0].state).toBe('newly_observed');
   expect(growth([order('paid','alice','2025-09-01'),inactive('now','2026-09-01')]).rows[0]).toMatchObject({state:'lapsed',current_visits:0,current_spend:0});
  }
 });
 it('sums decimal currency exactly',()=>expect(growth([order('1','alice','2026-09-01','0.10'),order('2','alice','2026-09-02','0.20')]).rows[0].current_spend).toBe(.3));
 it('subtracts known partial refunds',()=>expect(growth([order('1','alice','2026-09-01',100,{refund_amount:20,status:'partially_refunded'})]).rows[0].current_spend).toBe(80));
 it('does not invent an unknown refund amount',()=>expect(growth([order('1','alice','2026-09-01',100,{status:'refunded'})]).rows[0].state).toBe('incomplete_data'));
 it('keeps invalid order values unscored',()=>expect(growth([order('1','alice','2025-09-01'),order('2','alice','2026-09-01','bad')]).rows[0].growth_index).toBeNull());
 it('ignores explicitly cancelled orders',()=>expect(growth([order('1','alice','2026-09-01',100,{status:'cancelled'})]).rows[0].current_visits).toBe(0));
 it('does not combine currencies',()=>expect(growth([order('1','alice','2026-09-01',100,{currency:'USD'})]).rows[0]).toMatchObject({current_spend:0,other_currency_rows:1}));
 it('rejects cross-company orders',()=>expect(()=>growth([order('1','alice','2026-09-01',100,{tenant_id:'other'})])).toThrow(/Cross-company/));
 it('deduplicates repeated identical orders',()=>{const o=order('1','alice','2026-09-01');expect(growth([o,o]).rows[0].current_visits).toBe(1);});
 it('rejects inconsistent versions of an order',()=>{const o=order('1','alice','2026-09-01');expect(()=>growth([o,{...o,total_amount:90}])).toThrow(/Conflicting/);});
 it('requires explicit daily normalization for different-length periods',()=>{expect(()=>growth([],{...settings,current_end:'2026-09-29'})).toThrow(/different lengths/);expect(()=>growth([],{...settings,current_end:'2026-09-29',per_day_rates:true})).not.toThrow();});
 it('rejects overlapping periods',()=>expect(()=>growth([],{...settings,baseline_end:'2026-09-01'})).toThrow(/non-overlapping/));
 it('rejects future period endpoints',()=>expect(()=>growth([],{...settings,current_end:'2027-09-30'})).toThrow());
 it('rejects zero total weight',()=>expect(()=>growth([],{...settings,spend_weight:0,visits_weight:0})).toThrow(/Weights/));
 it('never claims observed growth proves campaign causation',()=>expect(growth([]).limitations.join(' ')).toMatch(/not proof/));
 it.each(['1.234','bad','','Infinity'])('rejects invalid money %s',v=>expect(moneyMinorUnits(v)).toBeNull());
});
const ranked=(id:string,extra:Partial<RankingRow>={}):RankingRow=>({customer_id:id,lifetime_value:100,purchase_frequency:1,days_since_last_purchase:5,purchase_velocity:0,total_quantity:10,departments_shopped:1,category_spend:{Nursery:100},department_spend:{Plants:100},...extra});
describe('transparent weighted rankings',()=>{
 it('explicit weights replace rather than augment defaults',()=>expect(parseScoreWeights({overall:100})).toEqual({value:0,quantity:0,breadth:0,frequency:0,overall:100,recency:0,trend:0}));
 it('ranks ties equally and deterministically',()=>expect(rankCustomerPopulation([ranked('b'),ranked('a')],{weights:{overall:100}}).rows.map(r=>[r.customer_id,r.score])).toEqual([['a',50],['b',50]]));
 it('makes more recent customers rank higher',()=>expect(rankCustomerPopulation([ranked('old',{days_since_last_purchase:90}),ranked('new')],{weights:{recency:100}}).rows[0].customer_id).toBe('new'));
 it('shows missing factors instead of treating them as zero',()=>expect(rankCustomerPopulation([ranked('a',{lifetime_value:null}),ranked('b')],{weights:{overall:100}}).unranked).toEqual([{customer_id:'a',missing_factors:['overall']}])) ;
 it('permits irrelevant missing fields when their weight is zero',()=>expect(rankCustomerPopulation([ranked('a',{purchase_frequency:null})],{weights:{overall:100}}).eligible_customers).toBe(1));
 it('reports customers outside the selected top-N',()=>expect(rankCustomerPopulation([ranked('a'),ranked('b')],{limit:1}).omitted_by_limit).toBe(1));
 it('reports missing category history as unknown',()=>expect(rankCustomerPopulation([ranked('a',{category_spend:{}})],{dimension:'category',dimension_value:'Nursery',weights:{value:100}}).unranked).toHaveLength(1));
 it.each([{secret:100},{overall:-1},{overall:0},{overall:'100'}])('rejects invalid weights %j',weights=>expect(()=>parseScoreWeights(weights)).toThrow());
 it('exposes the source values for every score',()=>expect(rankCustomerPopulation([ranked('a')]).rows[0]).toHaveProperty('source_values.overall',100));
});
describe('complete queries and permission checks',()=>{
 it('reads beyond default API limits',async()=>{const all=Array.from({length:6123},(_,id)=>id);const result=await readAllPages(async(a,b)=>({data:all.slice(a,b+1),error:null}));expect(result).toHaveLength(6123);});
 it('fails rather than reporting a partial population',async()=>await expect(readAllPages(async()=>({data:Array(1000).fill(1),error:null}),1500)).rejects.toThrow(/partial/));
 it('propagates API errors',async()=>await expect(readAllPages(async()=>({data:null,error:{message:'Permission denied'}}))).rejects.toThrow('Permission denied'));
 it('does not fall back to a service client for customer reads',async()=>await expect(requireAnalysisAccess({tenantId:'t',userId:'u',serviceClient:{}} as ToolExecutionContext)).rejects.toThrow(/authenticated/));
 it('requires both customer and report permissions',async()=>{const rpc=vi.fn().mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:false,error:null});await expect(requireAnalysisAccess({tenantId:'t',userId:'u',dataClient:{rpc}} as unknown as ToolExecutionContext)).rejects.toThrow(/reporting/);expect(rpc).toHaveBeenCalledTimes(2);});
 it('checks tenant context before running a query',async()=>await expect(requireAnalysisAccess({tenantId:'t',authenticatedTenantId:'other',userId:'u',dataClient:{}} as ToolExecutionContext)).rejects.toThrow());
 it('requires a scope, so a follow-up cannot silently search everyone',async()=>await expect(exploreCustomerPurchases({criteria:{mode:'all'}},{} as ToolExecutionContext)).rejects.toThrow(/starting population/));
 it('makes only the save action a confirmation-required mutation',()=>{expect(customerExplorationTools.filter(t=>t.requires_confirmation).map(t=>t.function.name)).toEqual(['save_customer_set_segment']);});
});

describe('Bloom can actually discover the new tools',()=>{
 it('exposes read-only exploration to query intent, not just analytics intent',()=>expect(customerExplorationTools.filter(t=>!t.requires_confirmation).every(t=>t.category==='query')).toBe(true));
});

// Synthetic-only annual dashboard coverage. No client counts or records.
import { customerGrowthBreakdown, type GrowthBreakdownSettings } from '../../../../supabase/functions/_shared/customer-intelligence/customer-growth-breakdown';
const reviewedCoverage = { status: 'reviewed_complete' as const, evidence: 'Synthetic complete source reconciled to order ledger', reviewedAt: now };
const unreviewedCoverage = { status: 'unverified' as const, evidence: '', reviewedAt: null };
const breakdownSettings: GrowthBreakdownSettings = { year: 2025, currentEnd: '2025-12-31', currency: 'CAD', timezone: 'America/Vancouver', cutoff: now, periods: reviewedCoverage, earlierHistory: reviewedCoverage };
const cohortIds = ['retained', 'lost', 'new', 'recovered'];
const cohortOrders = [
 order('r-old', 'retained', '2024-12-15', 80), order('r-now', 'retained', '2025-04-01', 120),
 order('lost-old', 'lost', '2024-07-01', 50), order('new-now', 'new', '2025-04-02', 60),
 order('recovered-earlier', 'recovered', '2023-01-01', 30), order('recovered-now', 'recovered', '2025-05-01', 90),
];
const breakdown = (input = cohortOrders, overrides: Partial<GrowthBreakdownSettings> = {}) => customerGrowthBreakdown(input, cohortIds, 't', { ...breakdownSettings, ...overrides });
describe('annual customer growth dashboard', () => {
 it('reconciles retained, new and recovered against one previous-year denominator', () => {
  const report = breakdown();
  expect(report.reviewed).toMatchObject({ previous: 2, retained: 1, newCustomers: 1, recovered: 1, lost: 1, current: 3, net: 1, retentionPercent: 50, newPercent: 50, recoveredPercent: 50, lossPercent: 50, growthPercent: 50, retainedAverage: 120, newAverage: 60, recoveredAverage: 90, estimatedAnnualSalesEffect: 120 });
  expect(report.reviewed!.retentionPercent! + report.reviewed!.newPercent! + report.reviewed!.recoveredPercent! - 100).toBe(report.reviewed!.growthPercent);
 });
 it('does not let free stock establish new, retained, or recovered customer activity',()=>{
  const input=[order('zero-prior','new','2024-01-01',0),order('paid-now','new','2025-01-01',20),order('zero-earlier','recovered','2023-01-01',0),order('recovered-now','recovered','2025-02-01',30),order('lost-prior','lost','2024-01-01',10),order('lost-free','lost','2025-01-01',0),order('free-only','retained','2025-01-01',0)];
  expect(breakdown(input).reviewed).toMatchObject({previous:1,current:2,retained:0,recovered:0,newCustomers:2,lost:1,net:1});
  expect(breakdown(input,{earlierHistory:unreviewedCoverage}).reviewed).toMatchObject({newCustomers:null,unclassified:2});
 });
 it('never equates first-observed with first-ever without earlier-history evidence', () => {
  const report = breakdown(undefined, { earlierHistory: unreviewedCoverage });
  expect(report.status).toBe('earlier_history_unverified');
  expect(report.reviewed).toMatchObject({ newCustomers: null, newPercent: null, newAverage: null, unclassified: 1, recovered: 1, current: 3 });
 });
 it('does not turn unreviewed absence into lost or recovered customers', () => {
  const report = breakdown(undefined, { periods: unreviewedCoverage, earlierHistory: unreviewedCoverage });
  expect(report.reviewed).toBeNull(); expect(report.observed).toMatchObject({ firstObserved: 1, recoveredCandidates: 1, notReturned: 1 });
 });
 it('requires evidence and a valid dated review, not a checked box', () => {
  expect(() => breakdown(undefined, { periods: { ...reviewedCoverage, evidence: '' } })).toThrow(/evidence/);
  expect(() => breakdown(undefined, { earlierHistory: { ...reviewedCoverage, reviewedAt: '2027-01-01T00:00:00Z' } })).toThrow(/dated review/);
 });
 it('uses the entire previous year for YTD retention rather than calling a late-year buyer recovered', () => {
  const report = breakdown(undefined, { currentEnd: '2025-06-30' });
  expect(report.fullYear).toBe(false); expect(report.reviewed).toMatchObject({ retained: 1, recovered: 1, estimatedAnnualSalesEffect: null });
  expect(report.previousPeriod).toEqual({ start: '2024-01-01', end: '2024-12-31' });
 });
 it('keeps December 31 in progress until the next business-local date', () => {
  const input = cohortOrders.map(row => ({ ...row, created_at: '2025-12-30T00:00:00Z' }));
  for (const cutoff of ['2025-12-31T20:00:00Z', '2026-01-01T07:59:59Z', '2026-01-01T08:00:00Z']) {
   const coverage = { ...reviewedCoverage, reviewedAt: cutoff };
   const report = breakdown(input, { cutoff, periods: coverage, earlierHistory: coverage });
   const completed = cutoff === '2026-01-01T08:00:00Z';
   expect(report.fullYear).toBe(completed);
   expect(report.reviewed?.estimatedAnnualSalesEffect).toBe(completed ? 120 : null);
  }
 });
 it('handles leap years without normalizing unique customer counts', () => {
  expect(breakdown().reviewed?.previous).toBe(2);
  expect(() => breakdown(undefined, { year: 2024, currentEnd: '2024-12-31' })).not.toThrow();
 });
 it('keeps a zero denominator undefined, including an empty reviewed ledger', () => {
  const report = breakdown([order('first', 'new', '2025-02-01')]);
  expect(report.reviewed).toMatchObject({ previous: 0, current: 1, net: 1, growthPercent: null, newPercent: null, retentionPercent: null, estimatedAnnualSalesEffect: null });
  expect(breakdown([]).reviewed).toMatchObject({ current: 0, previous: 0, growthPercent: null });
 });
 it('uses unique customers, subtracts refunds, and excludes fully returned and canceled activity', () => {
  const report = breakdown([...cohortOrders, cohortOrders[1], order('partial', 'retained', '2025-06-01', 100, { refund_amount: 20, status: 'partially_refunded' }), order('fully-returned', 'lost', '2025-06-01', 20, { refund_amount: 20, status: 'refunded' }), order('canceled', 'lost', '2025-06-02', 20, { status: 'cancelled' })]);
  expect(report.reviewed).toMatchObject({ retained: 1, lost: 1, retainedAverage: 200, estimatedAnnualSalesEffect: 200 });
 });
 it('rejects cross-company data and conflicting duplicate identities', () => {
  expect(() => breakdown([{ ...cohortOrders[0], tenant_id: 'other' }])).toThrow(/Cross-company/);
  expect(() => breakdown([...cohortOrders, { ...cohortOrders[0], total_amount: 12 }])).toThrow(/Conflicting/);
 });
 it('fails closed for malformed dates, unknown refunds and unlinked earlier purchases', () => {
  for (const row of [
   { ...cohortOrders[0], order_date: 'invalid' },
   { ...cohortOrders[0], status: 'refunded', refund_amount: null },
   { ...cohortOrders[0], order_date: '2020-01-01T19:00:00Z', crm_customer_id: null },
  ]) expect(breakdown([...cohortOrders, { ...row, id: 'bad' }]).reviewed).toBeNull();
 });
 it.each(['draft', 'pending', 'failed', 'void', 'voided', 'canceled', 'CANCELLED'])('ignores explicit %s non-purchases in coverage gap checks', status => {
  const extra = [null, 'deleted-customer', 'new'].map((customer, i) => ({ ...order(`ignored-${i}`, 'new', '2020-01-01', 10, { status, currency: 'USD' }), crm_customer_id: customer }));
  expect(breakdown([...cohortOrders, ...extra]).reviewed).toEqual(breakdown().reviewed);
 });
 it.each(['unknown', null])('keeps unknown status %s as a reconciliation blocker', status => {
  for (const customer of [null, 'deleted-customer', 'new']) {
   expect(breakdown([...cohortOrders, { ...order('unknown', 'new', '2020-01-01', 10, { status }), crm_customer_id: customer }]).reviewed).toBeNull();
  }
 });
 it('does not certify first-ever across excluded identities or other currencies', () => {
  expect(breakdown([...cohortOrders, order('unavailable', 'deleted-customer', '2020-01-01')]).reviewed).toBeNull();
  expect(breakdown([...cohortOrders, order('foreign', 'new', '2020-01-01', 10, { currency: 'USD' })]).reviewed).toBeNull();
 });
 it('rejects future/full-year claims and excludes later inserted records', () => {
  expect(() => breakdown(undefined, { year: 2026, currentEnd: '2026-12-31' })).toThrow(/cutoff/);
  const report = breakdown([...cohortOrders, order('later', 'lost', '2025-01-01', 10, { created_at: '2027-01-01T00:00:00Z' })]);
  expect(report.reviewed?.lost).toBe(1);
 });
 it('counts local calendar boundaries rather than UTC year alone', () => {
  const report = breakdown([order('utc-new-year', 'retained', '2025-01-01', 10, { order_date: '2025-01-01T01:00:00Z' }), order('current', 'retained', '2025-02-01', 20)]);
  expect(report.reviewed).toMatchObject({ previous: 1, retained: 1, newCustomers: 0 });
 });
});
