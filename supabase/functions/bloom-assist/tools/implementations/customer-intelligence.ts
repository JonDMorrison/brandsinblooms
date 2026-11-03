import type {ToolImplementation} from '../types.ts';
import {rankCustomerPopulation, type RankingRow} from '../../../_shared/customer-intelligence/customer-ranking.ts';
import {finiteNumber} from '../../../_shared/customer-intelligence/purchase-exploration.ts';
import {readAllPages} from '../../../_shared/customer-intelligence/query-pages.ts';
import {analysisResult, exploreCustomerPurchases, loadAnalysisPopulation, loadCustomerSet, requireAnalysisAccess} from './customer-exploration.ts';

export const rankCustomersByIntelligence: ToolImplementation = async (params,context) => {
  const client = await requireAnalysisAccess(context);
  const scope = params.scope ?? 'all_customers';
  if(!['all_customers','previous_result','saved_result'].includes(String(scope))) throw new Error('Choose an explicit ranking population.');
  if(scope==='saved_result' && typeof params.set_id!=='string') throw new Error('Choose the earlier result ID.');
  if(scope!=='saved_result' && params.set_id!==undefined) throw new Error('Use saved_result when choosing a result ID.');
  const population=await loadAnalysisPopulation(context);
  const set=scope==='all_customers'?null:await loadCustomerSet(context,scope==='saved_result'?String(params.set_id):undefined);
  const visible=new Set(population);
  if(set?.included_ids.some(id=>!visible.has(id))) throw new Error('Some members of the saved audience are no longer accessible. Start a new search.');
  const allowed=new Set(set?.included_ids??population);
  const rows=await readAllPages<RankingRow>((from,to)=>client.from('customer_purchase_intelligence')
    .select('customer_id,first_name,last_name,email,lifetime_value,purchase_frequency,days_since_last_purchase,purchase_velocity,total_quantity,departments_shopped,category_spend,department_spend')
    .eq('tenant_id',context.tenantId).order('customer_id').range(from,to));
  const report=rankCustomerPopulation(rows.filter(row=>allowed.has(row.customer_id)),{
    dimension:typeof params.dimension==='string'?params.dimension:undefined,
    dimension_value:typeof params.dimension_value==='string'?params.dimension_value:undefined,
    weights:params.weights,limit:typeof params.limit==='number'?params.limit:100,
  });
  // Companies with only imported sales reports have no receipt metrics to rank, so every
  // customer would be "unranked". Rank by reported spending on the named department instead.
  const value=typeof params.dimension_value==='string'?params.dimension_value.trim():'';
  if(report.eligible_customers===0&&report.dimension!=='overall'&&value&&(params.bucket===undefined||params.bucket==='ranked')){
    const fallback=await exploreCustomerPurchases({scope:String(scope),...(scope==='saved_result'?{set_id:params.set_id}:{}),label:`Top ${value} shoppers`.slice(0,180),criteria:{mode:'purchased',department:value}},context);
    const data=fallback.data as Record<string,unknown>|null;
    return {...fallback,data:data?{...data,ranking_basis:'reported_department_spend',
      note:'No dated receipt metrics exist for this company, so customers are ordered by their reported spending in this department from the imported sales reports. 50 per page; use inspect_customer_set for more.'}:data,
      message:`${fallback.message} Ordered by reported spending in ${value}, largest first.`};
  }
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
  const missingMomentum=rows.filter(row=>finiteNumber(row.purchase_velocity)===null).length;
  return analysisResult({kind:'customer_opportunities',criteria:{minimum_decline_percent:minimum},total_count:candidates.length,
    omitted_by_limit:Math.max(0,candidates.length-limit),missing_momentum:missingMomentum,
    rows:candidates.slice(0,limit),source:'Existing purchase velocity metric, not a seasonally matched year-over-year comparison.',
    note:'Historical lifetime value is not a prediction of recoverable revenue. Use compare_customer_growth for explicit comparable periods.'},
    candidates.length,opportunityMessage(candidates.length,rows.length,missingMomentum,minimum));
};

export function opportunityMessage(found:number,total:number,missingMomentum:number,minimum:number):string{
  if(found>0)return `Found ${found.toLocaleString('en-US')} ${found===1?'customer':'customers'} whose recorded buying slowed by ${minimum}% or more. Customers with no buying trend on file were left out, not counted as zero.`;
  if(total===0)return 'No customer could be scored. There is no recorded buying history on file for this company yet, so a slowdown cannot be measured.';
  const scored=total-missingMomentum;
  if(scored===0)return `No customer could be scored. None of the ${total.toLocaleString('en-US')} customers on file have a buying trend recorded, usually because there are no dated sales records. This does not mean nobody is buying less.`;
  const gap=missingMomentum>0?` ${missingMomentum.toLocaleString('en-US')} more customers have no buying trend on file, so they could not be checked.`:'';
  return `No customer matched. ${scored.toLocaleString('en-US')} customers were checked and none slowed by ${minimum}% or more.${gap}`;
}
