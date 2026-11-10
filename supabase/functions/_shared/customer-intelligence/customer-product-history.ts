import type {PersistenceClient} from '../../bloom-assist/types.ts';
import {readAllPages} from './query-pages.ts';
import {loadReportLedger} from './load-reported-evidence.ts';
import {legacySummaryCertificate} from './legacy-summary-evidence.ts';
import {currentSummaryImports,periodSummaryFacts,type PeriodSummaryEvent} from './period-summary.ts';
import {moneyMinorUnits} from './customer-growth.ts';
import type {PurchaseFact} from './purchase-exploration.ts';

/**
 * One customer's product evidence, read through the customer index only.
 * Never scans the company. Each reported period stays separate and is labelled
 * as a report total. Missing evidence is unknown, never "no purchases".
 */
export type ProductHistoryStatus='matched'|'no_matching_products'|'no_purchase_evidence';
export interface ProductHistoryRow {product_code:string|null;product_name:string|null;department:string|null;sales_category:string|null;quantity:number|null;net_amount:number|null;currency:string|null;purchased_at:string|null;}
export interface ProductHistoryGroup {
  evidence_kind:'reported_period_total'|'dated_receipts';
  period_start:string|null;period_end:string|null;source_filename:string|null;import_id:string|null;
  total_products:number;matched_products:number;matched_quantity:number;matched_net_amount:number;currency:string|null;
  rows:ProductHistoryRow[];has_more:boolean;
}
export interface ProductHistoryResult {
  kind:'customer_product_history';customer_id:string;customer_name:string;captured_at:string;
  product_query:string|null;status:ProductHistoryStatus;groups:ProductHistoryGroup[];note:string;
}
export const PRODUCT_HISTORY_ROW_LIMIT=100;
const LEGACY_COLUMNS=['product_code','product_name','department','quantity','net_amount','source_row'];

interface CustomerIdentity {id:string;tenant_id:string;external_id:string|null;first_name:string|null;last_name:string|null;email:string|null;merged_into_customer_id:string|null;deleted_at:string|null;}
interface SummaryEventRow extends PeriodSummaryEvent {external_customer_code:string|null;}
type DatedRow=PurchaseFact & {import_id:string|null};

const SUMMARY_SELECT='id,tenant_id,customer_id,external_customer_code,import_id,source,created_at,raw_data';
const DATED_SELECT='id,tenant_id,customer_id,product_code,product_name,sales_category,department,quantity,net_amount,currency,purchased_at,created_at,source,import_id,external_transaction_id';

export class ProductHistoryNotFound extends Error {}

function tokens(query:string|null){return query?query.toLowerCase().split(/\s+/).map(t=>t.trim()).filter(Boolean):[];}
/** Literal, case-insensitive. Every word must appear in the name, code, department or category. No regex or SQL wildcards. */
export function matchesProductQuery(row:Pick<ProductHistoryRow,'product_code'|'product_name'|'department'|'sales_category'>,query:string|null){
  const words=tokens(query);if(!words.length)return true;
  const haystack=[row.product_name,row.product_code,row.department,row.sales_category].filter(Boolean).join(' ').toLowerCase();
  return words.every(word=>haystack.includes(word)||(word.length>3&&word.endsWith('s')&&haystack.includes(word.slice(0,-1))));
}
function num(value:unknown){const n=typeof value==='string'?Number(value):value;return typeof n==='number'&&Number.isFinite(n)?n:null;}
function roundQuantity(value:number){return Math.round(value*1000)/1000;}

function summarise(kind:ProductHistoryGroup['evidence_kind'],facts:PurchaseFact[],query:string|null,meta:Pick<ProductHistoryGroup,'period_start'|'period_end'|'source_filename'|'import_id'>):ProductHistoryGroup{
  const matched=facts.filter(f=>matchesProductQuery(f,query));
  const currencies=new Set(matched.map(f=>f.currency).filter((c):c is string=>Boolean(c)));
  if(currencies.size>1)throw new Error('This customer’s evidence mixes currencies. No combined total was returned.');
  let cents=0,quantity=0;
  for(const f of matched){
    const minor=moneyMinorUnits(f.net_amount);if(minor===null)throw new Error('A source product amount needs reconciliation. No partial total was returned.');
    cents+=minor;const q=num(f.quantity);if(q!==null)quantity+=q;
  }
  const rows=matched.map(f=>({product_code:f.product_code,product_name:f.product_name,department:f.department,sales_category:f.sales_category,quantity:num(f.quantity),net_amount:num(f.net_amount),currency:f.currency,purchased_at:f.purchased_at}));
  if(kind==='dated_receipts')rows.sort((a,b)=>(b.purchased_at??'').localeCompare(a.purchased_at??''));
  else rows.sort((a,b)=>(b.net_amount??0)-(a.net_amount??0));
  return {evidence_kind:kind,...meta,total_products:facts.length,matched_products:matched.length,matched_quantity:roundQuantity(quantity),
    matched_net_amount:cents/100,currency:[...currencies][0]??null,rows:rows.slice(0,PRODUCT_HISTORY_ROW_LIMIT),has_more:rows.length>PRODUCT_HISTORY_ROW_LIMIT};
}

export async function loadCustomerProductHistory(client:PersistenceClient,args:{tenantId:string;customerId:string;cutoff:string;productQuery?:string|null}):Promise<ProductHistoryResult>{
  const {tenantId,customerId,cutoff}=args;const productQuery=args.productQuery?.trim()||null;
  if(!tenantId||!customerId||!Number.isFinite(Date.parse(cutoff)))throw new Error('Company, customer and a valid evidence cutoff are required.');

  const {data:customer,error:customerError}=await client.from('crm_customers').select('id,tenant_id,external_id,first_name,last_name,email,merged_into_customer_id,deleted_at')
    .eq('tenant_id',tenantId).eq('id',customerId).maybeSingle();
  if(customerError)throw new Error(customerError.message);
  if(!customer)throw new ProductHistoryNotFound('No accessible customer has that ID in this company.');
  const identity=customer as CustomerIdentity;
  if(identity.tenant_id!==tenantId||identity.id!==customerId)throw new Error('Customer scope differs from the request.');
  if(identity.merged_into_customer_id)throw new ProductHistoryNotFound(`This customer record was merged into ${identity.merged_into_customer_id}. Look up that customer instead.`);
  // Merged aliases are soft-deleted, so check the merge pointer before treating deletion as not found.
  if(identity.deleted_at)throw new ProductHistoryNotFound('No accessible customer has that ID in this company.');

  // Report ledger is a handful of rows per company; selection is global so a
  // superseded snapshot is never revived for one customer.
  const ledger=await loadReportLedger(client,tenantId,cutoff);
  const active=currentSummaryImports(ledger);
  const activeById=new Map(ledger.filter(row=>active.some(a=>a.id===row.id)).map(row=>[row.id,row]));

  const summaryRows=activeById.size?await readAllPages<SummaryEventRow>((from,to)=>client.from('customer_intelligence_source_events').select(SUMMARY_SELECT)
    .eq('tenant_id',tenantId).eq('customer_id',customerId).eq('source','ideal').eq('event_type','purchase_summary')
    .in('import_id',[...activeById.keys()]).lte('created_at',cutoff).order('id').range(from,to),5000):[];
  const seenImports=new Set<string>();const groups:ProductHistoryGroup[]=[];
  for(const row of summaryRows){
    const parent=activeById.get(row.import_id);const raw=row.raw_data as Record<string,unknown>|null;
    if(!parent||row.tenant_id!==tenantId||row.customer_id!==customerId||row.source!==parent.source)throw new Error('Report evidence does not match its completed source ledger.');
    if(seenImports.has(row.import_id))throw new Error('This customer has duplicate summaries in one report. They need reconciliation before a total is returned.');
    seenImports.add(row.import_id);
    if(!raw||raw.period_start!==parent.source_period_start||raw.period_end!==parent.source_period_end)throw new Error('Report evidence period does not match its completed source ledger.');
    const certificate=legacySummaryCertificate(parent);
    if(certificate){
      // Per-row checks from the reconciled legacy format. The full-snapshot hash is
      // verified by company-wide analysis; one customer's read must not require 30k rows.
      if(Object.hasOwn(raw,'source_sha256')||raw.source_filename!==certificate.filename||raw.dated_transactions!==false||raw.currency!=='CAD'
        ||JSON.stringify(raw.columns)!==JSON.stringify(LEGACY_COLUMNS)
        ||!row.external_customer_code||row.external_customer_code!==identity.external_id)throw new Error('Legacy report evidence differs from its reconciled format or customer code.');
    }else if(raw.source_sha256!==parent.source_sha256)throw new Error('Report evidence does not match its completed source ledger.');
    groups.push(summarise('reported_period_total',periodSummaryFacts([row],tenantId),productQuery,
      {period_start:parent.source_period_start,period_end:parent.source_period_end,source_filename:parent.source_filename,import_id:parent.id}));
  }
  groups.sort((a,b)=>(b.period_end??'').localeCompare(a.period_end??''));

  const dated=await readAllPages<DatedRow>((from,to)=>client.from('customer_purchase_line_items').select(DATED_SELECT)
    .eq('tenant_id',tenantId).eq('customer_id',customerId).lte('created_at',cutoff).order('id').range(from,to),20000);
  const importIds=[...new Set(dated.flatMap(f=>f.import_id?[f.import_id]:[]))];
  const completed=importIds.length?await readAllPages<{id:string;source:string}>((from,to)=>client.from('customer_intelligence_imports').select('id,source')
    .eq('tenant_id',tenantId).eq('status','completed').in('id',importIds).lte('completed_at',cutoff).lte('created_at',cutoff).order('id').range(from,to)):[];
  const completedSources=new Map(completed.map(row=>[row.id,row.source]));
  // Same contract as company analysis: Ideal dated imports are not certified receipts yet.
  const eligible=dated.filter(f=>f.source!=='ideal'&&(!f.import_id||completedSources.get(f.import_id)===f.source));
  if(eligible.some(f=>f.tenant_id!==tenantId||f.customer_id!==customerId))throw new Error('Cross-company purchase evidence was rejected.');
  if(eligible.length)groups.push(summarise('dated_receipts',eligible,productQuery,{period_start:null,period_end:null,source_filename:null,import_id:null}));

  const anyEvidence=groups.some(g=>g.total_products>0);
  const anyMatch=groups.some(g=>g.matched_products>0);
  const status:ProductHistoryStatus=!anyEvidence?'no_purchase_evidence':anyMatch?'matched':'no_matching_products';
  const name=[identity.first_name,identity.last_name].filter(Boolean).join(' ')||identity.email||'Customer';
  const kinds=new Set(groups.filter(g=>g.matched_products>0||status!=='matched').map(g=>g.evidence_kind));
  const note=status==='no_purchase_evidence'
    ?'No imported purchase records are on file for this customer. This is unknown history, not proof that the customer bought nothing.'
    :status==='no_matching_products'
      ?'Purchase records exist, but no product in them matches the search. This covers imported records only, not every possible purchase.'
      :[kinds.has('reported_period_total')?'Reported period totals are POS report sums for each stated period. They have no individual purchase dates and are not receipt counts.':null,
        kinds.has('dated_receipts')?'Dated receipts are individual recorded purchases with their dates.':null].filter(Boolean).join(' ');
  return {kind:'customer_product_history',customer_id:customerId,customer_name:name,captured_at:cutoff,product_query:productQuery,status,groups,note};
}
