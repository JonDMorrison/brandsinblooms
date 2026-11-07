import type {PersistenceClient} from '../../bloom-assist/types.ts';
import type {PurchaseFact} from './purchase-exploration.ts';
import {readAllPages} from './query-pages.ts';
import {loadReportedEvidence} from './load-reported-evidence.ts';

/** Dated line items from completed imports. Ideal dated rows are not a certified receipt contract yet. */
export async function loadEligibleDatedFacts(client: PersistenceClient, tenantId: string, cutoff: string, customerIds?: string[]): Promise<PurchaseFact[]> {
  const bounds=customerIds?[...customerIds].sort():null;
  const dated = await readAllPages<PurchaseFact>((from,to) => {let query=client.from('customer_purchase_line_items').select('id,tenant_id,customer_id,product_code,product_name,sales_category,department,quantity,net_amount,currency,purchased_at,created_at,source,import_id,external_transaction_id').eq('tenant_id',tenantId).neq('source','ideal').lte('created_at',cutoff);if(bounds)query=query.gte('customer_id',bounds[0]).lte('customer_id',bounds[bounds.length-1]);return query.order('id').range(from,to);});
  const importedIds=[...new Set(dated.flatMap(f=>f.import_id?[f.import_id]:[]))];
  const completed=importedIds.length?await readAllPages<{id:string;source:string}>((from,to)=>client.from('customer_intelligence_imports').select('id,source').eq('tenant_id',tenantId).eq('status','completed').in('id',importedIds).lte('completed_at',cutoff).lte('created_at',cutoff).order('id').range(from,to)):[];
  const completedSources=new Map(completed.map(row=>[row.id,row.source]));
  // Ideal dated imports have no certified complete receipt contract yet. Never infer visits from completion alone.
  // The query already skips them, because a company can hold hundreds of thousands of journal lines;
  // this filter stays as the contract check.
  const eligibleDated=dated.filter(f=>f.source!=='ideal'&&(!f.import_id||completedSources.get(f.import_id)===f.source));
  if(eligibleDated.some(f=>f.tenant_id!==tenantId))throw Error('Cross-company purchase evidence was rejected.');
  return eligibleDated;
}

export async function loadCompanyAnalysisFacts(client: PersistenceClient, tenantId: string, cutoff: string, customerIds?: string[]): Promise<PurchaseFact[]> {
  if(!tenantId||!Number.isFinite(Date.parse(cutoff)))throw Error('Company and valid evidence cutoff are required.');
  if(customerIds?.length===0)return [];
  const allowed=customerIds?new Set(customerIds):null;
  const eligibleDated=await loadEligibleDatedFacts(client,tenantId,cutoff,customerIds);
  const summaries=await loadReportedEvidence(client,tenantId,cutoff,{customerIds});
  const facts=[...eligibleDated,...summaries.facts];
  return allowed?facts.filter(f=>f.customer_id!==null&&allowed.has(f.customer_id)):facts;
}
