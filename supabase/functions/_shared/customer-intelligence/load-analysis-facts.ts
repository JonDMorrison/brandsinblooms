import type {PersistenceClient} from '../../bloom-assist/types.ts';
import type {PurchaseFact} from './purchase-exploration.ts';
import {readAllPages} from './query-pages.ts';
import {periodSummaryFacts,currentSummaryImports,type SummaryImport,type PeriodSummaryEvent} from './period-summary.ts';
export async function loadCompanyAnalysisFacts(client: PersistenceClient, tenantId: string, cutoff: string, customerIds?: string[]): Promise<PurchaseFact[]> {
  if(customerIds?.length===0)return [];
  const bounds=customerIds?[...customerIds].sort():null;
  const allowed=customerIds?new Set(customerIds):null;
  const dated = await readAllPages<PurchaseFact>((from,to) => {let query=client.from('customer_purchase_line_items').select('id,tenant_id,customer_id,product_code,product_name,sales_category,department,quantity,net_amount,currency,purchased_at,created_at,source,import_id,external_transaction_id').eq('tenant_id',tenantId).lte('created_at',cutoff);if(bounds)query=query.gte('customer_id',bounds[0]).lte('customer_id',bounds[bounds.length-1]);return query.order('id').range(from,to);});
  const imports = await readAllPages<SummaryImport>((from,to) => client.from('customer_intelligence_imports')
    .select('id,source,source_period_start,source_period_end').eq('tenant_id',tenantId).eq('report_type','customer_sales_summary')
    .eq('status','completed').lte('completed_at',cutoff).lte('created_at',cutoff).order('created_at',{ascending:false}).order('id').range(from,to));
  if (!imports.length) return allowed?dated.filter(f=>f.customer_id!==null&&allowed.has(f.customer_id)):dated;
  const summaries = await readAllPages<PeriodSummaryEvent>((from,to) => {let query=client.from('customer_intelligence_source_events')
    .select('id,tenant_id,customer_id,import_id,source,created_at,raw_data').eq('tenant_id',tenantId)
    .eq('event_type','purchase_summary').in('import_id',currentSummaryImports(imports).map(row=>row.id)).lte('created_at',cutoff);if(bounds)query=query.gte('customer_id',bounds[0]).lte('customer_id',bounds[bounds.length-1]);return query.order('id').range(from,to);});
  const facts=[...dated,...periodSummaryFacts(summaries,tenantId)];
  return allowed?facts.filter(f=>f.customer_id!==null&&allowed.has(f.customer_id)):facts;
}