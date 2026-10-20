require('./register-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const p=require('../../supabase/functions/_shared/lightspeed-storefront/provider.ts');
const {normalizeLightspeedProduct}=require('../../supabase/functions/_shared/lightspeed-storefront/normalize.ts');
const next='https://api.lightspeedapp.com/API/V3/Account/42/Item.json?sort=itemID&limit=100&after=WzEwMF0%3D';
test('R authorization has its own service and only read scope',()=>{
 const url=new URL(p.providerAuthorizationUrl('r-series',{clientId:'app',state:'s'.repeat(43),redirectUri:'https://bloomsuite.app/integrations/lightspeed/callback'}));
 assert.equal(url.origin,'https://cloud.lightspeedapp.com');assert.equal(url.pathname,'/auth/oauth/authorize');assert.equal(url.searchParams.get('scope'),'employee:inventory_read');
});
test('R pagination preserves provider cursor, handles singleton final page',async()=>{
 const calls=[];const responses=[{'@attributes':{next},Item:[{itemID:'1',description:'Plant'}]},{'@attributes':{next:''},Item:{itemID:'2',description:'Tree'}}];
 const fetcher=async(u,i)=>{calls.push([String(u),i]);return Response.json(responses.shift());};
 const a=await p.rSourcePage('42','products',null,'TOKEN',fetcher);assert.equal(a.complete,false);assert.equal(a.nextCursor,'r:'+next);
 const b=await p.rSourcePage('42','products',a.nextCursor,'TOKEN',fetcher);assert.equal(b.complete,true);assert.equal(b.data[0].id,'r:2');assert.equal(calls[1][0],next);
 assert.equal(calls[0][1].method,'GET');assert.equal(calls[0][1].redirect,'error');
});
test('R continuation cannot change account, resource, host or query',()=>{
 for(const bad of [next.replace('/42/','/43/'),next.replace('/Item.json','/Sale.json'),next.replace('api.lightspeedapp.com','evil.example'),next+'&load_relations=all',next+'&limit=100',next.replace('https:','http:')]) assert.throws(()=>p.rPageUrl('42','products','r:'+bad));
});
test('R empty and malformed pages are distinct',async()=>{
 const empty=await p.rSourcePage('42','products',null,'TOKEN',async()=>Response.json({'@attributes':{next:''}}));assert.equal(empty.complete,true);
 for(const value of [{},{Item:[]},{'@attributes':{next},Item:[]},{'@attributes':{next:''},Item:[null]}])await assert.rejects(()=>p.rSourcePage('42','products',null,'TOKEN',async()=>Response.json(value)));
});
test('R ignores aggregate stock and preserves separate shops',()=>{
 assert.equal(p.projectRRecord('inventory',{itemID:'1',shopID:'0',qoh:'99'}),null);
 assert.deepEqual(p.projectRRecord('inventory',{itemID:'1',shopID:'2',qoh:'3'}),{product_id:'r:1',outlet_id:'r:2',count:'3'});
 assert.equal(p.projectRRecord('outlets',{shopID:'2',name:'North',archived:'true'}).active,false);
});
test('R unknown prices remain review issues; names and SKUs survive without guessed tax',()=>{
 const raw=p.projectRRecord('products',{itemID:'1',description:'Rose',customSku:'001',itemType:'default',archived:'false',Prices:{ItemPrice:{amount:'50'}}});
 const result=normalizeLightspeedProduct(raw,{currency:'CAD',taxBasis:'exclusive'});
 assert.equal(result.sku,'001');assert.equal(result.priceMinor,null);assert.ok(result.issues.includes('invalid_price'));assert.equal(result.externalId,'r:1');
});
test('R token rotation validates expiry and never exposes upstream error bodies',async()=>{
 const base={prefix:'r-series',clientId:'app',clientSecret:'SECRET',redirectUri:'https://bloomsuite.app/integrations/lightspeed/callback',grant:{kind:'refresh_token',token:'OLD'}};
 let call;const result=await p.providerToken('r-series',{...base,fetcher:async(u,i)=>{call=[String(u),i];return Response.json({access_token:'NEW',refresh_token:'ROTATED',token_type:'Bearer',expires_in:1800});}});
 assert.equal(result.refreshToken,'ROTATED');assert.equal(call[0],'https://cloud.lightspeedapp.com/auth/oauth/token');assert.ok(!call[0].includes('SECRET'));assert.equal(new URLSearchParams(call[1].body).get('refresh_token'),'OLD');
 await assert.rejects(()=>p.providerToken('r-series',{...base,fetcher:async()=>new Response('SECRET',{status:401})}),e=>!e.message.includes('SECRET'));
});

test('R account discovery rejects ambiguous accounts and unknown currency',async()=>{
 await assert.rejects(()=>p.providerRetailer('r-series','r-series','TOKEN',async()=>Response.json({Account:[{accountID:'1'},{accountID:'2'}]})));
 let calls=0;await assert.rejects(()=>p.providerRetailer('r-series','r-series','TOKEN',async()=>Response.json(calls++===0?{Account:{accountID:'1'}}:{defaultCurrency:{code:'bad'}})));
});
