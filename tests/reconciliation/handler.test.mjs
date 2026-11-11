import test from 'node:test';
import assert from 'node:assert/strict';
let handler;
globalThis.Deno={env:{get:n=>({SUPABASE_SERVICE_ROLE_KEY:'secret',SUPABASE_URL:'https://db.example.com',STRIPE_SECRET_KEY:'sk_test',NOTION_TOKEN:'notion',NOTION_PIPELINE_DB_ID:'db',RESEND_API_KEY:'resend'})[n]},serve:h=>{handler=h}};
await import('../../supabase/functions/reconcile-stripe-notion/index.ts');
const request=()=>new Request('https://fn.example.com?dry_run=true',{headers:{apikey:'secret'}});
test('rejects unauthorized invocation',async()=>assert.equal((await handler(new Request('https://fn.example.com'))).status,401));
test('full dry run reads only and verifies paid active customer',async()=>{
 const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push([url,init.method||'GET']); let result;
 if(url.endsWith('/account'))result={id:'acct_test'};
 else if(url.includes('/subscriptions?'))result={data:[{id:'sub',status:'active',livemode:true,customer:{id:'cus_test',email:'a@example.com'}}],has_more:false};
 else if(url.includes('/databases/'))result={results:[{id:'page',properties:{'External ID':{rich_text:[{plain_text:'cus_test'}]},Stage:{select:{name:'Active'}}}}],has_more:false};
 else if(url.includes('stripe_notion_customer_links'))result=[];
 else if(url.includes('/invoices?'))result={data:[{id:'in',status:'paid',amount_paid:9900}],has_more:false};
 else throw Error('Unexpected write '+url);
 return Response.json(result);
 };
 const r=await handler(request());assert.equal(r.status,200);assert.deepEqual((await r.json()).issues,[]);
 assert.ok(calls.every(([url,method])=>method==='GET'||url.includes('/databases/')));
});
test('Notion rate limit aborts before queue changes or email',async()=>{
 let writes=0;
 globalThis.fetch=async(url,init)=>{
 if(url.endsWith('/account'))return Response.json({id:'acct_test'});
 if(url.includes('/subscriptions?'))return Response.json({data:[],has_more:false});
 if(url.includes('/databases/'))return new Response('rate limited',{status:429});
 writes++;throw Error('Unexpected call');};
 assert.equal((await handler(request())).status,500);assert.equal(writes,0);
});
