import {legacySummaryCertificate,verifyLegacySummarySnapshot} from './legacy-summary-evidence.ts';
import {idealEvidenceTimestamp} from './ideal-metric-projection.ts';
import type {PersistenceClient} from '../../bloom-assist/types.ts';
import type {PurchaseFact} from './purchase-exploration.ts';
import {readAllPages} from './query-pages.ts';
import {currentSummaryImports,periodSummaryFacts,type SummaryImport,type PeriodSummaryEvent} from './period-summary.ts';
export interface ReportLedger extends SummaryImport {tenant_id:string;status:string;source_sha256:string;source_filename:string|null;created_at:string;completed_at:string;}
export async function loadReportLedger(client:PersistenceClient,tenantId:string,cutoff:string):Promise<ReportLedger[]>{
 if(!tenantId||!Number.isFinite(idealEvidenceTimestamp(cutoff)))throw Error('Company and valid evidence cutoff are required.');
 const rows=await readAllPages<ReportLedger>((from,to)=>client.from('customer_intelligence_imports').select('id,tenant_id,status,source,source_sha256,source_filename,source_period_start,source_period_end,created_at,completed_at,reconciliation').eq('tenant_id',tenantId).eq('source','ideal').eq('report_type','customer_sales_summary').eq('status','completed').lte('completed_at',cutoff).lte('created_at',cutoff).order('completed_at',{ascending:false}).order('id').range(from,to));
 for(const row of rows)if(row.tenant_id!==tenantId||row.status!=='completed'||row.source!=='ideal'||!Number.isFinite(idealEvidenceTimestamp(row.completed_at))||idealEvidenceTimestamp(row.completed_at)>idealEvidenceTimestamp(cutoff)||!Number.isFinite(idealEvidenceTimestamp(row.created_at))||idealEvidenceTimestamp(row.created_at)>idealEvidenceTimestamp(cutoff))throw Error('Invalid completed report scope.');
 currentSummaryImports(rows);return rows;
}
type ReportOptions = {historicalImportIds?:string[];customerIds?:string[]};
/** Select globally before customer filtering. Retained snapshots are never additive sales. */
export async function loadReportedEvidence(client:PersistenceClient,tenantId:string,cutoff:string,options:ReportOptions={}){
 const facts:PurchaseFact[]=[];
 const result=await visitReportedEvidence(client,tenantId,cutoff,options,rows=>{for(const row of rows)facts.push(row);});
 return {...result,facts};
}
/** Validates one entire source before yielding its facts; callers must publish only after this resolves.
 * Raw rows and expanded facts from earlier imports are not retained by this visitor.
 */
export async function visitReportedEvidence(client:PersistenceClient,tenantId:string,cutoff:string,options:ReportOptions,visit:(facts:Iterable<PurchaseFact>)=>void){
 const ledger=await loadReportLedger(client,tenantId,cutoff);const active=currentSummaryImports(ledger);const ids=options.historicalImportIds;
 const selected:ReportLedger[]=ids?ledger.filter(row=>ids.includes(row.id)):active.map(row=>ledger.find(entry=>entry.id===row.id)!);
 if(ids&&(new Set(ids).size!==ids.length||selected.length!==ids.length))throw Error('Historical report selection is unavailable or ambiguous.');
 let identities:{id:string;tenant_id:string;external_id:string|null}[]|undefined;
 const allowed=options.customerIds?new Set(options.customerIds):null;
 const sourceByEvent=new Map<string,string>();
 for(const parent of selected){
  const rows=(await loadSummaryRows(client,tenantId,cutoff,parent.id)).filter(row=>row.import_id===parent.id);
  const certificate=legacySummaryCertificate(parent);
  if(certificate){
   identities??=await readAllPages<{id:string;tenant_id:string;external_id:string|null}>((from,to)=>client.from('crm_customers').select('id,tenant_id,external_id').eq('tenant_id',tenantId).is('deleted_at',null).is('merged_into_customer_id',null).order('id').range(from,to));
   await verifyLegacySummarySnapshot(rows,certificate,identities);
  }
  for(const row of rows){
   const raw=row.raw_data as {period_start?:unknown;period_end?:unknown;source_sha256?:unknown}|null;
   if(row.tenant_id!==tenantId||row.source!==parent.source||!Number.isFinite(idealEvidenceTimestamp(row.created_at))||idealEvidenceTimestamp(row.created_at)>idealEvidenceTimestamp(cutoff)||(!certificate&&raw?.source_sha256!==parent.source_sha256)||raw?.period_start!==parent.source_period_start||raw?.period_end!==parent.source_period_end)throw Error('Report facts do not match their completed source ledger.');
   const prior=sourceByEvent.get(row.id);
   if(prior&&prior!==parent.id)throw Error('Conflicting report fact identity.');
   sourceByEvent.set(row.id,parent.id);
   // Validate every product even if the caller filters out this customer.
   periodSummaryFacts([row],tenantId);
  }
  function* facts(){for(const row of rows)for(const fact of periodSummaryFacts([row],tenantId))if(!allowed||(fact.customer_id!==null&&allowed.has(fact.customer_id)))yield fact;}
  visit(facts());
 }
 return {ledger,activeImportIds:active.map(r=>r.id)};
}
/** One import's report rows by ID cursor; each page costs the same however deep it is. */
export async function loadSummaryRows(client:PersistenceClient,tenantId:string,cutoff:string,importId:string,pageSize=1000,maximum=250000,maximumItems=2000000){
 type Row=PeriodSummaryEvent & {external_customer_code?:string};
 const rows:Row[]=[];let after:string|null=null;let items=0;
 for(;;){
  let query=client.from('customer_intelligence_source_events').select('id,tenant_id,customer_id,external_customer_code,import_id,source,created_at,raw_data').eq('tenant_id',tenantId).eq('source','ideal').eq('event_type','purchase_summary').eq('import_id',importId).lte('created_at',cutoff);
  if(after)query=query.gt('id',after);
  const {data,error}=await query.order('id').range(0,pageSize-1);
  if(error)throw new Error(error.message);
  const page=(data??[]) as Row[];
  if(rows.length+page.length>maximum)throw new Error(`The analysis exceeds the ${maximum.toLocaleString()}-record safety limit. No partial total was returned.`);
  for(const row of page){const raw=row.raw_data as {items?:unknown}|null;if(Array.isArray(raw?.items))items+=raw.items.length;}
  if(items>maximumItems)throw new Error(`The analysis exceeds the ${maximumItems.toLocaleString()}-product safety limit. No partial total was returned.`);
  rows.push(...page);
  if(page.length<pageSize)return rows;
  after=page[page.length-1].id;
 }
}
