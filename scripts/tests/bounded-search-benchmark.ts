/** Synthetic localhost-only benchmark. Never point this at a hosted project. */
import {createHash,createHmac} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {PostgrestClient} from '@supabase/postgrest-js';
import {RECONCILED_LEGACY_SUMMARIES,type LegacySummaryCertificate} from '../../supabase/functions/_shared/customer-intelligence/legacy-summary-evidence.ts';
import {loadSummaryRows} from '../../supabase/functions/_shared/customer-intelligence/load-reported-evidence.ts';
import {readLiveCustomerIds} from '../../supabase/functions/_shared/customer-intelligence/bounded-search.ts';
import {loadProductSearchFacts} from '../../supabase/functions/_shared/customer-intelligence/load-product-search-facts.ts';
import type {PersistenceClient} from '../../supabase/functions/bloom-assist/types.ts';
const tenant='10000000-0000-0000-0000-000000000001';
const cutoff='2026-11-05T00:00:00Z';
const delay=Number(process.env.BENCH_RTT_MS??0);
const secret='synthetic-local-benchmark-only-not-a-production-secret';
function token(role:string,sub='20000000-0000-0000-0000-000000000001'){
 const body=[{alg:'HS256',typ:'JWT'},{role,sub,exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
 return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
let requests=0,bytes=0,maxMs=0;
const fetcher:typeof fetch=async(input,init)=>{
 const url=String(input);if(!url.startsWith('http://127.0.0.1:55440/'))throw Error('Local fixture only');
 const start=performance.now();if(delay)await new Promise(r=>setTimeout(r,delay));
 const response=await fetch(input,init);requests++;maxMs=Math.max(maxMs,performance.now()-start);
 bytes+=(await response.clone().arrayBuffer()).byteLength;return response;
};
function client(role:string,sub?:string){return new PostgrestClient('http://127.0.0.1:55440',{headers:{Authorization:'Bearer '+token(role,sub)},fetch:fetcher});}
const service=client('service_role'),auth=client('authenticated');
const store={
 async fingerprint(importId:string){const {data,error}=await service.rpc('customer_intelligence_summary_fingerprint',{p_tenant_id:tenant,p_import_id:importId});if(error)throw error;return data as string;},
 async get(importId:string){const {data,error}=await service.from('customer_intelligence_verified_summaries').select('fingerprint').eq('import_id',importId).eq('tenant_id',tenant).maybeSingle();if(error)throw error;return data?.fingerprint??null;},
 async set(importId:string,fingerprint:string){const {error}=await service.from('customer_intelligence_verified_summaries').upsert({import_id:importId,tenant_id:tenant,fingerprint,verified_at:new Date().toISOString()});if(error)throw error;},
};
// Optional synthetic certificate exercises the exact legacy verification branch.
if(process.env.BENCH_LEGACY==='1'){
 const parentResult=await service.from('customer_intelligence_imports').select('*').eq('source_filename','Synthetic 2026').single();
 if(parentResult.error)throw parentResult.error;const parent=parentResult.data;
 const rows=await loadSummaryRows(service as unknown as PersistenceClient,tenant,cutoff,parent.id);
 const entries:{row:number;value:string}[]=[];let cents=0;
 for(const event of rows){const raw=event.raw_data as {items:[string,string,string,number,number,number][]};for(const item of raw.items){const amount=Math.round(item[4]*100);cents+=amount;entries.push({row:item[5],value:[String(item[5]),event.external_customer_code,item[0],item[1],item[2],String(item[3]),String(amount)].join('\x1f')});}}
 entries.sort((a,b)=>a.row-b.row);
 (RECONCILED_LEGACY_SUMMARIES as LegacySummaryCertificate[]).push({tenantId:tenant,importId:parent.id,sourceSha256:parent.source_sha256,filename:parent.source_filename,start:parent.source_period_start,end:parent.source_period_end,customers:rows.length,items:entries.length,amountCents:cents,canonicalItemsSha256:createHash('sha256').update(entries.map(e=>e.value).join('\x1e')).digest('hex')});
}
// Real generation bump invalidates previously stored fingerprints. No production connection exists.
const imports=await service.from('customer_intelligence_imports').select('id');if(imports.error)throw imports.error;
const invalidation=await service.from('customer_intelligence_source_events').update({created_at:'2026-10-01T00:00:00Z'}).in('import_id',imports.data!.map(r=>r.id));if(invalidation.error)throw invalidation.error;
const results=[];
for(const scenario of ['invalidated','verified']){
 requests=0;bytes=0;maxMs=0;const start=performance.now();
 const ids=await readLiveCustomerIds(auth as unknown as PersistenceClient,tenant,cutoff);const populationMs=performance.now()-start,populationCalls=requests;
 const found=await loadProductSearchFacts(auth as unknown as PersistenceClient,tenant,cutoff,{mode:'purchased',product:'eucalyptus'},store);
 if(ids.length!==47934||!found||found.facts.length!==779)throw Error(`Wrong result ${ids.length}/${found?.facts.length}`);
 const result={scenario,synthetic:true,legacyCertificate:process.env.BENCH_LEGACY==='1',addedRoundTripMs:delay,populationMs,populationCalls,totalMs:performance.now()-start,requests,bytes,maxRequestMs:maxMs,customers:ids.length,facts:found.facts.length};results.push(result);console.log(JSON.stringify(result));
}
const staff=client('authenticated','20000000-0000-0000-0000-000000000002');
const staffIds=await readLiveCustomerIds(staff as unknown as PersistenceClient,tenant,cutoff);
const forbidden=await auth.from('crm_customers').select('id').eq('tenant_id','10000000-0000-0000-0000-000000000002');
if(staffIds.length!==23967||forbidden.error||forbidden.data?.length)throw Error('Permission/location result mismatch');
console.log(JSON.stringify({locationScopedCustomers:staffIds.length,crossTenantCustomers:forbidden.data.length}));
writeFileSync(`/tmp/eucalyptus-benchmark-${delay}.json`,JSON.stringify(results,null,2));
