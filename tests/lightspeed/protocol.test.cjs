require('./register-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const p=require('../../supabase/functions/_shared/lightspeed-storefront/bridge-protocol.ts');
const id='7f6c167b-5345-476e-a3e8-acbfb63a6c84';const now=1791554400000;
const body=JSON.stringify({action:'read',resource:'inventory',cursor:null});

test('private keys never survive public-key normalization',async()=>{
 const keys=await p.createSigningKeyPair();assert.ok(keys.privateKey.d);assert.ok(!keys.publicKey.d);
 assert.throws(()=>p.publicSigningKey(keys.privateKey));
});
test('valid proof binds grant, method contract, timestamp, nonce and body',async()=>{
 const keys=await p.createSigningKeyPair();const headers=new Headers(await p.signBridgeRequest({grantId:id,privateKey:keys.privateKey,body,now}));
 const result=await p.verifyBridgeRequest({headers,publicKey:keys.publicKey,expectedGrantId:id,body,now});
 assert.ok(result);assert.equal(result.nonceHash.length,43);
});
test('altering the request body invalidates a signature',async()=>{
 const keys=await p.createSigningKeyPair();const headers=new Headers(await p.signBridgeRequest({grantId:id,privateKey:keys.privateKey,body,now}));
 assert.equal(await p.verifyBridgeRequest({headers,publicKey:keys.publicKey,expectedGrantId:id,body:body+' ',now}),null);
});
test('signature cannot cross to another site grant',async()=>{
 const keys=await p.createSigningKeyPair();const headers=new Headers(await p.signBridgeRequest({grantId:id,privateKey:keys.privateKey,body,now}));
 assert.equal(await p.verifyBridgeRequest({headers,publicKey:keys.publicKey,expectedGrantId:'735cfcae-be03-4e17-8e1e-66b4e7ed867d',body,now}),null);
});
test('stale and future proofs are rejected',async()=>{
 const keys=await p.createSigningKeyPair();const headers=new Headers(await p.signBridgeRequest({grantId:id,privateKey:keys.privateKey,body,now}));
 for(const testNow of [now+61000,now-61000,NaN])assert.equal(await p.verifyBridgeRequest({headers,publicKey:keys.publicKey,expectedGrantId:id,body,now:testNow}),null);
});
test('an unrelated signing key cannot authorize a grant',async()=>{
 const first=await p.createSigningKeyPair();const other=await p.createSigningKeyPair();
 const headers=new Headers(await p.signBridgeRequest({grantId:id,privateKey:first.privateKey,body,now}));
 assert.equal(await p.verifyBridgeRequest({headers,publicKey:other.publicKey,expectedGrantId:id,body,now}),null);
});
test('malformed encodings and key types fail closed',async()=>{
 const keys=await p.createSigningKeyPair();const headers=new Headers(await p.signBridgeRequest({grantId:id,privateKey:keys.privateKey,body,now}));
 headers.set('X-Lightspeed-Proof','broken');
 assert.equal(await p.verifyBridgeRequest({headers,publicKey:keys.publicKey,expectedGrantId:id,body,now}),null);
 assert.equal(await p.verifyBridgeRequest({headers,publicKey:{kty:'oct',k:'secret'},expectedGrantId:id,body,now}),null);
});
test('callback is pinned to BloomSites, not an attacker-controlled redirect',()=>{
 const state='bs_'+p.randomProofToken();const receipt=p.randomProofToken();
 const good=`https://bloomsites.app/api/integrations/lightspeed/callback?state=${state}&receipt=${receipt}&grant=${id}`;
 assert.equal(p.validatedSiteCallback(good),good);
 for(const bad of [good.replace('bloomsites.app','example.org'),good.replace('/callback','/other'),good+'&next=https://example.org',good+'#secret'])assert.throws(()=>p.validatedSiteCallback(bad));
});
test('state token is fixed-size opaque entropy, never a tenant id',()=>{
 assert.ok(p.isStorefrontLightspeedState('bs_'+p.randomProofToken()));
 for(const state of [id,'bs_bad',null,'bs_'+ 'a'.repeat(44)])assert.equal(p.isStorefrontLightspeedState(state),false);
});
