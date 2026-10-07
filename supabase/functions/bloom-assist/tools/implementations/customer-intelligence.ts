import type {ToolImplementation} from '../types.ts';
import {rankCustomerPopulation, type RankingRow} from '../../../_shared/customer-intelligence/customer-ranking.ts';
import {finiteNumber} from '../../../_shared/customer-intelligence/purchase-exploration.ts';
import {readAllPages} from '../../../_shared/customer-intelligence/query-pages.ts';
import {analysisResult, loadAnalysisCustomers, loadCustomerSet, requireAnalysisAccess} from './customer-exploration.ts';

export const rankCustomersByIntelligence: ToolImplementation = async (params,context) => {
  const client = await requireAnalysisAccess(context);
  const scope = params.scope ?? 'all_customers';
  if(!['all_customers','previous_result','saved_result'].includes(String(scope))) throw new Error('Choose an explicit ranking population.');
  if(scope==='saved_result' && typeof params.set_id!=='string') throw new Error('Choose the earlier result ID.');
  if(scope!=='saved_result' && params.set_id!==undefined) throw new Error('Use saved_result when choosing a result ID.');
  const customers=await loadAnalysisCustomers(context);
  const set=scope==='all_customers'?null:await loadCustomerSet(context,scope==='saved_result'?String(params.set_id):undefined);
  const visible=new Set(customers.map(c=>c.id));
  if(set?.included_ids.some(id=>!visible.has(id))) throw new Error('Some members of the saved audience are no longer accessible. Start a new search.');
  const allowed=new Set(set?.included_ids??customers.map(c=>c.id));
  const rows=await readAllPages<RankingRow>((from,to)=>client.from('customer_purchase_intelligence')
    .select('customer_id,first_name,last_name,email,lifetime_value,purchase_frequency,days_since_last_purchase,purchase_velocity,total_quantity,departments_shopped,category_spend,department_spend')
    .eq('tenant_id',context.tenantId).order('customer_id').range(from,to));
  const report=rankCustomerPopulation(rows.filter(row=>allowed.has(row.customer_id)),{
    dimension:typeof params.dimension==='string'?params.dimension:undefined,
    dimension_value:typeof params.dimension_value==='string'?params.dimension_value:undefined,
    weights:params.weights,limit:typeof params.limit==='number'?params.limit:100,
  });
  const bucket=params.bucket??'ranked';
  if(!['ranked','unranked'].includes(String(bucket))) throw new Error('Choose ranked or unranked customers.');
  const page=params.page??1;if(typeof page!=='number'||!Number.isInteger(page)||page<1)throw new Error('Choose a valid page.');
  const omittedIds=report.unranked.map(row=>row.customer_id);
  const {unranked, ...publicReport}=report;
  return analysisResult({...publicReport,set_id:set?.id??null,bucket,page,
    unranked_count:omittedIds.length,
    rows:bucket==='unranked'?report.unranked.slice((page-1)*50,page*50):report.rows,
    has_more:bucket==='unranked'&&page*50<report.unranked.length,
    total_count:bucket==='unranked'?report.unranked.length:report.eligible_customers,
    note:'Rankings analyze the named population without replacing the saved customer group. Top-N omissions and missing factors are shown explicitly.'},
    bucket==='unranked'?report.unranked.length:report.shown_customers,'Customer rankings include their source values, components and selected weights.');
};
export const findCustomerOpportunities: ToolImplementation = async (params,context) => {
  const client=await requireAnalysisAccess(context);
  const minimum=params.minimum_decline_percent??25,limit=params.limit??100;
  if(typeof minimum!=='number'||!Number.isFinite(minimum)||minimum<1||minimum>100)throw new Error('Choose a decline between 1% and 100%.');
  if(typeof limit!=='number'||!Number.isInteger(limit)||limit<1||limit>500)throw new Error('Choose a result limit from 1 to 500.');
  const rows=await readAllPages<{customer_id:string;first_name:string|null;last_name:string|null;email:string|null;lifetime_value:number|null;purchase_velocity:number|null}>((from,to)=>client.from('customer_purchase_intelligence')
    .select('customer_id,first_name,last_name,email,lifetime_value,purchase_velocity,days_since_last_purchase,top_product_categories')
    .eq('tenant_id',context.tenantId).order('customer_id').range(from,to));
  const candidates=rows.filter(row=>finiteNumber(row.purchase_velocity)!==null&&Number(row.purchase_velocity)<=-minimum)
    .sort((a,b)=>(finiteNumber(b.lifetime_value)??-Infinity)-(finiteNumber(a.lifetime_value)??-Infinity)||a.customer_id.localeCompare(b.customer_id));
  return analysisResult({kind:'customer_opportunities',criteria:{minimum_decline_percent:minimum},total_count:candidates.length,
    omitted_by_limit:Math.max(0,candidates.length-limit),missing_momentum:rows.filter(row=>finiteNumber(row.purchase_velocity)===null).length,
    rows:candidates.slice(0,limit),source:'Existing purchase velocity metric, not a seasonally matched year-over-year comparison.',
    note:'Historical lifetime value is not a prediction of recoverable revenue. Use compare_customer_growth for explicit comparable periods.'},
    candidates.length,'Found customers with declining recorded purchase velocity. Missing momentum was not treated as zero.');
};
