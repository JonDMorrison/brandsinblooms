require('./register-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {LightspeedReadClient,normalizeStorePrefix,buildLightspeedAuthorizationUrl,
  exchangeLightspeedToken,parseRetryAfter,lightspeedRequest}=require('../../supabase/functions/_shared/lightspeed-storefront/client.ts');
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
const capture=(response)=>{const calls=[];const fetcher=async(url,init)=>{calls.push({url:String(url),init});return typeof response==='function'?response():response};return{calls,fetcher}};

test('normalizes prefixes but rejects foreign hosts, paths and credential injection',()=>{
  assert.equal(normalizeStorePrefix(' Example-Store '),'example-store');
  for(const p of ['x','localhost/abc','example.org','foo@host','-bad','bad-','a\nb','https://host'])assert.throws(()=>normalizeStorePrefix(p));
});
test('requests only the fixed merchant origin, with bearer in a header and no redirects',async()=>{
  const x=capture(json({data:[],version:{max:1}}));await new LightspeedReadClient('example-store','secret',x.fetcher).page('products',null);
  assert.equal(new URL(x.calls[0].url).origin,'https://example-store.retail.lightspeed.app');
  assert.equal(new URL(x.calls[0].url).pathname,'/api/2.0/products');assert.ok(!x.calls[0].url.includes('secret'));
  assert.equal(x.calls[0].init.headers.Authorization,'Bearer secret');assert.equal(x.calls[0].init.redirect,'error');
});
test('inventory has its own endpoint, not embedded product values',async()=>{
  const x=capture(json({data:[],version:{max:1}}));await new LightspeedReadClient('example-store','secret',x.fetcher).page('inventory',null);
  assert.equal(new URL(x.calls[0].url).pathname,'/api/2.0/inventory');
});
test('short pages are not mistaken for end-of-catalogue',async()=>{
  const x=capture(json({data:[{id:'p'}],version:{max:'9007199254740993'}}));
  const result=await new LightspeedReadClient('example-store','secret',x.fetcher).page('products',null);
  assert.equal(result.complete,false);assert.equal(result.nextCursor,'9007199254740993');
});
test('end only follows an empty page',async()=>{
  const x=capture(json({data:[],version:{max:99}}));
  assert.equal((await new LightspeedReadClient('example-store','secret',x.fetcher).page('products','99')).complete,true);
});
test('rejects non-advancing and unsafe version cursors',async()=>{
  for(const max of ['10',null,9007199254740992]) {
    const x=capture(json({data:[{id:'p'}],version:{max}}));
    await assert.rejects(()=>new LightspeedReadClient('example-store','secret',x.fetcher).page('products','10'));
  }
});
test('malformed responses are failures, never empty successful catalogues',async()=>{
  for(const body of [{}, {data:null}, {data:{}}, {data:[null],version:{max:1}}]) {
    const x=capture(json(body));await assert.rejects(()=>new LightspeedReadClient('example-store','secret',x.fetcher).page('products',null));
  }
});
test('rejects undocumented resources at runtime',async()=>{
  const x=capture(json({data:[]}));await assert.rejects(()=>new LightspeedReadClient('example-store','secret',x.fetcher).page('../payments',null));assert.equal(x.calls.length,0);
});
test('upstream errors are redacted; 429 exposes a bounded retry delay',async()=>{
  for(const [status,code] of [[401,'unauthorized'],[403,'insufficient_scope'],[429,'rate_limited'],[500,'upstream_unavailable']]) {
    const x=capture(json({error:'do-not-leak-secret'},status,{'retry-after':'12'}));
    await assert.rejects(()=>new LightspeedReadClient('example-store','secret',x.fetcher).page('products',null),e=>{
      assert.equal(e.code,code);assert.ok(!e.message.includes('do-not-leak'));
      if(status===429)assert.equal(e.retryAfterMs,12000);return true;
    });assert.equal(x.calls.length,1);
  }
});
test('rejects HTML responses',async()=>{
  const x=capture(new Response('<html>sign in</html>',{headers:{'Content-Type':'text/html'}}));
  await assert.rejects(()=>new LightspeedReadClient('example-store','secret',x.fetcher).page('products',null),{code:'invalid_response'});
});
test('enforces actual streamed byte limit without trusting content length',async()=>{
  let cancelled=false;const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1024*1024));},cancel(){cancelled=true}});
  const x=capture(new Response(body,{headers:{'Content-Type':'application/json'}}));
  await assert.rejects(()=>new LightspeedReadClient('example-store','secret',x.fetcher).page('products',null),{code:'response_too_large'});assert.equal(cancelled,true);
});
test('timeout covers both request and response body',async()=>{
  const fetcher=async(_u,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('secret detail'))));
  await assert.rejects(()=>lightspeedRequest(fetcher,new URL('https://example-store.retail.lightspeed.app/api/2.0/products'),{},5),{code:'request_timeout'});
});
test('authorization URL requests read-only retail scopes plus outlet mapping',()=>{
  const url=new URL(buildLightspeedAuthorizationUrl({clientId:'client',redirectUri:'https://bloomsites.app/api/integrations/lightspeed/callback',state:'a'.repeat(43)}));
  assert.equal(url.origin,'https://secure.retail.lightspeed.app');
  const scopes=url.searchParams.get('scope');assert.ok(scopes.includes('outlets:read'));assert.ok(!scopes.includes(':write'));
});
test('token exchange uses the merchant endpoint and form encoding',async()=>{
  const now=Date.parse('2026-10-09T14:00:00Z');const x=capture(json({access_token:'access',refresh_token:'refresh',expires:now/1000+3600,domain_prefix:'example-store',scope:'products:read',token_type:'Bearer'}));
  const out=await exchangeLightspeedToken({prefix:'example-store',clientId:'client',clientSecret:'secret',redirectUri:'https://bloomsites.app/api/integrations/lightspeed/callback',grant:{kind:'authorization_code',code:'code'},fetcher:x.fetcher,now});
  assert.equal(out.expiresAt,'2026-10-09T15:00:00.000Z');assert.equal(out.accessToken,'access');
  assert.equal(new URL(x.calls[0].url).pathname,'/api/1.0/token');
  assert.equal(new URLSearchParams(x.calls[0].init.body).get('client_secret'),'secret');
});
test('token response from another store is rejected',async()=>{
  const x=capture(json({access_token:'a',refresh_token:'r',expires_in:3600,domain_prefix:'other-store'}));
  await assert.rejects(()=>exchangeLightspeedToken({prefix:'example-store',clientId:'c',clientSecret:'s',redirectUri:'https://bloomsites.app/callback',grant:{kind:'authorization_code',code:'code'},fetcher:x.fetcher}),{code:'oauth_token_response'});
});
test('expired or incomplete token responses never authorize a store',async()=>{
  for(const raw of [{access_token:'a',expires_in:3600},{access_token:'a',refresh_token:'r',expires_in:-1}]) {
    const x=capture(json(raw));await assert.rejects(()=>exchangeLightspeedToken({prefix:'example-store',clientId:'c',clientSecret:'s',redirectUri:'https://bloomsites.app/callback',grant:{kind:'authorization_code',code:'code'},fetcher:x.fetcher}));
  }
});
test('retry-after handles seconds, dates and malformed values',()=>{
  assert.equal(parseRetryAfter('5'),5000);assert.equal(parseRetryAfter('bad'),null);
  assert.equal(parseRetryAfter('Fri, 09 Oct 2026 14:01:00 GMT',Date.parse('2026-10-09T14:00:00Z')),60000);
  assert.equal(parseRetryAfter('999999999999999'),86400000);
});
