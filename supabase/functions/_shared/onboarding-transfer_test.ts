import {onboardingExporter,transferSignature,onboardingReader,configuredConnections} from './onboarding-transfer.ts';
function assert(value:unknown,message='Assertion failed'):asserts value {if(!value)throw Error(message);}
const secret='s'.repeat(32),now=Date.parse('2026-10-11T09:00:00Z'),timestamp=String(now/1000);
const binding={tenantId:'tenant',accountId:'account',secret};
const body={version:1,action:'preview-onboarding',tenantId:'tenant',accountId:'account'};
async function request(value:unknown=body,key=secret,stamp=timestamp){const raw=JSON.stringify(value);return new Request('https://source.test',{method:'POST',headers:{'x-bloom-key-id':'key','x-bloom-timestamp':stamp,'x-bloom-signature':await transferSignature(key,stamp,raw)},body:raw});}
Deno.test('only a correctly signed request for the bound business can read a snapshot',async()=>{
 let reads=0;const handle=onboardingExporter({binding:async()=>binding,snapshot:async()=>{reads++;return {ok:true};},now:()=>now});
 for(const req of [await request(body,'x'.repeat(32)),await request(body,secret,String(now/1000-301)),await request({...body,tenantId:'other'}),await request({...body,accountId:'other'}),await request({...body,action:'apply'})])assert((await handle(req)).status>=400);
 assert(reads===0);assert((await handle(await request())).status===200);assert(Number(reads)===1);
});
Deno.test('an unapproved connection cannot export and unsupported methods cannot mutate',async()=>{
 let reads=0;const handle=onboardingExporter({binding:async()=>null,snapshot:async()=>{reads++;},now:()=>now});
 assert((await handle(await request())).status===401);assert((await handle(new Request('https://source.test',{method:'DELETE'}))).status===405);assert(reads===0);
});
Deno.test('oversized request bodies are refused before reading the source',async()=>{
 let reads=0;const handle=onboardingExporter({binding:async()=>binding,snapshot:async()=>{reads++;},now:()=>now});
 assert((await handle(await request({...body,padding:'x'.repeat(5000)}))).status>=400);assert(reads===0);
});
Deno.test('the reader cannot choose a caller-provided network destination or another tenant',async()=>{
 const c={...binding,id:'one',storeId:'store',label:'Business',source:'CRM' as const,keyId:'key',url:'https://abcdefghijklmnopqrst.supabase.co/functions/v1/pos-onboarding-export'};
 let calls=0;const handle=onboardingReader({authorize:async()=>({tenantId:'other',stores:[{id:'store',name:'Store',currency:'CAD'}]}),connections:()=>[c],fetch:async()=>{calls++;return Response.json({});}});
 assert((await handle(new Request('https://pos.test',{method:'POST',body:JSON.stringify({action:'preview',connectionId:'one',url:'http://localhost'})}))).status===404);assert(calls===0);
 for(const url of ['http://localhost','https://evil.test',c.url+'?other=1']){let failed=false;try{configuredConnections(JSON.stringify([{...c,url}]))}catch{failed=true;}assert(failed);}
});
