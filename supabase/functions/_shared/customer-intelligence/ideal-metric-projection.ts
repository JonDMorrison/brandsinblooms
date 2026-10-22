import {assertDate,finiteNumber,localDate,type PurchaseFact} from './purchase-exploration.ts';

export interface IdealProjectionImport {
 id:string;tenant_id:string;source:string;status:string;report_type:string;
 source_sha256:string;completed_at:string|null;source_period_start:string|null;source_period_end:string|null;
}
export interface IdealProjectionScope {
 tenantId:string;customerId:string;startDate:string;endDate:string;timezone:string;cutoff:string;
}
export type IdealProjectionFact=PurchaseFact & {external_line_id?:string|null};
export function idealEvidenceTimestamp(value:string):number{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw new Error('Evidence timestamps require an explicit timestamp offset');
 assertDate(value.slice(0,10));
 const timestamp=Date.parse(value);if(!Number.isFinite(timestamp))throw new Error('Invalid evidence timestamp');
 return timestamp;
}

/** Exact decimal accumulation within a bounded, explicit precision envelope. No rounding policy. */
function decimalUnits(value:number|string):{units:bigint;scale:number}{
 const match=String(value).trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
 if(!match)throw new Error('Quantity needs decimal reconciliation');
 const scale=(match[3]?.length??0)-Number(match[4]??0);
 if(Math.abs(scale)>12||(match[2]+(match[3]??'')).length>30)throw new Error('Quantity exceeds projection precision limits');
 return {units:BigInt(match[1]+match[2]+(match[3]??''))*(scale<0?10n**BigInt(-scale):1n),scale:Math.max(0,scale)};
}

/** One explicitly selected completed source, never an implicit sum of overlapping exports.
 * Values describe observed records, not certified complete visits, lifetime value, or receipt totals.
 * The caller must load ALL rows for this customer/import as of cutoff, not a paginated sample.
 */
export function projectIdealCustomerMetrics(scope:IdealProjectionScope,source:IdealProjectionImport,rows:IdealProjectionFact[]){
 assertDate(scope.startDate);assertDate(scope.endDate);localDate(null,scope.timezone);
 const cutoff=idealEvidenceTimestamp(scope.cutoff),completed=idealEvidenceTimestamp(source.completed_at??'');
 if(!scope.tenantId||!scope.customerId||scope.startDate>scope.endDate||!Number.isFinite(cutoff)
  ||!Number.isFinite(completed)||completed>cutoff||source.status!=='completed'
  ||source.tenant_id!==scope.tenantId||source.source!=='ideal'||!source.id
  ||!/^[a-f0-9]{64}$/i.test(source.source_sha256))throw new Error('A completed, scoped Ideal source with provenance is required');
 const summary=source.report_type==='customer_sales_summary';
 if(!summary&&!['customer_sales','customer_sales_by_category'].includes(source.report_type))
  throw new Error('This report family is not verified purchase evidence');
 if(summary&&(source.source_period_start!==scope.startDate||source.source_period_end!==scope.endDate))
  throw new Error('Summary projection requires the exact original report period');
 const seen=new Map<string,string>(),rowIds=new Map<string,string>(),transactions=new Map<string,string>();
 const categories=new Map<string,number>(),departments=new Map<string,number>();
 let cents=0,quantityUnits=0n,quantityScale=0,records=0,duplicates=0,currency:string|null=null,lastDate:string|null=null;
 let missingCategory=0,missingDepartment=0,missingTransaction=false;
 const evidenceIds:string[]=[];
 for(const row of rows){
  if(row.tenant_id!==scope.tenantId||row.customer_id!==scope.customerId||row.import_id!==source.id||row.source!=='ideal')
   throw new Error('Mixed customer, tenant, or source evidence is not projectable');
  if(!row.id||idealEvidenceTimestamp(row.created_at)>Math.min(cutoff,completed))
   throw new Error('Evidence falls outside the verified read cutoff');
  if(summary!== (row.evidence_kind==='period_summary'))throw new Error('Dated and summary evidence cannot be combined');
  if(summary&&(row.source_period_start!==scope.startDate||row.source_period_end!==scope.endDate||row.purchased_at!==null))
   throw new Error('Summary evidence period disagrees with its source');
  if(!summary&&idealEvidenceTimestamp(row.purchased_at??'')>cutoff)throw new Error('Purchase evidence falls after cutoff');
  const date=summary?null:localDate(row.purchased_at,scope.timezone);
  if(!summary&&(!date||!/[T ].*(?:Z|[+-]\d\d:\d\d)$/.test(row.purchased_at??'')))
   throw new Error('Dated evidence requires an explicit timestamp offset');
  if(date&&(date<scope.startDate||date>scope.endDate))continue;
  const amount=finiteNumber(row.net_amount),units=finiteNumber(row.quantity);
  if(amount===null||units===null||!row.currency||!/^[A-Z]{3}$/.test(row.currency))throw new Error('Source amounts, quantities, or currency need reconciliation');
  const money=decimalUnits(row.net_amount!);
  const divisor=10n**BigInt(Math.max(0,money.scale-2));
  if(money.units%divisor!==0n)throw new Error('Source amount has sub-cent precision');
  const amountCents=Number(money.units/divisor*10n**BigInt(Math.max(0,2-money.scale)));
  if(!Number.isSafeInteger(amountCents))throw new Error('Source amount exceeds exact cents limits');
  if(currency!==null&&currency!==row.currency)throw new Error('Currencies cannot be summed');
  currency=row.currency;
  const decimal=decimalUnits(row.quantity!);
  let canonicalUnits=decimal.units,canonicalScale=decimal.scale;
  while(canonicalScale>0&&canonicalUnits%10n===0n){canonicalUnits/=10n;canonicalScale--;}
  const signature=JSON.stringify([amountCents,`${canonicalUnits}:${canonicalScale}`,row.currency,date,row.product_code,row.product_name,row.sales_category,row.department,row.external_transaction_id??null,row.external_line_id??null]);
  if(rowIds.has(row.id)&&rowIds.get(row.id)!==signature)throw new Error('Conflicting duplicate source row');
  rowIds.set(row.id,signature);
  const key=!summary&&row.external_transaction_id&&row.external_line_id
   ?JSON.stringify([row.external_transaction_id,row.external_line_id]):row.id;
  if(seen.has(key)){
   if(seen.get(key)!==signature)throw new Error('Conflicting duplicate source evidence');
   duplicates++;continue;
  }
  seen.set(key,signature);records++;evidenceIds.push(row.id);
  cents+=amountCents;
  const scale=Math.max(quantityScale,decimal.scale);
  quantityUnits=quantityUnits*10n**BigInt(scale-quantityScale)+decimal.units*10n**BigInt(scale-decimal.scale);quantityScale=scale;
  if(!Number.isSafeInteger(cents)||quantityUnits>BigInt(Number.MAX_SAFE_INTEGER)||quantityUnits<BigInt(Number.MIN_SAFE_INTEGER))throw new Error('Projection exceeds numeric limits');
  if(row.sales_category)categories.set(row.sales_category,(categories.get(row.sales_category)??0)+amountCents);else missingCategory++;
  if(row.department)departments.set(row.department,(departments.get(row.department)??0)+amountCents);else missingDepartment++;
  if((row.sales_category&&!Number.isSafeInteger(categories.get(row.sales_category)))||(row.department&&!Number.isSafeInteger(departments.get(row.department))))throw new Error('Projection bucket exceeds numeric limits');
  if(date){
   if(!lastDate||date>lastDate)lastDate=date;
   if(!row.external_transaction_id)missingTransaction=true;
   else{
    const prior=transactions.get(row.external_transaction_id);
    if(prior&&prior!==date)throw new Error('One transaction identity has conflicting local dates');
    transactions.set(row.external_transaction_id,date);
   }
  }
 }
 const buckets=(values:Map<string,number>)=>Object.fromEntries([...values].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value/100]));
 return {
  version:1 as const,tenant_id:scope.tenantId,customer_id:scope.customerId,source_import_id:source.id,source_sha256:source.source_sha256,
  period:{start:scope.startDate,end:scope.endDate,timezone:scope.timezone},cutoff:scope.cutoff,
  evidence_kind:summary?'period_summary' as const:'dated_lines' as const,coverage:'observed_records_only' as const,
  observed_net_amount:records?cents/100:null,observed_net_cents:records?cents:null,observed_quantity:records?Number(quantityUnits)/10**quantityScale:null,currency,
  distinct_observed_transactions:records&&!summary&&!missingTransaction?transactions.size:null,
  last_observed_purchase_date:lastDate,category_net_amount:buckets(categories),department_net_amount:buckets(departments),
  category_net_cents:Object.fromEntries(categories),department_net_cents:Object.fromEntries(departments),
  records,duplicate_records:duplicates,missing_category_records:missingCategory,missing_department_records:missingDepartment,evidence_ids:evidenceIds.sort(),
  lifetime_value:null,visits:null,average_transaction_value:null,
  limitations:['Complete period and lifetime coverage are not established.','Line amounts are not certified receipt totals; transaction identities are not an agreed visit definition.',...(summary?['Summary totals do not establish transaction dates, recency, or frequency.']:[])],
 };
}
