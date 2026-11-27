import {ContentFreshnessHold, emailContentSources, uniqueContentSources} from '../../supabase/functions/_shared/connectedContentFreshness.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {activeEmailCustomerIds,assertActiveEmailCustomers,prepareCustomerDelivery,confirmedDeliveryOutcome} from '../../supabase/functions/_shared/activeEmailCustomers.ts';
function db(rows,error=null){const calls=[];return {calls,from(table){assert.equal(table,'crm_customers');const q={select(s){calls.push(['select',s]);return q},eq(k,v){calls.push([k,v]);return q},in(k,ids){calls.push([k,ids]);return Promise.resolve({data:rows.filter(r=>ids.includes(r.id)),error})}};return q}}}
const row={id:'active',tenant_id:'tenant',deleted_at:null,merged_into_customer_id:null};
test('active only; deleted, merged, missing and cross-tenant customers excluded',async()=>{
 const d=db([row,{...row,id:'deleted',deleted_at:'date'},{...row,id:'merged',merged_into_customer_id:'other'},{...row,id:'foreign',tenant_id:'foreign'}]);
 assert.deepEqual([...await activeEmailCustomerIds(d,'tenant',['active','deleted','merged','missing','foreign'])],['active']);assert.ok(d.calls.some(c=>c[0]==='tenant_id'&&c[1]==='tenant'));
});
test('lookup failures and missing identity fail closed',async()=>{
 await assert.rejects(assertActiveEmailCustomers(db([row],{message:'down'}),[{tenant_id:'tenant',customer_id:'active'}]),/lookup failed/);
 await assert.rejects(assertActiveEmailCustomers(db([]),[{tenant_id:'tenant',customer_id:'missing'}]),/missing, deleted/);
 await assert.rejects(assertActiveEmailCustomers(db([row]),[{tenant_id:null,customer_id:'active'}]),/identity missing/);
});
test('fresh lookup blocks deletion or merge between enqueue and delivery/retry',async()=>{
 for(const change of [{deleted_at:'date'},{merged_into_customer_id:'survivor'}]){const current={...row};const d=db([current]);const ids=[{tenant_id:'tenant',customer_id:'active'}];await assertActiveEmailCustomers(d,ids);Object.assign(current,change);await assert.rejects(assertActiveEmailCustomers(d,ids),/deleted or merged/);}
});
test('unknown lifecycle columns are not treated as active and chunking is bounded',async()=>{
 assert.equal((await activeEmailCustomerIds(db([{id:'unknown',tenant_id:'tenant'}]),'tenant',['unknown'])).size,0);
 const rows=Array.from({length:401},(_,i)=>({...row,id:String(i)}));const d=db(rows);assert.equal((await activeEmailCustomerIds(d,'tenant',rows.map(r=>r.id))).size,401);assert.equal(d.calls.filter(c=>c[0]==='id').length,3);
});
test('latest watchdog replacement retains live-group guard and pre-breach logic',()=>{
 const files=readdirSync('supabase/migrations').sort();const latest=files.filter(f=>/CREATE OR REPLACE FUNCTION bloom_support.watchdog\(\)/i.test(readFileSync('supabase/migrations/'+f,'utf8'))).at(-1);const s=readFileSync('supabase/migrations/'+latest,'utf8');assert.match(s,/JOIN public.crm_segments live_s ON live_s.id = cs.segment_id AND live_s.deleted_at IS NULL/);assert.match(s,/approaching_deadline/);
});
test('campaign selection and each provider retry keep lifecycle guards',()=>{
 const enqueue=readFileSync('supabase/functions/send-email-campaign/index.ts','utf8');assert.match(enqueue,/is\("deleted_at", null\)\s*\.is\("merged_into_customer_id", null\)/);assert.match(enqueue,/resolveSegmentAudienceCustomerIds\(\s*supabase,\s*\{ tenantId: campaignTenantId, segmentIds \}/);
 const audience=readFileSync('supabase/functions/_shared/campaignSegmentAudience.ts','utf8');assert.match(audience,/crm_segments!inner/);assert.match(audience,/eq\("crm_segments.tenant_id", params.tenantId\)/);assert.match(audience,/is\("crm_segments.deleted_at", null\)/);
 const worker=readFileSync('supabase/functions/process-email-send-queue/index.ts','utf8');const batch=worker.slice(worker.indexOf('async function resendSendBatchRequest('),worker.indexOf('async function resendSendBatch('));assert.ok(batch.indexOf('beforeAttempt(payloads)')>batch.indexOf('for (let attempt'));assert.ok(batch.indexOf('beforeAttempt(payloads)')<batch.indexOf('await fetch('));assert.match(worker,/prepareCustomerDelivery\(supabase, identities, claimToken\)/);assert.match(worker,/customer_missing_deleted_or_merged/);
});

test('ambiguous accepted batch stays held when customer changes before retry; no reshaped send',async()=>{
 const customers=[{...row,id:'a'},{...row,id:'b'}];const held=new Set();let sends=0;
 const d=db(customers);const customerFrom=d.from;
 d.from=(table)=>{if(table==='crm_customers')return customerFrom(table);let ids=[];const q={update(){return q},in(_key,value){ids=value;return q},eq(){return q},is(){return q},select(){ids.forEach(id=>held.add(id));return Promise.resolve({data:ids.map(id=>({id})),error:null})}};return q};
 const messages=customers.map(c=>({id:'msg-'+c.id,customer_id:c.id,tenant_id:c.tenant_id}));
 await prepareCustomerDelivery(d,messages,'claim');sends++; // provider accepted, response500
 assert.equal(confirmedDeliveryOutcome({status:500}),false);
 customers[1].deleted_at='now';await assert.rejects(prepareCustomerDelivery(d,messages,'claim'),/deleted or merged/);
 assert.equal(messages.filter(m=>!held.has(m.id)).length,0);assert.equal(sends,1);
 for(const r of [{status:429},{status:422},{status:400},{resendId:'receipt'}]) assert.equal(confirmedDeliveryOutcome(r),true);
 for(const r of [{},{status:200},{status:503}]) assert.equal(confirmedDeliveryOutcome(r),false);
});

test('actual provider retry loop checks lifecycle again after ambiguous500 and makes no second send',async()=>{
 const {stripTypeScriptTypes}=await import('node:module');
 const source=readFileSync('supabase/functions/process-email-send-queue/index.ts','utf8');
 const fn=source.slice(source.indexOf('async function resendSendBatchRequest('),source.indexOf('async function resendSendBatch('));
 const current={...row};let calls=0,checks=0;
 const request= new Function('fetch','sha256Base64Url','sleep','truncateError','isRateLimitErrorMessage',stripTypeScriptTypes(fn)+'; return resendSendBatchRequest;')(
  async()=>{calls++;current.deleted_at='after accepted request';return Response.json({message:'unknown outcome'},{status:500})},async()=> 'stable-key',async()=>{},String,()=>false);
 const result=await request('test-only-key',[{to:'nobody@example.test'}],'stable',undefined,async()=>{checks++;await assertActiveEmailCustomers(db([current]),[{tenant_id:'tenant',customer_id:'active'}])});
 assert.equal(calls,1);assert.equal(checks,2);assert.match(result.error,/reconciliation/);assert.equal(confirmedDeliveryOutcome(result),false);
});

test('later429 or422 cannot clear or split an earlier ambiguous500 attempt',async()=>{
 const {stripTypeScriptTypes}=await import('node:module');const source=readFileSync('supabase/functions/process-email-send-queue/index.ts','utf8');const fn=source.slice(source.indexOf('async function resendSendBatchRequest('),source.indexOf('async function resendSendBatch('));
 for(const later of [429,422,400]){let calls=0;const request=new Function('fetch','sha256Base64Url','sleep','truncateError','isRateLimitErrorMessage',stripTypeScriptTypes(fn)+';return resendSendBatchRequest;')(async()=>Response.json({message:'validation'}, {status:++calls===1?500:later}),async()=> 'key',async()=>{},String,()=>false);const result=await request('test',[{}],'seed',undefined,async()=>{});assert.equal(calls,2);assert.equal(result.status,undefined);assert.equal(confirmedDeliveryOutcome(result),false);assert.match(result.error,/reconciliation/);}
});


test('source versions cannot change between enqueue and payload rendering',()=>{
 const original=[{itemId:'event',updatedAt:'v1'}];
 assert.deepEqual(emailContentSources(original,original),original);
 assert.deepEqual(emailContentSources(original,null),original);
 assert.throws(()=>emailContentSources(original,[{itemId:'event',updatedAt:'v2'}]),/source changed/);
 assert.throws(()=>emailContentSources(null,original),/no saved website version/);
 assert.throws(()=>emailContentSources(null,null),/could not be checked/);
 assert.deepEqual(emailContentSources(null,[]),[]);
});

test('content holds prevent first provider send but retain uncertain earlier attempts',async()=>{
 const {stripTypeScriptTypes}=await import('node:module');
 const source=readFileSync('supabase/functions/process-email-send-queue/index.ts','utf8');
 const fn=source.slice(source.indexOf('async function resendSendBatchRequest('),source.indexOf('async function resendSendBatch('));
 for(const decision of ['retry','review_required']) {
  for(const uncertain of [false,true]) {
   let calls=0,checks=0;
   const request=new Function('ContentFreshnessHold','fetch','sha256Base64Url','sleep','truncateError','isRateLimitErrorMessage',stripTypeScriptTypes(fn)+';return resendSendBatchRequest;')(
    ContentFreshnessHold,async()=>{calls++;return Response.json({message:'unknown outcome'},{status:500})},async()=> 'key',async()=>{},String,()=>false);
   const result=await request('test',[{}],'seed',undefined,async()=>{checks++;if(!uncertain||checks>1)throw new ContentFreshnessHold(decision,'changed');});
   assert.equal(calls,uncertain?1:0);
   assert.equal(result.status,uncertain?undefined:425);
   assert.match(result.error,uncertain?/reconciliation/:/^CONTENT_/);
  }
 }
});

test('a hundred recipients sharing a source count as one reference, without dropping malformed values',()=>{
 const reference={itemId:'event',updatedAt:'v1'};
 assert.deepEqual(uniqueContentSources(Array.from({length:100},()=>({...reference}))),[reference]);
 assert.deepEqual(uniqueContentSources([reference,null,null]),[reference,null]);
});
