import type {PeriodSummaryEvent, SummaryImport} from './period-summary.ts';
import {periodSummaryFacts} from './period-summary.ts';
import {moneyMinorUnits} from './customer-growth.ts';

export interface LegacySummaryCertificate {
 tenantId:string;importId:string;sourceSha256:string;filename:string;start:string;end:string;
 customers:number;items:number;amountCents:number;canonicalItemsSha256:string;
}
// Read-only compatibility for the original, reconciled October 16 format.
// The original bytes and every stored customer/product/source-row value were
// independently reconciled on October 22. This is not a fabricated row hash.
// No other ledger, tenant or hash is eligible for missing-hash compatibility.
export const RECONCILED_LEGACY_SUMMARIES: readonly LegacySummaryCertificate[] = [{
 tenantId:'c190325a-5da0-49f6-b374-187464762021',importId:'e9c23c47-18fa-5572-8d51-1daae3fcf0e1',
 sourceSha256:'2debeacf30102ad170f10a47702f9c64285c174ad758194e3a9f00eef3bca2cb',
 filename:'Customer Sales YTD-20261014141438.csv',start:'2026-01-01',end:'2026-10-14',
 customers:12836,items:112452,amountCents:265464944,
 canonicalItemsSha256:'7797f2b4de907cc2118526415ec719d19b8d0fc532614b086f6a1a4e95507679',
}];
export function legacySummaryCertificate(source:SummaryImport & {tenant_id:string;source_filename?:string|null}){
 return RECONCILED_LEGACY_SUMMARIES.find(c=>c.tenantId===source.tenant_id&&c.importId===source.id&&c.sourceSha256===source.source_sha256&&c.filename===source.source_filename&&c.start===source.source_period_start&&c.end===source.source_period_end&&source.source==='ideal');
}
/** Verify the complete snapshot before any filtering or total is returned. */
export async function verifyLegacySummarySnapshot(rows:(PeriodSummaryEvent & {external_customer_code?:string})[],certificate:LegacySummaryCertificate,identities:readonly {id:string;tenant_id:string;external_id:string|null}[]){
 const identityById=new Map<string,string>();const identityCodeCounts=new Map<string,number>();
 for(const identity of identities){if(identity.tenant_id!==certificate.tenantId||identityById.has(identity.id))throw Error('Legacy customer identity scope differs.');if(identity.external_id!==null){identityById.set(identity.id,identity.external_id);identityCodeCounts.set(identity.external_id,(identityCodeCounts.get(identity.external_id)??0)+1);}}
 const entries:{row:number;value:string}[]=[];const customers=new Set<string>(),codes=new Set<string>(),positions=new Set<number>();let amount=0;
 if(rows.length!==certificate.customers)throw Error('Legacy source is incomplete; no partial total was returned.');
 for(const event of rows){
  const raw=event.raw_data as Record<string,unknown>|null;
  if(event.tenant_id!==certificate.tenantId||event.import_id!==certificate.importId||event.source!=='ideal'||!event.customer_id||!event.external_customer_code||identityById.get(event.customer_id)!==event.external_customer_code||identityCodeCounts.get(event.external_customer_code)!==1||customers.has(event.customer_id)||codes.has(event.external_customer_code)||!raw||Object.hasOwn(raw,'source_sha256')||raw.source_filename!==certificate.filename||raw.period_start!==certificate.start||raw.period_end!==certificate.end||raw.currency!=='CAD'||raw.dated_transactions!==false||JSON.stringify(raw.columns)!==JSON.stringify(['product_code','product_name','department','quantity','net_amount','source_row']))throw Error('Legacy source scope or schema differs from its reconciliation.');
  customers.add(event.customer_id);codes.add(event.external_customer_code);
  periodSummaryFacts([event],certificate.tenantId); // Full shape/date validation.
  for(const item of raw.items as [string,string,string,number,number,number][]){
   const cents=moneyMinorUnits(item[4]);if(cents===null||item[5]<1||positions.has(item[5]))throw Error('Legacy source values or row identities changed.');
   positions.add(item[5]);amount+=cents;if(!Number.isSafeInteger(amount))throw Error('Legacy source total exceeds exact arithmetic.');
   const parts=[String(item[5]),event.external_customer_code,item[0],item[1],item[2],String(item[3]),String(cents)];
   if(parts.some(value=>/[\x1e\x1f]/.test(value)))throw Error('Legacy source contains ambiguous separators.');
   entries.push({row:item[5],value:parts.join('\x1f')});
  }
 }
 if(entries.length!==certificate.items||amount!==certificate.amountCents)throw Error('Legacy source totals differ from reconciliation.');
 entries.sort((a,b)=>a.row-b.row);
 const bytes=new TextEncoder().encode(entries.map(entry=>entry.value).join('\x1e'));
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(digest!==certificate.canonicalItemsSha256)throw Error('Legacy source content differs from the reconciled original.');
}
