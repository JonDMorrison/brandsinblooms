import {readLiveCustomerIds} from '../../../_shared/customer-intelligence/bounded-search.ts';
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
import {currentSummaryImports,periodSummaryFacts,type PeriodSummaryEvent} from '../../../_shared/customer-intelligence/period-summary.ts';
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

/** Every live customer ID visible to this user, in bounded cursor pages. */
export async function loadAnalysisPopulation(context: ToolExecutionContext, cutoff = new Date().toISOString(), customerIds?: string[]): Promise<string[]> {
  const client = await requireAnalysisAccess(context);
  if(customerIds===undefined)return readLiveCustomerIds(client,context.tenantId,cutoff);
  const ids=[...new Set(customerIds)],visible=new Set<string>();
  for(let offset=0;offset<ids.length;offset+=100){
    const rows=await readAllPages<{id:string}>((from,to)=>client.from('crm_customers').select('id')
      .eq('tenant_id',context.tenantId).is('deleted_at',null).is('merged_into_customer_id',null)
      .lte('created_at',cutoff).in('id',ids.slice(offset,offset+100)).order('id').range(from,to));
    for(const row of rows)visible.add(row.id);
  }
  if(ids.some(id=>!visible.has(id)))throw new Error('Some members of the saved audience are no longer accessible. Start a new search.');
  return ids;
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
/** Contact rows for an exact saved membership, never a tenant-wide fallback. */
export async function loadCustomerSetContacts(context: ToolExecutionContext, ids: string[]): Promise<Customer[]> {
  const client = await requireAnalysisAccess(context), contacts = new Map<string, Customer>();
  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const {data, error} = await client.from('crm_customers').select('id,first_name,last_name,email,created_at')
      .eq('tenant_id', context.tenantId).in('id', unique.slice(offset, offset + 100))
      .is('deleted_at', null).is('merged_into_customer_id', null);
    if (error) throw new Error(error.message);
    for (const customer of (data ?? []) as Customer[]) contacts.set(customer.id, customer);
  }
  if (unique.some(id => !contacts.has(id))) throw new Error('Some members of the saved audience are no longer accessible. No partial contact list was returned. Start a new search.');
  return unique.map(id => contacts.get(id)!);
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
  if (!data) throw new Error(setId ? 'That exact saved customer result is not accessible in this conversation. Do not substitute another group. To inspect the latest group instead, call inspect_customer_set with set_id omitted and verify its rule trail before continuing.' : 'There is no saved customer result in this conversation. Start a purchase search rather than guessing who “those people” are.');
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
export async function exploreCustomerPurchases(params: JsonObject,context: ToolExecutionContext,ranking?: {limit:number}): Promise<ToolResult> {
  const scope = requireScope(params), cutoff = new Date().toISOString();
  const rule = validatePurchaseRule(params.criteria);
  const previous = scope === 'all_customers' ? null : await loadCustomerSet(context,scope==='saved_result'?String(params.set_id):undefined);
  const population = await loadAnalysisPopulation(context,cutoff,previous?.included_ids); await assertConversation(context);
  // Only the report lines that could match are read; the full scan remains for rules that need every line.
  const narrowed = rule.mode === 'all' ? {facts:[] as PurchaseFact[],evidenceCustomerIds:undefined,sourcePeriods:[]}
    : previous && previous.included_ids.length>1000 ? await (async()=>{
      const facts:PurchaseFact[]=[],evidenceCustomerIds=new Set<string>(),periods=new Map<string,{start:string|null;end:string|null}>();
      const verifiedStore=snapshotStore(context),generations=new Map<string,string>();
      const store:VerifiedSnapshotStore={...verifiedStore,async fingerprint(importId){
        const fingerprint=await verifiedStore.fingerprint(importId),before=generations.get(importId);
        if(before!==undefined&&before!==fingerprint)throw new Error('The report changed during the search. No partial audience was returned.');
        generations.set(importId,fingerprint);return fingerprint;
      }};
      const ledger=await loadReportLedger(context.dataClient!,context.tenantId,cutoff);
      for(let offset=0;offset<previous.included_ids.length;offset+=1000){
        const result=await loadProductSearchFacts(context.dataClient!,context.tenantId,cutoff,rule,store,previous.included_ids.slice(offset,offset+1000));
        if(!result)throw new Error('The saved customer product evidence could not be read within its scope.');
        facts.push(...result.facts);
        for(const id of result.evidenceCustomerIds)evidenceCustomerIds.add(id);
        for(const period of result.sourcePeriods??[])periods.set(JSON.stringify(period),period);
      }
      if(JSON.stringify(await loadReportLedger(context.dataClient!,context.tenantId,cutoff))!==JSON.stringify(ledger))
        throw new Error('The source ledger changed during the search. No partial audience was returned.');
      return {facts,evidenceCustomerIds,sourcePeriods:[...periods.values()]};
    })() : await loadProductSearchFacts(context.dataClient!,context.tenantId,cutoff,rule,snapshotStore(context),previous?.included_ids);
  const facts = narrowed?.facts ?? await loadAnalysisFacts(context,cutoff);
  // Ranking evaluates this cohort without appending a saved exploration step. Keep
  // its exact members and relative-date anchors, but do not apply the trail-length cap.
  const evaluationPrevious=ranking&&previous?{...previous,trail:[]}:previous;
  const set = explorePurchases({tenantId:context.tenantId,userId:context.userId,conversationId:context.conversationId,timezone:context.timezone,
    population,facts,rule,label:String(params.label??''),previous:evaluationPrevious,now:cutoff,knownEvidence:narrowed?.evidenceCustomerIds});
  // Biggest buyers of the matching products first.
  const byId = new Map(facts.map(fact=>[fact.id,fact]));
  const matched = new Map<string,{amount:number|null;quantity:number|null;currency:string|null}>();
  if (rule.mode === 'purchased') for (const id of set.included_ids) {
    let cents=0, quantity=0, currency: string|null=null, mixed=false, missingAmount=false, missingQuantity=false;
    for (const factId of set.evidence_ids[id] ?? []) {
      const fact=byId.get(factId); if (!fact) continue;
      if (currency && fact.currency && fact.currency!==currency) mixed=true; currency=currency??fact.currency;
      const amount=finiteNumber(fact.net_amount), qty=finiteNumber(fact.quantity);
      if (amount!==null) cents+=Math.round(amount*100); else missingAmount=true;
      if (qty!==null) quantity+=qty; else missingQuantity=true;
    }
    matched.set(id,{amount:mixed||missingAmount?null:cents/100,quantity:missingQuantity?null:Math.round(quantity*1000)/1000,currency:mixed?null:currency});
  }
  if (matched.size) set.included_ids.sort((a,b)=>(matched.get(b)?.amount??-Infinity)-(matched.get(a)?.amount??-Infinity)||a.localeCompare(b));
  if(ranking){
    const eligible=set.included_ids.filter(id=>matched.get(id)?.amount!==null);
    const currencies=new Set(eligible.map(id=>matched.get(id)?.currency));
    if(currencies.size>1)throw new Error('Reported spending in different currencies cannot be ranked together.');
    const shown=eligible.slice(0,ranking.limit),names=await loadCustomerNames(context,shown);
    const missing=set.included_ids.filter(id=>matched.get(id)?.amount===null);
    return analysisResult({kind:'customer_ranking',set_id:previous?.id??null,captured_at:cutoff,
      scanned_customers:population.length,eligible_customers:eligible.length,shown_customers:shown.length,
      omitted_by_limit:Math.max(0,eligible.length-ranking.limit),unranked_count:set.unknown_ids.length+missing.length,
      nonmatching_count:set.excluded_ids.length,total_count:eligible.length,source_periods:narrowed?.sourcePeriods??[],
      rows:shown.map(id=>({customer_id:id,name:names.get(id)??'Customer',matched_reported_spend:matched.get(id)?.amount,
        matched_quantity:matched.get(id)?.quantity,currency:matched.get(id)?.currency})),
      note:'Read-only ranking of the exact saved group. Missing spending evidence is unknown, not zero. The saved audience is unchanged. Imported totals describe the actual source periods, not dated receipts or lifetime value.'},
      shown.length,'Ranked the saved customer group without changing its membership.');
  }
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
    source_periods:narrowed?.sourcePeriods??[],
    coverage_note:'These are matches in available records, not proof of complete period coverage. Disclose the actual report end date for YTD evidence; do not describe it as a complete calendar-year retention rate.',
    evidence_note:reportOnly?'Matches come from imported period sales reports (product totals per customer per report period), not dated receipts.':null},
    set.included_ids.length,typeof params.top_n==='number'
      ? `Search succeeded: ${(set.included_ids.length+set.excluded_ids.filter(id=>set.reasons[id]==='outside_top_n').length).toLocaleString('en-US')} customers bought it. The saved group is the top ${set.included_ids.length.toLocaleString('en-US')} by matched spending; follow-up questions about "these" use exactly those ${set.included_ids.length.toLocaleString('en-US')}. This is a complete answer, not an error.`
      : exploreMessage(rule.mode,set.included_ids.length,set.excluded_ids.length,set.unknown_ids.length));
};
/** Plain result line. Customers with no records on file are normal for imported reports, not a failed lookup. */
export function exploreMessage(mode: string, included: number, excluded: number, unknown: number): string {
  const n = (value: number) => value.toLocaleString('en-US');
  if (included === 0 && excluded === 0 && unknown > 0)
    return `The requested purchase count is unknown: all ${n(unknown)} customers lack evidence precise enough for this question. This is not zero purchases or proof that nobody bought. Annual report totals cannot establish monthly purchases.`;
  const lead = mode === 'not_purchased' ? `Search succeeded: ${n(included)} customers have purchase records and none match.`
    : mode === 'all' ? `Search succeeded: ${n(included)} customers selected.`
    : `Search succeeded: ${n(included)} customers bought it.`;
  if (mode === 'all') return lead;
  const other = mode === 'not_purchased' ? `${n(excluded)} did buy it.` : `${n(excluded)} have purchase records without it.`;
  return `${lead} ${other} ${n(unknown)} lack sufficient purchase evidence for this question, so they remain unknown and are counted separately. This is a complete answer, not an error.`;
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
      total_count:ids.length,page,has_more:page*50<ids.length,rows:ids.slice((page-1)*50,page*50).map(id=>({customer_id:id,name:name(map.get(id)!),email:map.get(id)!.email,membership:String(params.bucket??'included')})),
      note:a.mode==='fixed'?'Fixed reviewed membership. No customer classifications or consent changed.':'Dynamic membership refreshes daily and after completed imports. Failed refreshes retain the last complete result. No customer classifications or consent changed.'},ids.length,'Showing the saved analytical audience.');
  }

  const set = await loadCustomerSet(context,typeof params.set_id==='string'?params.set_id:undefined);
  const bucket = params.bucket ?? 'included'; if (!['included','excluded','unknown'].includes(String(bucket))) throw new Error('Choose included, excluded, or unknown.');
  const visible = new Set(await loadAnalysisPopulation(context, new Date().toISOString(), set[`${bucket as 'included'|'excluded'|'unknown'}_ids`]));
  const page = pageNumber(params.page), ids = set[`${bucket as 'included'|'excluded'|'unknown'}_ids`].slice((page-1)*50,page*50);
  const contacts = await loadCustomerSetContacts(context,ids), byId = new Map(contacts.map(customer=>[customer.id,customer]));
  const data = publicSetFrom(set,visible,new Map(contacts.map(customer=>[customer.id,name(customer)])),page,bucket as 'included'|'excluded'|'unknown');
  return analysisResult({...data,rows:data.rows.map(row=>({...row,email:byId.get(row.customer_id)!.email}))},data.total_count,`Showing ${bucket} customers from the saved result. Total ${data.total_count}; this is page ${data.page}.`);
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
  if (params.criteria !== undefined && params.matching_step_id !== undefined) throw new Error('Choose either purchase criteria or an original search step, not both.');
  let rule = params.criteria === undefined ? null : validatePurchaseRule(params.criteria);
  let matchingStep: CustomerSet['trail'][number] | undefined;
  if (params.matching_step_id !== undefined) {
    matchingStep = set.trail.find(step=>step.set_id===params.matching_step_id);
    if (!matchingStep) throw new Error('That search step is not part of this saved customer result.');
    if ('reported_spending' in matchingStep) throw new Error('That step selected a reported-spending audience, not product purchases. Keep this saved group and provide explicit purchased criteria with start_date and end_date from its report period.');
    rule = validatePurchaseRule(matchingStep.rule);
  }
  if (rule && rule.mode !== 'purchased') throw new Error('Product details require a purchased rule; choose the earlier positive purchase step.');
  // Relative dates depend on the preceding saved anchors, not the last negative step.
  const anchorStep = matchingStep ? set.trail[set.trail.indexOf(matchingStep)-1] : undefined;
  const anchorSet = rule?.within_days !== undefined && anchorStep
    ? await loadCustomerSet(context,anchorStep.set_id) : null;
  if (rule?.within_days !== undefined && !anchorSet) throw new Error('Choose the original search step for a within-days product question.');
  const cutoff = new Date().toISOString(), page=pageNumber(params.page);
  const visible = new Set<string>();
  for (let offset=0;offset<set.included_ids.length;offset+=100) {
    const {data,error}=await context.dataClient!.from('crm_customers').select('id').eq('tenant_id',context.tenantId)
      .in('id',set.included_ids.slice(offset,offset+100)).is('deleted_at',null).is('merged_into_customer_id',null);
    if(error) throw new Error(error.message);
    for(const row of data??[]) visible.add(String(row.id));
  }
  publicSetFrom(set,visible,new Map());
  const knownEvidence = new Set<string>();
  const facts: PurchaseFact[] = [], sourcePeriods = new Map<string,{start:string|null;end:string|null}>();
  const verifiedStore = snapshotStore(context), generations = new Map<string,string>();
  const store: VerifiedSnapshotStore = {...verifiedStore,async fingerprint(importId) {
    const fingerprint=await verifiedStore.fingerprint(importId), previous=generations.get(importId);
    if(previous!==undefined&&previous!==fingerprint) throw new Error('The report changed during product inspection. No partial result was returned.');
    generations.set(importId,fingerprint);return fingerprint;
  }};
  const ledger = set.included_ids.length ? await loadReportLedger(context.dataClient!,context.tenantId,cutoff) : [];
  // Every batch stays on the indexed saved-audience path, including groups >1,000.
  for(let offset=0;offset<set.included_ids.length;offset+=1000) {
    const result=await loadProductSearchFacts(context.dataClient!,context.tenantId,cutoff,rule??{mode:'purchased'},store,set.included_ids.slice(offset,offset+1000));
    if(!result) throw new Error('The saved customer product evidence could not be read within its scope.');
    facts.push(...result.facts);
    for(const id of result.evidenceCustomerIds) knownEvidence.add(id);
    for(const period of result.sourcePeriods??[]) sourcePeriods.set(JSON.stringify(period),period);
  }
  if(set.included_ids.length&&JSON.stringify(await loadReportLedger(context.dataClient!,context.tenantId,cutoff))!==JSON.stringify(ledger))
    throw new Error('The source ledger changed during product inspection. No partial result was returned.');
  const customersWithEvidence = knownEvidence;
  let selectedFacts = facts, unknownCount = set.included_ids.filter(id=>!customersWithEvidence.has(id)).length;
  if(rule) {
    const matched=explorePurchases({tenantId:context.tenantId,userId:context.userId,conversationId:context.conversationId,
      timezone:set.timezone,population:set.included_ids,facts,rule,label:'Inspect saved group products',now:cutoff,knownEvidence,
      previous:anchorSet?{...anchorSet,included_ids:set.included_ids,trail:[]}:null});
    const evidence=new Set(Object.values(matched.evidence_ids).flat());
    selectedFacts=facts.filter(fact=>evidence.has(fact.id));
    unknownCount=matched.unknown_ids.length;
  }
  const basket=analyzeBasket(selectedFacts,set.included_ids,context.tenantId);
  type ProductDetail = {product_code:string|null;department:string|null;sales_category:string|null;
    import_id:string|null;source:string;evidence_kind:string;period_start:string|null;period_end:string|null;currency:string|null;
    quantity:number|null;net_amount:number|null};
  const productDetails = new Map<string,Map<string,ProductDetail>>();
  for(const fact of selectedFacts) {
    const product=fact.product_name?.trim()||fact.product_code?.trim();
    if(!product||(finiteNumber(fact.quantity)??0)<=0) continue;
    const meta={product_code:fact.product_code,department:fact.department,sales_category:fact.sales_category,
      import_id:fact.import_id??null,source:fact.source,evidence_kind:fact.evidence_kind??'dated_receipt',
      period_start:fact.source_period_start??null,period_end:fact.source_period_end??null,currency:fact.currency};
    const groups=productDetails.get(product)??new Map<string,ProductDetail>(), key=JSON.stringify(meta), previous=groups.get(key);
    const quantity=finiteNumber(fact.quantity), amount=finiteNumber(fact.net_amount);
    groups.set(key,{...meta,quantity:previous?previous.quantity===null||quantity===null?null:Math.round((previous.quantity+quantity)*1000)/1000:quantity,
      net_amount:previous?previous.net_amount===null||amount===null?null:(Math.round(previous.net_amount*100)+Math.round(amount*100))/100:amount});
    productDetails.set(product,groups);
  }
  return analysisResult({kind:'customer_basket',set_id:set.id,captured_at:cutoff,trail:set.trail,
    criteria:rule,matching_step_id:matchingStep?.set_id??null,source_periods:[...sourcePeriods.values()],unknown_count:unknownCount,
    denominator:basket.denominator,total_products:basket.products.length,unnamed_purchase_rows:basket.unnamed_purchase_rows,page,
    rows:basket.products.slice((page-1)*50,page*50).map(row=>{const details=[...(productDetails.get(row.product)?.values()??[])];return {...row,details:details.slice(0,50),details_total:details.length,details_has_more:details.length>50};}),has_more:page*50<basket.products.length,
    notes:['Each product counts distinct customers, not units or transaction rows. Percentages use this exact saved group.',
      'Imported period totals are not dated receipts. Source periods disclose the available coverage; missing or imprecise evidence is unknown.',
      'Inspection does not replace or narrow the saved customer group.']},basket.products.length,
    rule?'These are the matching products purchased by the exact saved customer group.':'These are the products purchased by the exact saved customer group.');
};
export const compareCustomerGrowthTool: ToolImplementation = async (params,context) => {
  const scope=requireScope(params), cutoff=new Date().toISOString(), customers=await loadAnalysisCustomers(context,cutoff);
  const set=scope==='all_customers'?null:await loadCustomerSet(context,scope==='saved_result'?String(params.set_id):undefined);
  if(set) publicSet(set,customers);
  const ids=set?.included_ids??customers.map(c=>c.id), client=context.dataClient!;
  if(params.evidence_basis==='reported_period') {
    const ledger=await loadReportLedger(client,context.tenantId,cutoff);
    // Use the globally selected current snapshot when repeated exports cover
    // the same exact period. Never substitute YTD for a requested full year.
    const active = currentSummaryImports(ledger);
    const selectPeriod=(start:unknown,end:unknown)=>{
      const current=active.filter(row=>row.source_period_start===start&&row.source_period_end===end);
      if(current.length===1)return current[0].id;
      const historical=ledger.filter(row=>row.source_period_start===start&&row.source_period_end===end);
      return historical.length===1?historical[0].id:null;
    };
    const selected=[selectPeriod(params.current_start,params.current_end),selectPeriod(params.baseline_start,params.baseline_end)];
    if(selected.some(id=>id===null)) return analysisResult({kind:'customer_reported_comparison',status:'unavailable',
      requested_current:{start:params.current_start,end:params.current_end},requested_baseline:{start:params.baseline_start,end:params.baseline_end},
      available_periods:active.map(row=>({import_id:row.id,start:row.source_period_start,end:row.source_period_end})),
      rows:[],unknown_count:ids.length,
      note:'Exact comparable source periods are unavailable. Missing coverage is unknown, not zero. Annual totals cannot establish monthly spending or an annual-versus-YTD growth rate. For repeat buyers, search purchases within the earlier saved audience instead of comparing spending.'},0,
      'The requested spending comparison is unavailable because matching report periods are missing. No zero spending or retention rate was inferred.');
    const historicalImportIds=selected as string[];
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

type SpendingEvent = {id:string;customer_id:string|null;amount:number|string|null;raw_data:unknown};
/** Read only the saved audience when it is small enough to use indexed customer IDs.
 * This avoids loading a company's entire imported spending report to rank 413 people. */
export async function loadReportedSpendingEvents(
  client:PersistenceClient,tenantId:string,importId:string,cutoff:string,customerIds?:string[],
):Promise<SpendingEvent[]> {
  const query=()=>client.from('customer_intelligence_source_events')
    .select('id,customer_id,amount,raw_data').eq('tenant_id',tenantId).eq('import_id',importId)
    .eq('event_type','customer_spending').lte('created_at',cutoff);
  if(customerIds){
    const events:SpendingEvent[]=[];
    for(let i=0;i<customerIds.length;i+=100){
      const ids=customerIds.slice(i,i+100);
      events.push(...await readAllPages<SpendingEvent>((from,to)=>
        query().in('customer_id',ids).order('id').range(from,to)));
    }
    return events;
  }
  return readAllPages<SpendingEvent>((from,to)=>query().order('id').range(from,to));
}

/** Select an exact audience from a reported spending period without relabelling it lifetime value. */
export async function exploreCustomerReportedSpending(params: JsonObject,context: ToolExecutionContext,ranking?: {limit:number}): Promise<ToolResult> {
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
  const year=params.calendar_year;
  if(year!==undefined && (typeof year!=='number'||!Number.isInteger(year)||year<1900||year>2100))
    throw new Error('Choose a valid calendar year between 1900 and 2100.');
  const previous = scope==='all_customers'?null:await loadCustomerSet(context,scope==='saved_result'?String(params.set_id):undefined);
  // A follow-up ranking keeps the source snapshot that selected this audience.
  const sourceStep=ranking&&year===undefined?previous?.trail.slice().reverse().find(step=>'reported_spending' in step):undefined;
  const source=sourceStep&&'reported_spending' in sourceStep?sourceStep.reported_spending:undefined;
  const sourceReportId=source&&typeof source==='object'&&'report_id' in source&&typeof source.report_id==='string'?source.report_id:undefined;
  if(sourceStep&&!sourceReportId)throw new Error('The saved audience has invalid source report metadata. Start a new search.');
  let reportQuery=client.from('customer_intelligence_imports')
    .select('id,source_filename,source_period_start,source_period_end').eq('tenant_id',context.tenantId)
    .eq('report_type','customer_spending').eq('status','completed').lte('completed_at',cutoff);
  if(sourceReportId)reportQuery=reportQuery.eq('id',sourceReportId);
  // Never silently use a different year when the question names one.
  if(typeof year==='number') reportQuery=reportQuery
    .gte('source_period_start',`${year}-01-01`).lte('source_period_end',`${year}-12-31`);
  const {data:report,error:reportError}=await reportQuery
    .order('source_period_end',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(reportError) throw new Error(reportError.message);
  if(!report) throw new Error(typeof year==='number'
    ? `There is no reconciled customer spending report for ${year}.`
    : 'There is no reconciled customer spending report available.');
  await assertConversation(context);
  const everyone = await loadAnalysisPopulation(context,cutoff,previous?.included_ids), visible = new Set(everyone);
  if(previous) publicSetFrom(previous,visible,new Map());
  const population=previous?.included_ids??everyone, allowed=new Set(population);
  const events=await loadReportedSpendingEvents(client,context.tenantId,report.id,cutoff,
    previous?.included_ids);
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
  if(ranking){
    // Rank every measured cohort member, including zero/negative spend; no audience-selection thresholds.
    const eligible=[...values.keys()].sort((a,b)=>values.get(b)!.amount-values.get(a)!.amount||a.localeCompare(b));
    const shown=eligible.slice(0,ranking.limit),names=await loadCustomerNames(context,shown);
    return analysisResult({kind:'customer_ranking',set_id:previous?.id??null,captured_at:cutoff,
      scanned_customers:population.length,eligible_customers:eligible.length,shown_customers:shown.length,
      omitted_by_limit:Math.max(0,eligible.length-ranking.limit),unranked_count:population.length-eligible.length,
      total_count:eligible.length,source_filename:report.source_filename,period_start:report.source_period_start,period_end:report.source_period_end,
      rows:shown.map(id=>({customer_id:id,name:names.get(id)??'Customer',reported_period_spend:values.get(id)!.amount,
        reported_transactions:values.get(id)!.transactions,currency})),
      note:'Read-only ranking of the exact saved group. Missing spending evidence is unknown, not zero. The saved audience is unchanged. Reported period spending is not lifetime value or dated receipts.'},
      shown.length,'Ranked the saved customer group without changing its membership.');
  }
  const set=explorePurchases({tenantId:context.tenantId,userId:context.userId,conversationId:context.conversationId,timezone:context.timezone,
    population:everyone,facts:[],rule:{mode:'purchased'},label,previous,now:cutoff});
  set.included_ids=[];set.excluded_ids=[];set.unknown_ids=[];
  for(const id of population){const value=values.get(id);
    if(!value){set.unknown_ids.push(id);set.reasons[id]='no_purchase_history';}
    else if(value.amount>0&&value.amount>=minimum&&value.transactions>=transactions){set.included_ids.push(id);set.reasons[id]='matching_purchase';set.evidence_ids[id]=[value.id];}
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
