import type { PersistenceClient } from '../../bloom-assist/types.ts';
import { moneyMinorUnits, validateGrowthSettings, type GrowthSettings } from './customer-growth.ts';
import { assertDate, localDate } from './purchase-exploration.ts';
import { readAllPages } from './query-pages.ts';

type Window = {start:string;end:string};
export type JournalSource = {id:string;tenant_id:string;source:string;report_type:string;status:string;source_period_start:string|null;source_period_end:string|null;source_filename:string|null;source_sha256:string;created_at:string;completed_at:string|null;reconciliation:unknown};
export type JournalLine = {id:string;tenant_id:string;import_id:string;source:string;customer_id:string|null;external_customer_code:string;external_transaction_id:string;external_line_id:string;purchased_at:string;created_at:string;currency:string|null;net_amount:number|string|null;product_code?:string|null;quantity?:number|string|null;raw_data?:unknown};
export type JournalCustomer = {id:string;tenant_id:string;external_id:string|null;first_name:string|null;last_name:string|null};
type CustomerActivity={id:string;name:string;netMinor:number;positiveReceipts:number;positivePurchaseDays:number;validReceipts:number;invalidReceipts:number};
export type JournalReceiptEvidence={id:string;customerId:string;timestamp:string;day:string;netMinor:number;featuredNetQuantityMilli:number|null;paidFeaturedPurchase:boolean};
export type ObservedJournalPeriod={tenantId:string;window:Window;currency:string;timezone:string;cutoff:string;source:JournalSource;customers:CustomerActivity[];validReceipts:number;positiveReceipts:number;zeroReceipts:number;negativeReceipts:number;excludedReceipts:number;receiptEvidence?:JournalReceiptEvidence[]};
const validStamp=(s:unknown):s is string=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function dateWindow(window:Window,cutoff:string,timezone:string) {
  assertDate(window.start);assertDate(window.end);
  if(!validStamp(cutoff)||window.end<window.start||window.end>(localDate(cutoff,timezone)??'')||Date.parse(window.end+'T00:00:00Z')-Date.parse(window.start+'T00:00:00Z')>93*86400000)throw Error('Choose an ordered journal period of at most 94 days, ending no later than the source-read date.');
}
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const int=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value);
const positiveInt=(value:unknown):value is number=>int(value)&&value>0;
const nonnegativeInt=(value:unknown):value is number=>int(value)&&value>=0;
const BC_2026_RULE='BC 2026 March 8 final transition; explicit original wall-clock offset; no November fallback';
/** This mode is deliberately distinct from a completed journal: every included
 * customer reconciled independently, but the company source is incomplete. */
export function journalCoverage(source:JournalSource){
  const meta=record(source.reconciliation),a=record(meta.applied);
  return source.report_type==='journal_partial'
    ?{mode:'reconciled_customer_cohort' as const,complete:false as const,sourceReceipts:a.source_receipts as number,includedReceipts:a.receipts as number,excludedReceipts:a.excluded_receipts as number,includedCustomers:a.customers as number}
    :{mode:'observed_journal' as const,complete:false as const,sourceReceipts:null,includedReceipts:null,excludedReceipts:null,includedCustomers:null};
}
function verifiedPartial(s:JournalSource,cutoff:string){
  const m=record(s.reconciliation),a=record(m.applied),e=record(m.expected);
  if(s.report_type!=='journal_partial'||s.status!=='completed_with_errors'||m.version!==1||m.coverage_mode!=='reconciled_customer_cohort'||m.coverage_complete!==false||a.coverage_complete!==false||a.invalid_receipts!==0||a.invalid_identities!==0||!hash(m.control_source_sha256)||!hash(m.cohort_control_sha256)||a.control_digest!==m.cohort_control_sha256||!validStamp(m.verified_at)||Date.parse(m.verified_at)>Date.parse(cutoff)||m.timezone!=='America/Vancouver'||m.timestamp_rule!==BC_2026_RULE||s.source_period_start!<'2026-01-01'||s.source_period_end!>'2026-12-31')return false;
  for(const key of ['lines','receipts','customers','source_receipts','excluded_receipts','positive','zero','negative','net_cents','rounding_cents','tax_cents','tender_cents']){
    if(!int(a[key])||a[key]!==e[key])return false;
  }
  if(!positiveInt(a.customers)||!positiveInt(a.receipts)||!positiveInt(a.excluded_receipts)||!positiveInt(a.lines)||!positiveInt(a.source_receipts)||!nonnegativeInt(a.positive)||!nonnegativeInt(a.zero)||!nonnegativeInt(a.negative)||a.lines<a.receipts||a.receipts<a.customers||a.receipts+a.excluded_receipts!==a.source_receipts||a.positive+a.zero+a.negative!==a.receipts||Number(a.net_cents)+Number(a.rounding_cents)+Number(a.tax_cents)!==a.tender_cents||a.matched_customers!==a.customers||a.customer_controls_verified!==a.customers)return false;
  const hashes=m.chunk_hashes,chunks=record(m.verified_chunks);
  if(!Array.isArray(hashes)||!hashes.length||hashes.length>1000||new Set(hashes).size!==hashes.length||Object.keys(chunks).length!==hashes.length)return false;
  const totals={lines:0,receipts:0,customers:0,net_cents:0};
  for(let i=0;i<hashes.length;i++){
    const c=record(chunks[String(i+1)]);
    if(!hash(hashes[i])||c.sha256!==hashes[i]||!positiveInt(c.lines)||!positiveInt(c.receipts)||!positiveInt(c.customers)||!int(c.net_cents)||c.lines<c.receipts||c.receipts<c.customers)return false;
    for(const key of Object.keys(totals) as (keyof typeof totals)[]){totals[key]+=Number(c[key]);if(!int(totals[key]))return false;}
  }
  return Object.entries(totals).every(([key,value])=>value===a[key]);
}
function usableSource(s:JournalSource,tenantId:string,timezone:string,cutoff:string) {
  const meta=record(s.reconciliation),applied=record(meta.applied),expected=record(meta.expected);
  return s.tenant_id===tenantId&&s.source==='ideal'&&
    !!s.source_period_start&&!!s.source_period_end&&validStamp(s.created_at)&&validStamp(s.completed_at)&&
    Date.parse(s.created_at)<=Date.parse(cutoff)&&Date.parse(s.completed_at)<=Date.parse(cutoff)&&
    meta.timezone===timezone&&positiveInt(applied.lines)&&applied.lines===expected.lines&&int(applied.net_cents)&&
    applied.net_cents===expected.net_cents&&expected.sha256===s.source_sha256&&hash(s.source_sha256)&&
    ((s.report_type==='journal'&&s.status==='completed')||verifiedPartial(s,cutoff));
}
/** Original source wall time uses the documented 2026 BC offset, independent
 * of a stale runtime tzdata November fallback. Other sources retain their
 * existing timezone interpretation. */
export function journalBusinessDay(timestamp:string,source:JournalSource,timezone:string):string|null{
  if(!validStamp(timestamp))return null;
  if(source.report_type==='journal_partial'&&timezone==='America/Vancouver'&&record(source.reconciliation).timestamp_rule===BC_2026_RULE){
    const time=Date.parse(timestamp);
    if(time>=Date.parse('2026-01-01T08:00:00Z')&&time<Date.parse('2027-01-01T07:00:00Z'))
      return new Date(time-(time<Date.parse('2026-03-08T10:00:00Z')?8:7)*3600000).toISOString().slice(0,10);
  }
  return localDate(timestamp,timezone);
}
function partialReceiptMatches(group:JournalLine[],source:JournalSource,net:number,timezone:string){
  if(source.report_type!=='journal_partial')return true;
  const first=record(group[0].raw_data),stamp=first.local_timestamp;
  if(typeof stamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[78]:00$/.test(stamp)||!validStamp(stamp)||Date.parse(stamp)!==Date.parse(group[0].purchased_at))return false;
  const offset=Date.parse(stamp)<Date.parse('2026-03-08T10:00:00Z')?'-08:00':'-07:00';
  if(!stamp.endsWith(offset)||stamp.slice(0,10)!==journalBusinessDay(stamp,source,timezone))return false;
  const keys=['receipt_net_cents','receipt_rounding_cents','receipt_tax_cents','receipt_tender_cents'];
  if(!keys.every(k=>int(first[k]))||first.receipt_net_cents!==net||Number(first.receipt_net_cents)+Number(first.receipt_rounding_cents)+Number(first.receipt_tax_cents)!==first.receipt_tender_cents||typeof first.receipt_source!=='string'||!/^S[1-9]:\d+:\d+$/.test(first.receipt_source))return false;
  return group.every(l=>{const r=record(l.raw_data);return r.coverage_mode==='reconciled_customer_cohort'&&r.local_timestamp===stamp&&r.receipt_source===first.receipt_source&&keys.every(k=>r[k]===first[k]);});
}
export function selectObservedJournalSource(sources:JournalSource[],tenantId:string,window:Window,timezone:string,cutoff:string) {
  dateWindow(window,cutoff,timezone);
  if(sources.some(s=>s.tenant_id!==tenantId))throw Error('Journal source company mismatch.');
  const eligible=sources.filter(s=>usableSource(s,tenantId,timezone,cutoff));
  const matching=eligible.filter(s=>s.source_period_start!<=window.start&&s.source_period_end!>=window.end);
  if(matching.length!==1)throw Error(matching.length?'Overlapping journal sources require reconciliation; no totals were combined.':'No completed dated IdealPOS journal covers '+window.start+' through '+window.end+'. Available journal source periods: '+(eligible.map(s=>s.source_period_start+' through '+s.source_period_end).join('; ')||'none')+'. Missing coverage is unknown, not zero.');
  return matching[0];
}
const add=(a:number,b:number)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error('Journal amount exceeds exact currency range.');return n;};
function quantityMilli(value:unknown):number|null {
  if(typeof value!=='number'&&typeof value!=='string')return null;
  const m=/^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(String(value));
  if(!m)return null;
  const result=Number(m[2])*1000+Number((m[3]??'').padEnd(3,'0'));
  return Number.isSafeInteger(result)?(m[1]?-result:result):null;
}
function featuredEvidence(group:JournalLine[],productCode:string|null,net:number){
  if(!productCode)return {featuredNetQuantityMilli:null,paidFeaturedPurchase:false};
  let quantity=0,positivePricedItem=false;
  for(const line of group){
    const kind=record(line.raw_data).kind;
    if(kind==='discount')continue;
    if(!['item','refund'].includes(String(kind))||!line.product_code)return {featuredNetQuantityMilli:null,paidFeaturedPurchase:false};
    if(line.product_code!==productCode)continue;
    const qty=quantityMilli(line.quantity),cents=moneyMinorUnits(line.net_amount);
    if(qty===null||cents===null||(kind==='item'&&qty<=0)||(kind==='refund'&&qty>=0))return {featuredNetQuantityMilli:null,paidFeaturedPurchase:false};
    quantity=add(quantity,qty);
    if(kind==='item'&&cents>0)positivePricedItem=true;
  }
  return {featuredNetQuantityMilli:quantity,paidFeaturedPurchase:net>0&&quantity>0&&positivePricedItem};
}
/** Read-only observed financial lines. Never certify coverage, fabricate POS orders, or classify absence as a lost customer. */
export function summarizeObservedJournal(lines:JournalLine[],customers:JournalCustomer[],source:JournalSource,tenantId:string,window:Window,currency:string,timezone:string,cutoff:string,capture?:{productCode:string|null}):ObservedJournalPeriod {
  dateWindow(window,cutoff,timezone);
  if(!usableSource(source,tenantId,timezone,cutoff)||source.source_period_start!>window.start||source.source_period_end!<window.end)throw Error('The journal source does not support this window.');
  if(!/^[A-Z]{3}$/.test(currency))throw Error('Choose a single currency.');
  const byId=new Map(customers.map(c=>[c.id,c]));
  if(byId.size!==customers.length||customers.some(c=>c.tenant_id!==tenantId))throw Error('Customer identity scope mismatch.');
  const seen=new Set<string>(),groups=new Map<string,JournalLine[]>();
  for(const line of lines){
    if(line.tenant_id!==tenantId||line.import_id!==source.id||line.source!=='ideal'||!line.id||seen.has(line.id)||!line.external_transaction_id)throw Error('Duplicate or out-of-scope journal line.');
    seen.add(line.id);const list=groups.get(line.external_transaction_id)??[];list.push(line);groups.set(line.external_transaction_id,list);
  }
  const activity=new Map<string,CustomerActivity>();
  const purchaseDays=new Map<string,Set<string>>();
  const receiptEvidence:JournalReceiptEvidence[]=[];
  const get=(c:JournalCustomer)=>{let item=activity.get(c.id);if(!item){item={id:c.id,name:[c.first_name,c.last_name].filter(Boolean).join(' ').trim()||'Unnamed customer',netMinor:0,positiveReceipts:0,positivePurchaseDays:0,validReceipts:0,invalidReceipts:0};activity.set(c.id,item);}return item;};
  let validReceipts=0,positiveReceipts=0,zeroReceipts=0,negativeReceipts=0,excludedReceipts=0;
  for(const group of groups.values()){
    const days=group.map(l=>journalBusinessDay(l.purchased_at,source,timezone));
    if(!days.some(day=>day!==null&&day>=window.start&&day<=window.end))continue;
    const ids=new Set(group.map(l=>l.customer_id)),first=group[0],customer=first.customer_id?byId.get(first.customer_id):undefined;
    const cents=group.map(l=>moneyMinorUnits(l.net_amount));
    const valid=!!customer&&ids.size===1&&!!customer.external_id&&group.every(l=>l.external_customer_code===customer.external_id&&l.currency===currency&&l.purchased_at===first.purchased_at&&validStamp(l.created_at)&&Date.parse(l.created_at)<=Date.parse(cutoff)&&!!l.external_line_id)&&new Set(group.map(l=>l.external_line_id)).size===group.length&&cents.every(n=>n!==null);
    const net=valid?cents.reduce<number>((total,n)=>add(total,n!),0):0;
    if(!valid||!partialReceiptMatches(group,source,net,timezone)){excludedReceipts++;for(const id of ids){const linked=id?byId.get(id):undefined;if(linked)get(linked).invalidReceipts++;}continue;}
    const row=get(customer!);
    row.netMinor=add(row.netMinor,net);row.validReceipts++;validReceipts++;
    if(capture)receiptEvidence.push({id:source.id+':'+first.external_transaction_id,customerId:row.id,timestamp:first.purchased_at,day:days[0]!,netMinor:net,...featuredEvidence(group,capture.productCode,net)});
    if(net>0){
      row.positiveReceipts++;positiveReceipts++;
      const day=days[0]!;
      const recorded=purchaseDays.get(row.id)??new Set<string>();
      recorded.add(day);purchaseDays.set(row.id,recorded);
      row.positivePurchaseDays=recorded.size;
    }else if(net===0)zeroReceipts++;else negativeReceipts++;
  }
  return {tenantId,window,currency,timezone,cutoff,source,customers:[...activity.values()],validReceipts,positiveReceipts,zeroReceipts,negativeReceipts,excludedReceipts,...(capture?{receiptEvidence}:{})};
}
export function compareObservedJournalPeriods(before:ObservedJournalPeriod,after:ObservedJournalPeriod,settings:GrowthSettings){
  const {baselineDays,currentDays}=validateGrowthSettings(settings);
  const same=(p:ObservedJournalPeriod,start:string,end:string)=>p.tenantId===before.tenantId&&p.currency===settings.currency&&p.timezone===settings.timezone&&p.cutoff===settings.data_cutoff&&p.window.start===start&&p.window.end===end;
  if(!same(before,settings.baseline_start,settings.baseline_end)||!same(after,settings.current_start,settings.current_end))throw Error('Journal periods or evidence cutoffs do not match the selected comparison.');
  const prior=new Map(before.customers.map(c=>[c.id,c])),current=new Map(after.customers.map(c=>[c.id,c]));
  const rows=[...new Set([...prior.keys(),...current.keys()])].map(id=>{
    const a=prior.get(id),b=current.get(id);
    const comparable=!!a&&!!b&&a.positiveReceipts>0&&b.positiveReceipts>0&&a.netMinor>0&&a.invalidReceipts===0&&b.invalidReceipts===0;
    const growth=(x:number,y:number)=>((y/(settings.per_day_rates?currentDays:1))/(x/(settings.per_day_rates?baselineDays:1))-1)*100;
    const change=comparable?(growth(a!.netMinor,b!.netMinor)*settings.spend_weight+growth(a!.positivePurchaseDays,b!.positivePurchaseDays)*settings.visits_weight)/(settings.spend_weight+settings.visits_weight):null;
    return {id,name:b?.name??a?.name??'Customer',baselineSpend:a?.validReceipts?a.netMinor:null,currentSpend:b?.validReceipts?b.netMinor:null,baselineReceipts:a?.validReceipts?a.positiveReceipts:null,currentReceipts:b?.validReceipts?b.positiveReceipts:null,baselinePurchaseDays:a?.validReceipts?a.positivePurchaseDays:null,currentPurchaseDays:b?.validReceipts?b.positivePurchaseDays:null,observedGrowth:change===null?null:Math.round(change*100)/100};
  }).sort((a,b)=>(a.observedGrowth??Infinity)-(b.observedGrowth??Infinity)||a.id.localeCompare(b.id));
  const comparable=rows.filter(r=>r.observedGrowth!==null);
  return {rows,comparable:comparable.length,unscored:rows.length-comparable.length,declining:comparable.filter(r=>r.observedGrowth!<0).length,baselineObservedBuyers:before.customers.filter(c=>c.positiveReceipts>0).length,currentObservedBuyers:after.customers.filter(c=>c.positiveReceipts>0).length};
}
/** Bind the reviewed audience to both source identities, settings and exact recorded
 * values. No names, email addresses or unstable read timestamps enter the digest. */
export async function observedDeclineReview(before:ObservedJournalPeriod,after:ObservedJournalPeriod,settings:GrowthSettings){
  const report=compareObservedJournalPeriods(before,after,settings);
  const selected=report.rows.filter(r=>r.observedGrowth!==null&&r.observedGrowth<0).sort((a,b)=>a.id.localeCompare(b.id));
  const memberIds=selected.map(r=>r.id);
  const source=(p:ObservedJournalPeriod)=>[p.source.id,p.source.source_sha256,p.source.completed_at,journalCoverage(p.source),record(p.source.reconciliation).cohort_control_sha256??null];
  const serialized=JSON.stringify([1,before.tenantId,source(before),source(after),settings.baseline_start,settings.baseline_end,settings.current_start,settings.current_end,settings.currency,settings.timezone,settings.spend_weight,settings.visits_weight,settings.per_day_rates===true,report.comparable,report.unscored,selected.map(r=>[r.id,r.baselineSpend,r.currentSpend,r.baselinePurchaseDays,r.currentPurchaseDays,r.observedGrowth])]);
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  return {digest,memberIds,comparable:report.comparable,unscored:report.unscored};
}
const fields='id,tenant_id,source,report_type,status,source_period_start,source_period_end,source_filename,source_sha256,created_at,completed_at,reconciliation';
export async function loadObservedJournalSources(client:PersistenceClient,tenantId:string,cutoff:string):Promise<JournalSource[]> {
  for(const permission of ['customer.read','reporting.read']){
    const {data,error}=await client.rpc('has_tenant_permission',{p_tenant_id:tenantId,p_permission:permission,p_location_id:null});
    if(error||data!==true)throw Error('Journal comparison requires company-wide customer and reporting access.');
  }
  const read=(type:string,status:string)=>readAllPages<JournalSource>((from,to)=>client.from('customer_intelligence_imports').select(fields).eq('tenant_id',tenantId).eq('source','ideal').eq('report_type',type).eq('status',status).lte('created_at',cutoff).lte('completed_at',cutoff).order('id').range(from,to));
  const [full,partial]=await Promise.all([read('journal','completed'),read('journal_partial','completed_with_errors')]);
  return [...full,...partial];
}
export async function loadObservedJournalPeriod(client:PersistenceClient,tenantId:string,window:Window,currency:string,timezone:string,cutoff:string,capture?:{productCode:string|null}):Promise<ObservedJournalPeriod>{
  const sources=await loadObservedJournalSources(client,tenantId,cutoff),source=selectObservedJournalSource(sources,tenantId,window,timezone,cutoff);
  // Date query discovers receipt keys only. Fetch each entire receipt from the exact import,
  // so a timestamp conflict cannot silently split the financial total at a window boundary.
  const lower=new Date(Date.parse(window.start+'T00:00:00Z')-86400000).toISOString();
  const upper=new Date(Date.parse(window.end+'T00:00:00Z')+2*86400000).toISOString();
  const candidates=await readAllPages<{external_transaction_id:string}>((from,to)=>client.from('customer_purchase_line_items').select('external_transaction_id').eq('tenant_id',tenantId).eq('import_id',source.id).eq('source','ideal').gte('purchased_at',lower).lt('purchased_at',upper).lte('created_at',cutoff).order('id').range(from,to),100000);
  const keys=[...new Set(candidates.map(r=>r.external_transaction_id))];
  if(keys.length>20000||keys.some(k=>typeof k!=='string'||!k))throw Error('The journal period is too large or contains invalid receipt keys. Choose a narrower period.');
  const lines:JournalLine[]=[];
  for(let i=0;i<keys.length;i+=100){
    const batch=keys.slice(i,i+100);
    const items=await readAllPages<JournalLine>((from,to)=>client.from('customer_purchase_line_items').select('id,tenant_id,import_id,source,customer_id,external_customer_code,external_transaction_id,external_line_id,purchased_at,created_at,currency,net_amount'+(capture?.productCode?',product_code,quantity':'')+(capture?.productCode||source.report_type==='journal_partial'?',raw_data':'')).eq('tenant_id',tenantId).eq('import_id',source.id).eq('source','ideal').in('external_transaction_id',batch).lte('created_at',cutoff).order('id').range(from,to),100000);
    if(items.some(l=>!batch.includes(l.external_transaction_id))||new Set(items.map(l=>l.external_transaction_id)).size!==batch.length)throw Error('Journal receipt evidence changed during the read. No partial totals were returned.');
    if(lines.length+items.length>100000)throw Error('Journal period exceeds the 100,000-line review limit. Choose a narrower period.');
    lines.push(...items);
  }
  const ids=[...new Set(lines.flatMap(l=>l.customer_id?[l.customer_id]:[]))],customers:JournalCustomer[]=[];
  for(let i=0;i<ids.length;i+=200){
    const batch=ids.slice(i,i+200);
    const {data,error}=await client.from('crm_customers').select('id,tenant_id,external_id,first_name,last_name').eq('tenant_id',tenantId).in('id',batch).is('deleted_at',null).is('merged_into_customer_id',null);
    if(error)throw Error(error.message);customers.push(...(data??[]) as JournalCustomer[]);
  }
  const after=selectObservedJournalSource(await loadObservedJournalSources(client,tenantId,cutoff),tenantId,window,timezone,cutoff);
  if(JSON.stringify(after)!==JSON.stringify(source))throw Error('The journal source changed during the comparison. Retry.');
  return summarizeObservedJournal(lines,customers,source,tenantId,window,currency,timezone,cutoff,capture);
}
