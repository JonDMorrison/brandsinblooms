import type {PersistenceClient} from '../../bloom-assist/types.ts';
import {periodSummaryFacts,type PeriodSummaryEvent} from './period-summary.ts';
import {projectIdealCustomerMetrics,type IdealProjectionFact,type IdealProjectionImport,type IdealProjectionScope} from './ideal-metric-projection.ts';

const MAXIMUM=250000;
/** Uses the caller's authenticated client/RLS. No service key, writes, or partial totals.
 * Completed source facts must remain immutable. Counts/ledger checks detect common changes,
 * but separate SELECT pages are not a database transaction snapshot.
 */
export async function loadIdealMetricProjection(client:Pick<PersistenceClient,'from'>,scope:IdealProjectionScope & {importId:string;sourceSha256:string},signal?:AbortSignal){
 const loadSource=async()=>{
  let query=client.from('customer_intelligence_imports')
   .select('id,tenant_id,source,status,report_type,source_sha256,completed_at,source_period_start,source_period_end')
   .eq('tenant_id',scope.tenantId).eq('id',scope.importId).eq('source','ideal')
   .eq('source_sha256',scope.sourceSha256).eq('status','completed').lte('completed_at',scope.cutoff);
  if(signal)query=query.abortSignal(signal);
  const {data,error}=await query.maybeSingle();
  if(error||!data)throw new Error('The selected completed source is unavailable or not permitted');
  if(data.id!==scope.importId||data.source_sha256!==scope.sourceSha256)throw new Error('Source identity changed');
  return data as IdealProjectionImport;
 };
 const source=await loadSource();
 projectIdealCustomerMetrics(scope,source,[]); // Validate scope even when RLS returns no facts.
 const summary=source.report_type==='customer_sales_summary';
 const rows:Array<PeriodSummaryEvent|IdealProjectionFact>=[],ids=new Set<string>();
 let total:number|undefined;
 for(let from=0;;from+=1000){
  // Literal selections keep each report schema independently inferred by PostgREST.
  let query=summary
   ?client.from('customer_intelligence_source_events').select('id,tenant_id,customer_id,import_id,source,created_at,raw_data',{count:'exact'})
   :client.from('customer_purchase_line_items').select('id,tenant_id,customer_id,import_id,source,created_at,product_code,product_name,sales_category,department,quantity,net_amount,currency,purchased_at,external_transaction_id,external_line_id',{count:'exact'});
  query=query.eq('tenant_id',scope.tenantId)
   .eq('customer_id',scope.customerId).eq('import_id',scope.importId).eq('source','ideal').lte('created_at',scope.cutoff);
  if(summary)query=query.eq('event_type','purchase_summary');
  if(signal)query=query.abortSignal(signal);
  const {data,error,count}=await query.order('id').range(from,from+999);
  if(error||!data||count===null||!Number.isSafeInteger(count)||count<0||count>MAXIMUM)
   throw new Error('Complete source evidence could not be read within the projection limit');
  if(total!==undefined&&total!==count)throw new Error('Source evidence changed during pagination');
  total=count;
  if(data.length!==Math.min(1000,Math.max(0,count-from)))throw new Error('Source evidence was truncated; no partial projection returned');
  for(const row of data){
   if(ids.has(row.id))throw new Error('Source evidence pagination repeated a row');
   ids.add(row.id);rows.push(row as PeriodSummaryEvent|IdealProjectionFact);
  }
  if(rows.length===total)break;
 }
 const facts:IdealProjectionFact[]=[];
 if(summary){
  for(const row of rows as PeriodSummaryEvent[]){
   const raw=row.raw_data as {items?:unknown}|null;
   if(!Array.isArray(raw?.items)||raw.items.length>MAXIMUM-facts.length)throw new Error('Summary expansion exceeds the projection limit or needs reconciliation');
   for(const fact of periodSummaryFacts([row],scope.tenantId))facts.push(fact);
  }
 }else for(const row of rows as IdealProjectionFact[])facts.push(row);
 const latest=await loadSource();
 if(JSON.stringify(latest)!==JSON.stringify(source))throw new Error('Source ledger changed during projection');
 return projectIdealCustomerMetrics(scope,source,facts);
}
