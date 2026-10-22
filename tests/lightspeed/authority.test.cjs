require('./register-typescript.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLightspeedAuthority,AUTHORITY_CALLBACK}=require('../../supabase/functions/_shared/lightspeed-storefront/authority.ts');
const protocol=require('../../supabase/functions/_shared/lightspeed-storefront/bridge-protocol.ts');
const NOW=Date.parse('2026-10-09T12:00:00Z');
const SITE='ecee4ff0-2534-491f-98b2-3b63a0639f43';
const scopes='products:read inventory:read outlets:read retailer:read payment_types:read';
const copy=x=>x==null?x:structuredClone(x);
async function fixture(options={}){
  const keys=await protocol.createSigningKeyPair();
  const state='bs_'+protocol.randomProofToken();const stateHash=await protocol.sha256(state);
  const grants=new Map(),nonces=new Set(),calls=[];
  let tokenCalls=0;let now=NOW;
  const repo={
    async create(context){let row=[...grants.values()].find(x=>x.stateHash===context.stateHash);if(!row){row={...context,id:crypto.randomUUID(),status:'pending',version:1,
      codeHash:null,tokenCiphertext:null,receiptCiphertext:null,receiptHash:null,retailerId:null,currency:null,tokenExpiresAt:null,leaseId:null,leaseExpiresAt:null};grants.set(row.id,row);}return copy(row);},
    async get(id){return copy(grants.get(id)??null);},
    async findByState(hash){return copy([...grants.values()].find(x=>x.stateHash===hash)??null);},
    async compareAndSwap(grant,patch){const current=grants.get(grant.id);if(!current||current.version!==grant.version||current.status!==grant.status)return null;
      const next={...current,...patch,version:current.version+1};grants.set(next.id,next);return copy(next);},
    async consumeNonce(id,hash){const key=id+':'+hash;if(nonces.has(key))return false;nonces.add(key);return true;},
  };
  const fetcher=async(url,init)=>{
    const u=new URL(url);calls.push({url:u.toString(),init});
    if(u.origin===protocol.BLOOMSITES_ORIGIN){assert.equal(u.pathname,protocol.LIGHTSPEED_SITE_CONTEXT_PATH);
      return Response.json({siteId:SITE,prefix:options.edition==='r-series'?'r-series':'scotts-test',edition:options.edition,publicKey:keys.publicKey,stateHash,
        expiresAt:new Date(now+600000).toISOString(),...(options.context??{})});}
    if(options.edition==='r-series') {
      if(u.origin==='https://cloud.lightspeedapp.com') {
        assert.equal(u.pathname,'/auth/oauth/token');tokenCalls++;
        if(options.tokenFailure)throw new Error('SECRET');
        return Response.json({access_token:'SECRET_ACCESS_'+tokenCalls,refresh_token:'SECRET_REFRESH_'+tokenCalls,token_type:'Bearer',expires_in:3600});
      }
      assert.equal(u.origin,'https://api.lightspeedapp.com');
      if(u.pathname==='/API/V3/Account.json')return Response.json({Account:{accountID:'42'}});
      if(u.pathname==='/API/V3/Account/42.json')return Response.json({defaultCurrency:{code:'CAD'}});
      if(options.readStatus)return new Response('SECRET',{status:options.readStatus});
      assert.equal(u.pathname,'/API/V3/Account/42/Item.json');
      return Response.json({'@attributes':{next:''},Item:[{itemID:'1',description:'Plant',archived:'false',itemType:'default',systemSku:'001'}]});
    }
    assert.equal(u.origin,'https://scotts-test.retail.lightspeed.app');
    assert.equal(init.redirect,'error');
    if(u.pathname==='/api/1.0/token'){tokenCalls++;
      if(options.tokenDelay)await new Promise(r=>setTimeout(r,options.tokenDelay));
      if(options.tokenFailure)throw new Error('SECRET provider token transport details');
      return Response.json({access_token:'SECRET_ACCESS_'+tokenCalls,refresh_token:'SECRET_REFRESH_'+tokenCalls,
        token_type:'Bearer',expires:now/1000+3600,domain_prefix:'scotts-test',scope:scopes,...(options.tokens??{})});}
    if(u.pathname==='/api/2.0/retailer')return Response.json({data:{id:'retailer-uuid',currency:'CAD',...(options.retailer??{})}});
    if(options.readStatus)return new Response('SECRET upstream details',{status:options.readStatus,headers:{'Retry-After':'17'}});
    return Response.json({data:[],version:{max:1}});
  };
  const encryption={async encrypt(v){return 'sealed:'+Buffer.from(v).toString('base64');},async decrypt(v){assert.ok(v.startsWith('sealed:'));return Buffer.from(v.slice(7),'base64').toString();}};
  const deps={repository:repo,encryption,credentials:()=>({clientId:'known-app',clientSecret:'SECRET_CLIENT'}),fetcher,now:()=>now};
  const handler=createLightspeedAuthority(deps);
  const request=async(body,headers={})=>handler(new Request('https://authority.example',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
  const signed=async(body,nonce)=>{const text=JSON.stringify(body);return request(body,await protocol.signBridgeRequest({grantId:body.grantId,privateKey:keys.privateKey,body:text,now,nonce}));};
  const start=()=>request({action:'start',state});
  const callback=()=>request({action:'callback',state,code:'valid-code-12345'});
  const activate=async()=>{assert.equal((await start()).status,200);const response=await callback();assert.equal(response.status,200);
    const payload=await response.json();const url=new URL(payload.returnUrl);const grantId=url.searchParams.get('grant'),receipt=url.searchParams.get('receipt');
    const final=await signed({action:'finalize',grantId,receipt});assert.equal(final.status,200);return {grantId,receipt};};
  return {keys,state,stateHash,grants,nonces,calls,repo,deps,handler,request,signed,start,callback,activate,get tokenCalls(){return tokenCalls;},setNow(v){now=v;}};
}
test('existing registered callback is reused and scopes stay read-only',async()=>{
  const f=await fixture();const r=await f.start();assert.equal(r.status,200);const body=await r.json();const url=new URL(body.authorizationUrl);
  assert.equal(url.searchParams.get('redirect_uri'),AUTHORITY_CALLBACK);assert.equal(url.searchParams.get('state'),f.state);
  assert.equal(url.searchParams.get('scope'),scopes);assert.equal(JSON.stringify(body).includes('SECRET'),false);
});
test('start trusts only fixed CMS state context, not supplied tenant or public key',async()=>{
  const f=await fixture();const r=await f.request({action:'start',state:f.state,siteId:crypto.randomUUID(),prefix:'attacker',publicKey:{d:'private'}});
  assert.equal(r.status,200);const grant=[...f.grants.values()][0];assert.equal(grant.siteId,SITE);assert.equal(grant.prefix,'scotts-test');assert.ok(!('d' in grant.publicKey));
});
test('missing developer configuration fails before contacting a retailer',async()=>{
  const f=await fixture();f.deps.credentials=()=>({clientId:'',clientSecret:''});const r=await f.start();assert.equal(r.status,503);assert.equal(f.calls.length,1);assert.equal(new URL(f.calls[0].url).origin,protocol.BLOOMSITES_ORIGIN);
});
test('unknown or malformed state does not create a grant',async()=>{
  const f=await fixture();const r=await f.request({action:'start',state:'guess'});assert.equal(r.status,400);assert.equal(f.grants.size,0);
});
test('CMS context with mismatched hash is rejected',async()=>{
  const f=await fixture({context:{stateHash:'invalid'}});assert.equal((await f.start()).status,410);assert.equal(f.grants.size,0);
});
test('CMS context cannot smuggle a private signing key',async()=>{
  const f=await fixture({context:{publicKey:{kty:'EC',crv:'P-256',d:'bad'}}});assert.equal((await f.start()).status,400);
});
test('callback accepts standard code/state without a retailer prefix',async()=>{
  const f=await fixture();await f.start();const r=await f.request({action:'callback',state:f.state,code:'valid-code-12345'});
  assert.equal(r.status,200);assert.equal(f.tokenCalls,1);
  assert.ok(f.calls.every(call=>!call.url.includes('other-store')));
});
test('explicitly conflicting retailer prefix fails before token exchange',async()=>{
  const f=await fixture();await f.start();
  const r=await f.request({action:'callback',state:f.state,code:'valid-code-12345',domainPrefix:'other-store'});
  assert.equal(r.status,409);assert.equal(f.tokenCalls,0);
});
test('callback exchanges a code once, encrypts credentials and returns no token',async()=>{
  const f=await fixture();await f.start();const r=await f.callback();assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('SECRET'));
  const grant=[...f.grants.values()][0];assert.equal(grant.status,'authorized');assert.ok(grant.tokenCiphertext.startsWith('sealed:'));
  const again=await f.callback();assert.equal(again.status,200);assert.equal(f.tokenCalls,1);
});
test('two callbacks cannot exchange the same code concurrently',async()=>{
  const f=await fixture({tokenDelay:15});await f.start();const results=await Promise.all([f.callback(),f.callback()]);
  assert.equal(f.tokenCalls,1);assert.equal(results.filter(x=>x.status===200).length,1);
});
test('missing required scope prevents activation rather than claiming connected',async()=>{
  const f=await fixture({tokens:{scope:'products:read'}});await f.start();assert.equal((await f.callback()).status,403);
  const grant=[...f.grants.values()][0];assert.equal(grant.status,'reconnect_required');assert.equal(grant.tokenCiphertext,null);
});
test('retailer identity also needs payment-types read permission, without payment writes',async()=>{
  const f=await fixture({tokens:{scope:'products:read inventory:read outlets:read retailer:read'}});await f.start();
  assert.equal((await f.callback()).status,403);assert.equal(f.grants.values().next().value.tokenCiphertext,null);
  assert.ok(!scopes.includes(':write'));
});
test('retailer currency is required, never defaulted to USD',async()=>{
  const f=await fixture({retailer:{currency:null}});await f.start();assert.equal((await f.callback()).status,409);
});
test('uncertain code exchange is not replayed',async()=>{
  const f=await fixture({tokenFailure:true});await f.start();await f.callback();await f.callback();assert.equal(f.tokenCalls,1);
});
test('unsigned finalize and read calls fail even with a valid grant id',async()=>{
  const f=await fixture();const {grantId,receipt}=await f.activate();
  assert.equal((await f.request({action:'finalize',grantId,receipt})).status,403);
  assert.equal((await f.request({action:'read',grantId,resource:'products'})).status,403);
});
test('one-time proof nonce blocks exact signed request replay',async()=>{
  const f=await fixture();const {grantId}=await f.activate();const body={action:'read',grantId,resource:'products',cursor:null};const nonce=protocol.randomProofToken();
  assert.equal((await f.signed(body,nonce)).status,200);assert.equal((await f.signed(body,nonce)).status,409);
});
test('proof from another site key cannot use this grant',async()=>{
  const f=await fixture();const {grantId}=await f.activate();const other=await protocol.createSigningKeyPair();const body={action:'read',grantId,resource:'products'};
  const headers=await protocol.signBridgeRequest({grantId,privateKey:other.privateKey,body:JSON.stringify(body),now:NOW});
  assert.equal((await f.request(body,headers)).status,403);
});
test('read-only resource allowlist rejects sales writes and customer data',async()=>{
  const f=await fixture();const {grantId}=await f.activate();const before=f.calls.length;
  for(const resource of ['sales','customers','../token','https://evil.test'])assert.equal((await f.signed({action:'read',grantId,resource})).status,400);
  assert.equal(f.calls.length,before);
});
test('active token is reused without unnecessary refreshing',async()=>{
  const f=await fixture();const {grantId}=await f.activate();await f.signed({action:'read',grantId,resource:'inventory',cursor:'9007199254740993'});
  assert.equal(f.tokenCalls,1);assert.ok(f.calls.at(-1).url.includes('after=9007199254740993'));
});
test('expired token refresh uses a single lease and persists rotated pair',async()=>{
  const f=await fixture({tokenDelay:15});const {grantId}=await f.activate();f.setNow(NOW+3600001);
  const responses=await Promise.all([f.signed({action:'read',grantId,resource:'products'}),f.signed({action:'read',grantId,resource:'products'})]);
  assert.equal(f.tokenCalls,2);assert.ok(responses.some(x=>x.status===200));assert.equal(f.grants.get(grantId).status,'active');
});
test('expired refresh lease fails closed without replaying refresh token',async()=>{
  const f=await fixture();const {grantId}=await f.activate();Object.assign(f.grants.get(grantId),{status:'refreshing',leaseExpiresAt:new Date(NOW-1).toISOString()});
  assert.equal((await f.signed({action:'read',grantId,resource:'products'})).status,409);assert.equal(f.tokenCalls,1);
  assert.equal(f.grants.get(grantId).status,'reconnect_required');
});
test('provider throttling preserves Retry-After and does not leak upstream text',async()=>{
  const f=await fixture({readStatus:429});const {grantId}=await f.activate();const r=await f.signed({action:'read',grantId,resource:'products'});
  assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'17');assert.ok(!(await r.text()).includes('SECRET'));
});
test('provider 401 requires reconnect and does not guess alternative endpoints',async()=>{
  const f=await fixture({readStatus:401});const {grantId}=await f.activate();assert.equal((await f.signed({action:'read',grantId,resource:'products'})).status,401);
  assert.equal(f.grants.get(grantId).status,'reconnect_required');assert.equal(f.tokenCalls,1);
});
test('disconnect destroys bridge-held credentials and rejects later reads',async()=>{
  const f=await fixture();const {grantId}=await f.activate();const r=await f.signed({action:'disconnect',grantId});assert.equal(r.status,200);
  assert.equal(f.grants.get(grantId).tokenCiphertext,null);assert.equal((await f.signed({action:'read',grantId,resource:'products'})).status,409);
});
test('oversized request is rejected before storage or vendor access',async()=>{
  const f=await fixture();assert.equal((await f.request({action:'start',state:f.state,padding:'x'.repeat(17000)})).status,413);assert.equal(f.calls.length,0);
});
test('wrong methods and non-JSON content are refused',async()=>{
  const f=await fixture();assert.equal((await f.handler(new Request('https://authority.example'))).status,405);
  assert.equal((await f.handler(new Request('https://authority.example',{method:'POST',body:'action=start'}))).status,415);
});

for(const edition of ['x-series','r-series']) {
 test(edition+' state binds edition, callback and credential selector; signed reads refresh and disconnect',async()=>{
  const f=await fixture({edition});const selected=[];f.deps.credentials=e=>{selected.push(e);return {clientId:'app',clientSecret:'SECRET'};};
  const {grantId}=await f.activate();assert.ok(selected.every(e=>e===edition));
  const grant=f.grants.get(grantId);assert.equal(grant.edition,edition);assert.equal(grant.status,'active');
  f.setNow(NOW+3600001);
  const response=await f.signed({action:'read',grantId,resource:'products',cursor:null});assert.equal(response.status,200);
  const body=await response.json();assert.ok(!JSON.stringify(body).includes('SECRET'));assert.equal(f.tokenCalls,2);
  if(edition==='r-series'){assert.equal(body.payload.data[0].id,'r:1');assert.equal(body.payload.complete,true);}
  assert.equal((await f.signed({action:'disconnect',grantId})).status,200);assert.equal(f.grants.get(grantId).tokenCiphertext,null);
  assert.notEqual((await f.signed({action:'read',grantId,resource:'products'})).status,200);
 });
}
test('R-Series missing credentials fail closed without falling back to X-Series',async()=>{
 const f=await fixture({edition:'r-series'});f.deps.credentials=e=>e==='r-series'?{clientId:'',clientSecret:''}:{clientId:'x',clientSecret:'SECRET'};
 assert.equal((await f.start()).status,503);assert.equal(f.tokenCalls,0);
 const ready=await (await f.request({action:'readiness'})).json();assert.deepEqual(ready.editions,{'x-series':true,'r-series':false});
});
test('R-Series read rejects another account continuation before credential transmission',async()=>{
 const f=await fixture({edition:'r-series'});const {grantId}=await f.activate();const count=f.calls.length;
 assert.equal((await f.signed({action:'read',grantId,resource:'products',cursor:'r:https://api.lightspeedapp.com/API/V3/Account/99/Item.json?limit=100&sort=itemID&after=abc'})).status,400);
 assert.equal(f.calls.length,count);
});

test('R-Series expired refresh failure destroys credentials and requires reauthorization',async()=>{
 const options={edition:'r-series'};const f=await fixture(options);const {grantId}=await f.activate();
 options.tokenFailure=true;f.setNow(NOW+3600001);
 assert.notEqual((await f.signed({action:'read',grantId,resource:'products'})).status,200);
 assert.equal(f.grants.get(grantId).status,'reconnect_required');assert.equal(f.grants.get(grantId).tokenCiphertext,null);
});
test('R-Series 429 pauses safely and 401 invalidates the grant',async()=>{
 for(const status of [429,401]){const f=await fixture({edition:'r-series',readStatus:status});const {grantId}=await f.activate();
 const response=await f.signed({action:'read',grantId,resource:'products'});assert.equal(response.status,status);
 assert.ok(!(await response.text()).includes('SECRET'));assert.equal(f.grants.get(grantId).status,status===401?'reconnect_required':'active');}
});

test('X-Series documented currency object authorizes and finalizes as CAD',async()=>{
  const f=await fixture({retailer:{currency:{code:'CAD',symbol:'$'}}});
  const {grantId}=await f.activate();
  assert.equal(f.grants.get(grantId).currency,'CAD');
  assert.equal(f.grants.get(grantId).status,'active');
});
test('malformed currency objects still fail closed',async()=>{
  for(const currency of [{symbol:'$'},{code:''},{code:'CAD<script>'},{code:123},null]){
    const f=await fixture({retailer:{currency}});await f.start();
    const response=await f.callback();assert.equal(response.status,409);
    assert.equal([...f.grants.values()][0].status,'reconnect_required');
  }
});
