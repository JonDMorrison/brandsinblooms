import {loadReportLedger,loadReportedEvidence} from '../../../_shared/customer-intelligence/load-reported-evidence.ts';
import {loadCompanyAnalysisFacts} from '../../../_shared/customer-intelligence/load-analysis-facts.ts';
import {loadProductSearchFacts,type VerifiedSnapshotStore} from '../../../_shared/customer-intelligence/load-product-search-facts.ts';
import {compareReportedPeriodSpend} from '../../../_shared/customer-intelligence/reported-period-spend.ts';
import {planAudienceRefresh} from '../../../_shared/customer-intelligence/audience-refresh.ts';
import type {JsonObject, JsonValue, PersistenceClient} from '../../types.ts';
import type {ToolExecutionContext, ToolImplementation, ToolResult} from '../types.ts';
import {explorePurchases, analyzeBasket, finiteNumber, validatePurchaseRule, MATCH_REASONS, type CustomerSet, type PurchaseFact} from '../../../_shared/customer-intelligence/purchase-exploration.ts';
import {compareCustomerGrowth, moneyMinorUnits, type GrowthOrder, type GrowthSettings} from '../../../_shared/customer-intelligence/customer-growth.ts';
import {readAllPages} from '../../../_shared/customer-intelligence/query-pages.ts';
import {periodSummaryFacts,type PeriodSummaryEvent} from '../../../_shared/customer-intelligence/period-summary.ts';
import {loadCustomerProductHistory,ProductHistoryNotFound} from '../../../_shared/customer-intelligence/customer-product-history.ts';

interface Customer {id: string; first_name: string | null; last_name: string | null; email: string | null; created_at: string | null;}
export function analysisResult(data: unknown, count: number, message: string): ToolResult {
  return {success: true, data: data as JsonValue, count, message, error: null, block_type: 'data_table', confirmation_required: false, confirmation_details: null};
}
export async function requireAnalysisAccess(context: ToolExecutionContext): Promise<PersistenceClient> {
  if (!context.dataClient || !context.userId || !context.tenantId || (context.authenticatedTenantId && context.authenticatedTenantId !== context.tenantId)) throw new Error('An authenticated, company-scoped data client is required.');
  const client = context.dataClient;
  // This legacy authority uses singular customer.read and reporting.read, unlike the CRM UI permission vocabulary.
  // Keep its NULL-location company-wide check: location-limited staff must not gain company-wide purchase access.
  for (const permission of ['customer.read', 'reporting.read']) {
    const {data, error} = await client.rpc('has_tenant_permission', {p_tenant_id: context.tenantId, p_permission: permission, p_location_id: null});
    if (error || data !== true) throw new Error('Customer analysis requires customer and reporting access.');
  }
  return client;
}
export async function loadAnalysisCustomers(context: ToolExecutionContext, cutoff = new Date().toISOString()): Promise<Customer[]> {
  const client = await requireAnalysisAccess(context);
  return readAllPages<Customer>((from, to) => client.from('crm_customers').select('id,first_name,last_name,email,created_at').eq('tenant_id',context.tenantId).is('deleted_at',null).is('merged_into_customer_id',null).lte('created_at',cutoff).order('id').range(from,to));
}
export async function loadAnalysisFacts(context: ToolExecutionContext, cutoff = new Date().toISOString()): Promise<PurchaseFact[]> {
  const client = await requireAnalysisAccess(context);
  return loadCompanyAnalysisFacts(client,context.tenantId,cutoff);
}

/** Every live customer ID visible to this user, in one call. */
export async function loadAnalysisPopulation(context: ToolExecutionContext, cutoff = new Date().toISOString()): Promise<string[]> {
  const client = await requireAnalysisAccess(context);
  const {data,error} = await client.rpc('bloom_live_customer_ids',{p_tenant_id:context.tenantId,p_cutoff:cutoff});
  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.some(id=>typeof id!=='string')) throw new Error('The customer list could not be read.');
  return data as string[];
}
/** Display names for the customers actually shown. */
export async function loadCustomerNames(context: ToolExecutionContext, ids: string[]): Promise<Map<string,string>> {
  const names = new Map<string,string>(), unique=[...new Set(ids)];
  for (let i=0;i<unique.length;i+=100) {
    const {data,error} = await context.dataClient!.from('crm_customers').select('id,first_name,last_name,email,created_at').eq('tenant_id',context.tenantId).in('id',unique.slice(i,i+100));
    if (error) throw new Error(error.message);
    for (const customer of (data ?? []) as Customer[]) names.set(customer.id,name(customer));
  }
  return names;
}
function snapshotStore(context: ToolExecutionContext): VerifiedSnapshotStore {
  const service = context.serviceClient;
  return {
    async fingerprint(importId) {
      const {data,error} = await service.rpc('customer_intelligence_summary_fingerprint',{p_tenant_id:context.tenantId,p_import_id:importId});
      if (error || typeof data !== 'string') throw new Error(error?.message ?? 'The report fingerprint could not be read.');
      return data;
    },
    async get(importId) {
      const {data,error} = await service.from('customer_intelligence_verified_summaries').select('fingerprint').eq('import_id',importId).eq('tenant_id',context.tenantId).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as {fingerprint?: string} | null)?.fingerprint ?? null;
    },
    async set(importId, fingerprint) {
      const {error} = await service.from('customer_intelligence_verified_summaries').upsert({import_id:importId,tenant_id:context.tenantId,fingerprint,verified_at:new Date().toISOString()});
      if (error) throw new Error(error.message);
    },
  };
}

async function assertConversation(context: ToolExecutionContext) {
  if (!context.conversationId) throw new Error('Open a Bloom conversation before saving an analysis result.');
  const {data,error} = await context.dataClient!.from('bloom_conversations').select('id').eq('id',context.conversationId).eq('tenant_id',context.tenantId).eq('user_id',context.userId).neq('status','deleted').maybeSingle();
  if (error || !data) throw new Error('The analysis conversation is not accessible.');
}
export async function loadCustomerSet(context: ToolExecutionContext, setId?: string): Promise<CustomerSet> {
  await requireAnalysisAccess(context); await assertConversation(context);
  let query = context.dataClient!.from('bloom_customer_sets').select('id,payload').eq('tenant_id',context.tenantId).eq('user_id',context.userId).eq('conversation_id',context.conversationId);
  if (setId) query = query.eq('id',setId);
  const {data,error} = await query.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('There is no saved customer result in this conversation. Start a purchase search rather than guessing who “those people” are.');
  const set = data.payload as unknown as CustomerSet;
  if (set.version !== 1 || set.id !== data.id || set.tenant_id !== context.tenantId || set.user_id !== context.userId || set.conversation_id !== context.conversationId || !Array.isArray(set.included_ids)) throw new Error('The customer snapshot failed its ownership or format check.');
  return set;
}
function requireScope(params: JsonObject): 'all_customers' | 'previous_result' | 'saved_result' {
  if (!['all_customers','previous_result','saved_result'].includes(String(params.scope))) throw new Error('Choose an explicit starting population.');
  if (params.scope === 'saved_result' && typeof params.set_id !== 'string') throw new Error('Choose the earlier result ID.');
  if (params.scope !== 'saved_result' && params.set_id !== undefined) throw new Error('Use saved_result when specifying a result ID.');
  return params.scope as 'all_customers' | 'previous_result' | 'saved_result';
}
function name(customer: Customer) {return [customer.first_name,customer.last_name].filter(Boolean).join(' ') || customer.email || 'Customer';}
function pageNumber(value: JsonValue | undefined) {if (value === undefined) return 1; if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10000) throw new Error('Choose a valid page number.'); return value;}
function publicSet(set: CustomerSet, customers: Customer[], page=1, bucket: 'included'|'excluded'|'unknown'='included') {
  return publicSetFrom(set,new Set(customers.map(c=>c.id)),new Map(customers.map(c=>[c.id,name(c)])),page,bucket);
}
function publicSetFrom(set: CustomerSet, visible: ReadonlySet<string>, names: ReadonlyMap<string,string>, page=1, bucket: 'included'|'excluded'|'unknown'='included') {
  const ids = set[`${bucket}_ids`], start = (page-1)*50;
  if (ids.some(id=>!visible.has(id))) throw new Error('Some customers in this saved result are no longer accessible. The snapshot was not silently rewritten.');
  return {kind:'customer_exploration',tenant_id:set.tenant_id,set_id:set.id,parent_id:set.parent_id,
    captured_at:set.captured_at,timezone:set.timezone,bucket,page,page_size:50,total_count:ids.length,has_more:start+50<ids.length,
    included_count:set.included_ids.length,excluded_count:set.excluded_ids.length,unknown_count:set.unknown_ids.length,trail:set.trail,
    rows:ids.slice(start,start+50).map(id=>({customer_id:id,name:names.get(id)??'Customer',reason:MATCH_REASONS[set.reasons[id]],evidence_count:set.evidence_ids[id]?.length??0})),
    notes:['Membership is saved as actual customer IDs, not remembered by the language model.','The next question reads the available purchase records for this same group; every step records its source-read time.','Customers with no purchase records on file are counted separately, never as non-buyers. No marketing-consent or persona filters were applied.']};
}
export const exploreCustomerPurchases: ToolImplementation = async (params,context) => {
  const scope = requireScope(params), cutoff = new Date().toISOString();
  const rule = validatePurchaseRule(params.criteria);
  const population = await loadAnalysisPopulation(context,cutoff); await assertConversation(context);
  const previous = scope === 'all_customers' ? null : await loadCustomerSet(context,scope==='saved_result'?String(params.set_id):undefined);
  // Only the report lines that could match are read; the full scan remains for rules that need every line.
  const narrowed = rule.mode === 'all' ? {facts:[] as PurchaseFact[],evidenceCustomerIds:undefined}
    : await loadProductSearchFacts(context.dataClient!,context.tenantId,cutoff,rule,snapshotStore(context));
  const facts = narrowed?.facts ?? await loadAnalysisFacts(context,cutoff);
  const set = explorePurchases({tenantId:context.tenantId,userId:context.userId,conversationId:context.conversationId,timezone:context.timezone,
    population,facts,rule,label:String(params.label??''),previous,now:cutoff,knownEvidence:narrowed?.evidenceCustomerIds});
  // Biggest buyers of the matching products first.
  const byId = new Map(facts.map(fact=>[fact.id,fact]));
  const matched = new Map<string,{amount:number|null;quantity:number|null;currency:string|null}>();
  if (rule.mode === 'purchased') for (const id of set.included_ids) {
    let cents=0, quantity=0, currency: string|null=null, mixed=false;
    for (const factId of set.evidence_ids[id] ?? []) {
      const fact=byId.get(factId); if (!fact) continue;
      if (currency && fact.currency && fact.currency!==currency) mixed=true; currency=currency??fact.currency;
      const amount=finiteNumber(fact.net_amount), qty=finiteNumber(fact.quantity);
      if (amount!==null) cents+=Math.round(amount*100); if (qty!==null) quantity+=qty;
    }
    matched.set(id,{amount:mixed?null:cents/100,quantity:Math.round(quantity*1000)/1000,currency:mixed?null:currency});
  }
  if (matched.size) set.included_ids.sort((a,b)=>(matched.get(b)?.amount??-Infinity)-(matched.get(a)?.amount??-Infinity)||a.localeCompare(b));
  // "Top 50 Tropical shoppers": keep exactly the top N as the saved group, so a follow-up
  // about "these" means the customers shown, not every buyer.
  const topN = params.top_n;
  if (topN !== undefined) {
    if (typeof topN !== 'number' || !Number.isInteger(topN) || topN < 1 || topN > 500) throw new Error('Choose a top number from 1 to 500.');
    if (rule.mode !== 'purchased') throw new Error('A top number only applies to buyers.');
    const outside = set.included_ids.splice(topN);
    for (const id of outside) { set.excluded_ids.push(id); set.reasons[id] = 'outside_top_n'; }
    Object.assign(set.trail[set.trail.length-1], {included:set.included_ids.length, excluded:set.excluded_ids.length, top_n:topN, matched_buyers:set.included_ids.length+outside.length});
  }
  if (JSON.stringify(set).length > 16000000) throw new Error('This result is too large to save safely. No partial audience was returned.');
  const {error} = await context.serviceClient.from('bloom_customer_sets').insert({id:set.id,tenant_id:context.tenantId,user_id:context.userId,conversation_id:context.conversationId,parent_id:set.parent_id,label:String(params.label),payload:set,created_at:cutoff});
  if (error) throw new Error(`The exact customer result could not be saved: ${error.message}`);
  const visible = new Set(population), names = await loadCustomerNames(context,set.included_ids.slice(0,50));
  const result = publicSetFrom(set,visible,names);
  const reportOnly = facts.length>0 && facts.every(fact=>fact.evidence_kind==='period_summary');
  return analysisResult({...result,
    rows:result.rows.map(row=>({...row,matched_reported_spend:matched.get(row.customer_id)?.amount??null,matched_quantity:matched.get(row.customer_id)?.quantity??null,currency:matched.get(row.customer_id)?.currency??null})),
    order:matched.size?'Largest matched spending first.':'Customer ID order.',
    evidence_note:reportOnly?'Matches come from imported period sales reports (product totals per customer per report period), not dated receipts.':null},
    set.included_ids.length,typeof params.top_n==='number'
      ? `Search succeeded: ${(set.included_ids.length+set.excluded_ids.filter(id=>set.reasons[id]==='outside_top_n').length).toLocaleString('en-US')} customers bought it. The saved group is the top ${set.included_ids.length.toLocaleString('en-US')} by matched spending; follow-up questions about "these" use exactly those ${set.included_ids.length.toLocaleString('en-US')}. This is a complete answer, not an error.`
      : exploreMessage(rule.mode,set.included_ids.length,set.excluded_ids.length,set.unknown_ids.length));
};
/** Plain result line. Customers with no records on file are normal for imported reports, not a failed lookup. */
export function exploreMessage(mode: string, included: number, excluded: number, unknown: number): string {
  const n = (value: number) => value.toLocaleString('en-US');
  const lead = mode === 'not_purchased' ? `Search succeeded: ${n(included)} customers have purchase records and none match.`
    : mode === 'all' ? `Search succeeded: ${n(included)} customers selected.`
    : `Search succeeded: ${n(included)} customers bought it.`;
  if (mode === 'all') return lead;
  const other = mode === 'not_purchased' ? `${n(excluded)} did buy it.` : `${n(excluded)} have purchase records without it.`;
  return `${lead} ${other} ${n(unknown)} have no purchase records on file, so they are counted separately. This is a complete answer, not an error.`;
}
export const inspectCustomerSet: ToolImplementation = async (params,context) => {
  if(params.list_audiences===true){
    const client=await requireAnalysisAccess(context),page=pageNumber(params.page);
    const {data,error}=await client.from('bloom_analytical_audiences').select('id,name,mode,version,refreshed_at,next_refresh_at,last_error').eq('tenant_id',context.tenantId).eq('user_id',context.userId).order('name').order('id').range((page-1)*50,page*50);
    if(error)throw new Error(error.message);
    return analysisResult({kind:'customer_audiences',rows:(data??[]).slice(0,50),page,has_more:(data??[]).length>50,note:'Your saved analytical audiences. Open one to inspect its complete included, excluded or unknown membership.'},(data??[]).slice(0,50).length,'Showing your saved analytical audiences.');
  }

  if(typeof params.audience_id==='string') {
    const client=await requireAnalysisAccess(context),customers=await loadAnalysisCustomers(context);
    const {data:a,error}=await client.from('bloom_analytical_audiences').select('id,name,mode,snapshot,refreshed_at,next_refresh_at,last_error').eq('id',params.audience_id).eq('tenant_id',context.tenantId).eq('user_id',context.userId).single();
    if(error||!a)throw new Error('The analytical audience is not accessible.');
    const snapshot=a.snapshot as {member_ids:string[];unknown_ids:string[];excluded_ids:string[];result:{captured_at:string}};
    if(params.bucket!==undefined&&!['included','excluded','unknown'].includes(String(params.bucket)))throw new Error('Choose included, excluded or unknown.');
    const ids=params.bucket==='unknown'?snapshot.unknown_ids:params.bucket==='excluded'?snapshot.excluded_ids:snapshot.member_ids;
    const map=new Map(customers.map(c=>[c.id,c]));
    if(!Array.isArray(ids)||ids.some(id=>!map.has(id)))throw new Error('Saved membership includes inaccessible customers. Review the audience before continuing.');
    const page=pageNumber(params.page);
    return analysisResult({kind:'customer_audience',bucket:String(params.bucket??'included'),audience_id:a.id,name:a.name,mode:a.mode,captured_at:snapshot.result.captured_at,last_refresh_at:a.refreshed_at,next_refresh_at:a.mode==='dynamic'?a.next_refresh_at:null,last_error:a.last_error,
      total_count:ids.length,page,has_more:page*50<ids.length,rows:ids.slice((page-1)*50,page*50).map(id=>({customer_id:id,name:name(map.get(id)!),membership:String(params.bucket??'included')})),
      note:a.mode==='fixed'?'Fixed reviewed membership. No customer classifications or consent changed.':'Dynamic membership refreshes daily and after completed imports. Failed refreshes retain the last complete result. No customer classifications or consent changed.'},ids.length,'Showing the saved analytical audience.');
  }

  const set = await loadCustomerSet(context,typeof params.set_id==='string'?params.set_id:undefined), visible = new Set(await loadAnalysisPopulation(context));
  const bucket = params.bucket ?? 'included'; if (!['included','excluded','unknown'].includes(String(bucket))) throw new Error('Choose included, excluded, or unknown.');
  const page = pageNumber(params.page), ids = set[`${bucket as 'included'|'excluded'|'unknown'}_ids`].slice((page-1)*50,page*50);
  const data = publicSetFrom(set,visible,await loadCustomerNames(context,ids),page,bucket as 'included'|'excluded'|'unknown');
  return analysisResult(data,data.total_count,`Showing ${bucket} customers from the saved result. Total ${data.total_count}; this is page ${data.page}.`);
};
async function loadEvidenceFacts(context: ToolExecutionContext, customerId: string, evidenceIds: string[]): Promise<PurchaseFact[]> {
  const client = await requireAnalysisAccess(context), wanted = new Set(evidenceIds);
  const lineIds = evidenceIds.filter(id=>!id.includes(':')).slice(0,200);
  const eventIds = [...new Set(evidenceIds.filter(id=>id.includes(':')).map(id=>id.slice(0,id.lastIndexOf(':'))))].slice(0,200);
  const facts: PurchaseFact[] = [];
  if (lineIds.length) {
    const {data,error} = await client.from('customer_purchase_line_items').select('id,tenant_id,customer_id,product_code,product_name,sales_category,department,quantity,net_amount,currency,purchased_at,created_at,source,import_id,external_transaction_id').eq('tenant_id',context.tenantId).eq('customer_id',customerId).in('id',lineIds);
    if (error) throw new Error(error.message);
    facts.push(...((data ?? []) as PurchaseFact[]));
  }
  if (eventIds.length) {
    const {data,error} = await client.from('customer_intelligence_source_events').select('id,tenant_id,customer_id,import_id,source,created_at,raw_data').eq('tenant_id',context.tenantId).eq('customer_id',customerId).eq('event_type','purchase_summary').in('id',eventIds);
    if (error) throw new Error(error.message);
    facts.push(...periodSummaryFacts((data ?? []) as PeriodSummaryEvent[],context.tenantId));
  }
  return facts.filter(fact=>wanted.has(fact.id));
}
export const explainCustomerSetMember: ToolImplementation = async (params,context) => {
  const set = await loadCustomerSet(context,typeof params.set_id==='string'?params.set_id:undefined);
  const customerId = String(params.customer_id??''), visible = new Set(await loadAnalysisPopulation(context));
  const customerName = visible.has(customerId) ? (await loadCustomerNames(context,[customerId])).get(customerId) : undefined;
  if (!customerName || !set.reasons[customerId]) throw new Error('That customer is not accessible in this result.');
  const evidenceIds = new Set(set.evidence_ids[customerId] ?? []);
  // Only this customer's recorded evidence rows, read by ID: never the whole company.
  const products = (await loadEvidenceFacts(context,customerId,[...evidenceIds])).slice(0,50);
  const sourceIds = [...evidenceIds].filter(id=>/^[0-9a-f-]{36}$/i.test(id)).slice(0,50);
  let summaries: unknown[] = [];
  if(sourceIds.length){const result=await context.dataClient!.from('customer_intelligence_source_events').select('id,source,import_id,event_type,amount,raw_data').eq('tenant_id',context.tenantId).eq('customer_id',customerId).in('id',sourceIds);if(result.error)throw new Error(result.error.message);summaries=result.data??[];}
  const data = [...products,...summaries].slice(0,50);
  return analysisResult({kind:'customer_evidence',set_id:set.id,customer_id:customerId,name:customerName,reason:MATCH_REASONS[set.reasons[customerId]],trail:set.trail,
    evidence_total:set.evidence_ids[customerId]?.length??0,evidence_shown:data?.length??0,rows:data??[],note:'Period summaries disclose their source period and have no individual purchase date. They are not receipt counts. Up to 50 matching rows are displayed.'},data?.length??0,'Here are the rules and recorded purchases behind this customer’s inclusion or exclusion.');
};
export const analyzeCustomerBasket: ToolImplementation = async (params,context) => {
  const set = await loadCustomerSet(context,typeof params.set_id==='string'?params.set_id:undefined);
  publicSetFrom(set,new Set(await loadAnalysisPopulation(context)),new Map());
  const basket = analyzeBasket(await loadAnalysisFacts(context),set.included_ids,context.tenantId), page=pageNumber(params.page);
  return analysisResult({kind:'customer_basket',set_id:set.id,denominator:basket.denominator,total_products:basket.products.length,unnamed_purchase_rows:basket.unnamed_purchase_rows,page,
    rows:basket.products.slice((page-1)*50,page*50),has_more:page*50<basket.products.length,notes:['Each product counts distinct customers, not units or transaction rows. Percentages use this exact saved group.']},basket.products.length,'These are the other products purchased by the same customer group.');
};
export const compareCustomerGrowthTool: ToolImplementation = async (params,context) => {
  const scope=requireScope(params), cutoff=new Date().toISOString(), customers=await loadAnalysisCustomers(context,cutoff);
  const set=scope==='all_customers'?null:await loadCustomerSet(context,scope==='saved_result'?String(params.set_id):undefined);
  if(set) publicSet(set,customers);
  const ids=set?.included_ids??customers.map(c=>c.id), client=context.dataClient!;
  if(params.evidence_basis==='reported_period') {
    const ledger=await loadReportLedger(client,context.tenantId,cutoff);
    const selectPeriod=(start:unknown,end:unknown)=>{const matches=ledger.filter(row=>row.source_period_start===start&&row.source_period_end===end);if(matches.length!==1)throw new Error('This exact historical period is missing or has multiple retained snapshots. Select the source explicitly in Customer Intelligence reported spending.');return matches[0].id;};
    const historicalImportIds=[selectPeriod(params.current_start,params.current_end),selectPeriod(params.baseline_start,params.baseline_end)];
    const {facts}=await loadReportedEvidence(client,context.tenantId,cutoff,{historicalImportIds,customerIds:ids});
    const report=compareReportedPeriodSpend(facts,ids,context.tenantId,
      {start:String(params.current_start),end:String(params.current_end),currency:String(params.currency)},
      {start:String(params.baseline_start),end:String(params.baseline_end),currency:String(params.currency)});
    const page=pageNumber(params.page), names=new Map(customers.map(c=>[c.id,name(c)]));
    return analysisResult({...report,kind:'customer_reported_comparison',captured_at:cutoff,total_count:report.rows.length,page,has_more:page*50<report.rows.length,
      rows:report.rows.slice((page-1)*50,page*50).map(row=>({...row,name:names.get(row.customer_id)})),
      note:'Exact-period reported spend only. This is not CGI or visit growth. Missing coverage remains unknown.'},report.rows.length,'Compared reported period spending without inferring visits.');
  }

  const orders=await readAllPages<GrowthOrder>((from,to)=>client.from('pos_orders').select('id,tenant_id,crm_customer_id,order_date,created_at,total_amount,refund_amount,currency,status').eq('tenant_id',context.tenantId).lte('created_at',cutoff).order('id').range(from,to));
  const settings:GrowthSettings={current_start:String(params.current_start??''),current_end:String(params.current_end??''),baseline_start:String(params.baseline_start??''),baseline_end:String(params.baseline_end??''),
    currency:String(params.currency??''),timezone:context.timezone,data_cutoff:cutoff,spend_weight:params.spend_weight===undefined?50:Number(params.spend_weight),visits_weight:params.visits_weight===undefined?50:Number(params.visits_weight),per_day_rates:params.per_day_rates===true};
  const report=compareCustomerGrowth(orders,ids,context.tenantId,settings), page=pageNumber(params.page), map=new Map(customers.map(c=>[c.id,c]));
  return analysisResult({...report,set_id:set?.id??null,total_count:report.rows.length,page,has_more:page*50<report.rows.length,
    rows:report.rows.slice((page-1)*50,page*50).map(row=>({...row,name:name(map.get(row.customer_id)!)}))},report.rows.length,'Customer growth is calculated from recorded orders. Missing or non-positive baselines are clearly identified instead of inventing percentages.');
};
export async function prepareCustomerSetSave(params: JsonObject,context: ToolExecutionContext): Promise<ToolResult> {
  const set = await loadCustomerSet(context,String(params.set_id??''));
  const {data,error}=await context.dataClient!.rpc('has_tenant_permission',{p_tenant_id:context.tenantId,p_permission:'segment.write',p_location_id:null});
  if(error||data!==true)throw new Error('Segment management permission is required.');
  const population=await loadAnalysisPopulation(context);
  publicSetFrom(set,new Set(population),new Map());
  const segmentName=String(params.name??'').trim();if(!segmentName||segmentName.length>120)throw new Error('Give the segment a name of up to 120 characters.');
  if(!set.included_ids.length)throw new Error('There are no included customers to save.');
  const mode=params.mode;
  if(mode!==undefined && mode!=='fixed' && mode!=='dynamic') throw new Error('Choose fixed or dynamic.');
  const excludedIds=Array.isArray(params.excluded_ids)?params.excluded_ids.map(String):[];
  if(mode===undefined&&excludedIds.length)throw new Error('Choose fixed or dynamic mode to apply manual exclusions.');
  if(mode==='fixed'||mode==='dynamic') planAudienceRefresh({mode,saved:set,tenantId:context.tenantId,userId:context.userId,conversationId:context.conversationId,population,facts:mode==='dynamic'?await loadAnalysisFacts(context):[],excludedIds,now:new Date().toISOString()});
  const reviewedCount=set.included_ids.filter(id=>!excludedIds.includes(id)).length;
  const details={action:`Save ${reviewedCount} reviewed customers as ${mode??'static segment'} “${segmentName}”${mode==='dynamic'?'; refresh daily from imported evidence':''}`,affected_count:reviewedCount,reversible:true,risk_level:'medium' as const,tool_name:'save_customer_set_segment' as const};
  return {success:true,error:null,count:reviewedCount,message:details.action,block_type:'confirmation',confirmation_required:true,confirmation_details:details,
    data:{tool_name:'save_customer_set_segment',tool_params:{set_id:set.id,name:segmentName,...(mode?{mode,excluded_ids:excludedIds}:{})},confirmation_details:details,
      excluded_count:set.excluded_ids.length,unknown_count:set.unknown_ids.length,notice:mode==='dynamic'?'Membership refreshes daily and after completed imports; manual exclusions persist. No classifications, consent or messages change.':'This saves a fixed list. No classifications, consent or messages change.'}};
}
export const saveCustomerSetSegment: ToolImplementation = async (params,context) => {
  const preview=await prepareCustomerSetSave(params,context);
  if(context.approved!==true)return preview;
  if(params.mode){const {data,error}=await context.serviceClient.rpc('save_bloom_analytical_audience',{p_set_id:params.set_id,p_user_id:context.userId,p_name:String(params.name).trim(),p_mode:params.mode,p_excluded_ids:params.excluded_ids??[]});if(error)throw new Error(error.message);return analysisResult(data,1,'Saved the reviewed analytical audience. No classifications or consent changed.');}
  const {data,error}=await context.serviceClient.rpc('save_bloom_customer_set_segment',{p_set_id:params.set_id,p_user_id:context.userId,p_name:String(params.name).trim()});
  if(error)throw new Error(error.message);
  return {success:true,error:null,data:data as JsonValue,count:1,message:'Saved the exact customer group as a static segment. No messages were sent.',block_type:'data_card',confirmation_required:false,confirmation_details:null};
};

/** Select an exact audience from a reported spending period without relabelling it lifetime value. */
export const exploreCustomerReportedSpending: ToolImplementation = async (params,context) => {
  const scope = requireScope(params), cutoff = new Date().toISOString(), client = await requireAnalysisAccess(context);
  const minimum = params.minimum_spend ?? 0, transactions = params.minimum_transactions ?? 1;
  if (typeof minimum !== 'number' || !Number.isFinite(minimum) || minimum < 0 || minimum > 100000000)
    throw new Error('Choose a non-negative reported spending threshold.');
  if (typeof transactions !== 'number' || !Number.isInteger(transactions) || transactions < 0 || transactions > 1000000)
    throw new Error('Choose a non-negative whole transaction threshold.');
  const currency=String(params.currency??'CAD');
  if(!/^[A-Z]{3}$/.test(currency) || moneyMinorUnits(minimum)===null) throw new Error('Choose one currency and a spending threshold with at most two decimal places.');
  const label=String(params.label??'Reported spending audience').trim();
  if(!label || label.length>180) throw new Error('Name the audience in up to 180 characters.');
  const {data:report,error:reportError} = await client.from('customer_intelligence_imports')
    .select('id,source_filename,source_period_start,source_period_end').eq('tenant_id',context.tenantId)
    // The most recent period, not whichever file happened to be imported last.
    .eq('report_type','customer_spending').eq('status','completed').lte('completed_at',cutoff)
    .order('source_period_end',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(reportError) throw new Error(reportError.message);
  if(!report) throw new Error('There is no reconciled customer spending report available.');
  await assertConversation(context);
  const everyone = await loadAnalysisPopulation(context,cutoff), visible = new Set(everyone);
  const previous = scope==='all_customers'?null:await loadCustomerSet(context,scope==='saved_result'?String(params.set_id):undefined);
  if(previous) publicSetFrom(previous,visible,new Map());
  const events = await readAllPages<{id:string;customer_id:string|null;amount:number|string|null;raw_data:unknown}>((from,to)=>client.from('customer_intelligence_source_events')
    .select('id,customer_id,amount,raw_data').eq('tenant_id',context.tenantId).eq('import_id',report.id)
    .eq('event_type','customer_spending').lte('created_at',cutoff).order('id').range(from,to));
  const population=previous?.included_ids??everyone, allowed=new Set(population);
  const values=new Map<string,{amount:number;transactions:number;id:string}>();
  for(const event of events){
    if(!event.customer_id||!allowed.has(event.customer_id)) continue;
    if(values.has(event.customer_id)) throw new Error('Conflicting spending summaries require reconciliation.');
    const raw=event.raw_data as Record<string,unknown>|null,amount=typeof event.amount==='number'?event.amount:Number(event.amount);
    if(!raw||raw.kind!=='reported_period_spending'||raw.currency!==currency||event.amount===null||moneyMinorUnits(event.amount)===null||!Number.isFinite(amount)
      ||typeof raw.transactions!=='number'||!Number.isInteger(raw.transactions)||raw.transactions<0)
      throw new Error('The source spending report contains an invalid measurement.');
    values.set(event.customer_id,{amount,transactions:raw.transactions,id:event.id});
  }
  const set=explorePurchases({tenantId:context.tenantId,userId:context.userId,conversationId:context.conversationId,timezone:context.timezone,
    population:everyone,facts:[],rule:{mode:'purchased'},label,previous,now:cutoff});
  set.included_ids=[];set.excluded_ids=[];set.unknown_ids=[];
  for(const id of population){const value=values.get(id);
    if(!value){set.unknown_ids.push(id);set.reasons[id]='no_purchase_history';}
    else if(value.amount>=minimum&&value.transactions>=transactions){set.included_ids.push(id);set.reasons[id]='matching_purchase';set.evidence_ids[id]=[value.id];}
    else {set.excluded_ids.push(id);set.reasons[id]='no_matching_purchase';}
  }
  set.included_ids.sort((a,b)=>values.get(b)!.amount-values.get(a)!.amount||a.localeCompare(b));
  // "Top 5 customers": the saved group is exactly the top N, so "these" means the customers shown.
  const topN=params.top_n;const qualifying=set.included_ids.length;
  if(topN!==undefined){
    if(typeof topN!=='number'||!Number.isInteger(topN)||topN<1||topN>500)throw new Error('Choose a top number from 1 to 500.');
    for(const id of set.included_ids.splice(topN)){set.excluded_ids.push(id);set.reasons[id]='outside_top_n';}
  }
  Object.assign(set.trail[set.trail.length-1],{included:set.included_ids.length,excluded:set.excluded_ids.length,unknown:set.unknown_ids.length,
    ...(topN!==undefined?{top_n:topN,qualifying_customers:qualifying}:{}),
    reported_spending:{report_id:report.id,period_start:report.source_period_start,period_end:report.source_period_end,minimum_spend:minimum,minimum_transactions:transactions}});
  if(JSON.stringify(set).length>16000000) throw new Error('This source audience is too large to save safely. No partial audience was returned.');
  const {error}=await context.serviceClient.from('bloom_customer_sets').insert({id:set.id,tenant_id:context.tenantId,user_id:context.userId,conversation_id:context.conversationId,parent_id:set.parent_id,label,payload:set,created_at:cutoff});
  if(error) throw new Error('The exact reported spending audience could not be saved: '+error.message);
  const result=publicSetFrom(set,visible,await loadCustomerNames(context,set.included_ids.slice(0,50)));
  return analysisResult({...result,source_filename:report.source_filename,period_start:report.source_period_start,period_end:report.source_period_end,
    criteria:{minimum_spend:minimum,minimum_transactions:transactions,currency},
    rows:result.rows.map(row=>({...row,reported_period_spend:values.get(row.customer_id)?.amount,reported_transactions:values.get(row.customer_id)?.transactions})),
    note:'Reported period spending and transaction totals are not lifetime value or dated receipts. Missing customers remain unknown, not inactive. Continue product searches with scope=previous_result.'},set.included_ids.length,'Selected an exact audience from the reconciled spending report. No customer classification or marketing consent changed.');
};

/** One customer's products from their own evidence only. Never scans the whole company. */
export const getCustomerProductHistory: ToolImplementation = async (params,context) => {
  const client = await requireAnalysisAccess(context);
  const customerId = typeof params.customer_id === 'string' ? params.customer_id.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) throw new Error('Choose the customer by ID.');
  const productQuery = typeof params.product_query === 'string' ? params.product_query : null;
  try {
    const history = await loadCustomerProductHistory(client,{tenantId:context.tenantId,customerId,cutoff:new Date().toISOString(),productQuery});
    const matched = history.groups.reduce((sum,group)=>sum+group.matched_products,0);
    const message = history.status==='matched'
      ? `Found ${matched} matching product line${matched===1?'':'s'} across ${history.groups.filter(g=>g.matched_products>0).length} evidence source${history.groups.filter(g=>g.matched_products>0).length===1?'':'s'}. ${history.note}`
      : history.note;
    return analysisResult(history,matched,message);
  } catch (error) {
    if (error instanceof ProductHistoryNotFound) return {success:false,data:null,count:0,message:error.message,error:'not_found',block_type:'text',confirmation_required:false,confirmation_details:null};
    throw error;
  }
};
