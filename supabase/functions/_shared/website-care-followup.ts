/** Purpose-separated HMAC requests to the authorized BloomSites evidence service. */
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const bytes=(v:string)=>new TextEncoder().encode(v);
const hex=(v:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(v)).map(n=>n.toString(16).padStart(2,'0')).join('');
export type Candidate={customerId:string;userId:string};
export type WebsiteScope={siteId:string;tenantId:string;productId:string|null;from:string;until:string};
export function validateCandidates(value:unknown):Candidate[]{
 if(!Array.isArray(value)||value.length>5000||value.some(v=>!obj(v)||typeof v.customerId!=='string'||!uuid.test(v.customerId)||typeof v.userId!=='string'||!uuid.test(v.userId)))throw Error('Unverified storefront identity');
 return value as Candidate[];
}
export async function audienceDigest(ids:string[]){
 return hex(await crypto.subtle.digest('SHA-256',bytes('{'+[...new Set(ids)].sort().join(',')+'}')));
}
async function evidence(scope:WebsiteScope,action:'catalog'|'buyers',users:string[],secret:string,fetcher:typeof fetch=fetch){
 if(secret.length<32||users.length>250||!uuid.test(scope.siteId)||!uuid.test(scope.tenantId)||(action==='buyers'&&(!scope.productId||!uuid.test(scope.productId))))throw Error('Purchase bridge unavailable');
 const nonce=hex(crypto.getRandomValues(new Uint8Array(16))),ts=String(Math.floor(Date.now()/1000));
 const raw=JSON.stringify({siteId:scope.siteId,crmTenantId:scope.tenantId,action,productId:action==='buyers'?scope.productId:null,users,from:scope.from,until:scope.until,nonce});
 const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const signature='sha256='+hex(await crypto.subtle.sign('HMAC',key,bytes('care-followup:evidence:v1\n'+ts+'\n'+raw)));
 const response=await fetcher('https://bloomsites.app/api/internal/care-guides/followup-evidence',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json','x-care-evidence-timestamp':ts,'x-care-evidence-signature':signature},body:raw});
 if(!response.ok||response.headers.get('x-care-evidence-timestamp')!==ts||!response.body)throw Error('Purchase evidence unavailable');
 const sig=response.headers.get('x-care-evidence-signature')||'';
 if(!/^sha256=[a-f0-9]{64}$/.test(sig))throw Error('Unsigned evidence');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>65536){await reader.cancel();throw Error('Evidence too large');}chunks.push(p.value);}}finally{reader.releaseLock();}
 const rawBytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){rawBytes.set(chunk,offset);offset+=chunk.length;}
 const body=new TextDecoder('utf-8',{fatal:true}).decode(rawBytes);
 const valid=await crypto.subtle.verify('HMAC',key,Uint8Array.from(sig.slice(7).match(/.{2}/g)??[],v=>parseInt(v,16)),bytes('care-followup:response:v1\n'+ts+'\n'+body));
 if(!valid)throw Error('Invalid purchase proof');
 const value:unknown=JSON.parse(body);
 if(!obj(value)||value.siteId!==scope.siteId||value.crmTenantId!==scope.tenantId||value.action!==action||value.productId!==(action==='buyers'?scope.productId:null)||value.nonce!==nonce||!Array.isArray(value.results))throw Error('Purchase scope mismatch');
 return value.results;
}
export async function websiteBuyerIds(scope:WebsiteScope,candidates:Candidate[],secret:string,fetcher:typeof fetch=fetch):Promise<string[]>{
 const users=[...new Set(candidates.map(c=>c.userId))],eligible=new Set<string>();
 for(let i=0;i<users.length;i+=250){const chunk=users.slice(i,i+250),result=await evidence(scope,'buyers',chunk,secret,fetcher);
  if(result.some(v=>typeof v!=='string'||!chunk.includes(v)))throw Error('Unexpected storefront identity');
  for(const id of result)eligible.add(id as string);
 }
 return [...new Set(candidates.filter(c=>eligible.has(c.userId)).map(c=>c.customerId))].sort();
}
export async function websitePurchasedProducts(scope:WebsiteScope,candidates:Candidate[],secret:string){
 const users=[...new Set(candidates.map(c=>c.userId))],products=new Map<string,{product_id:string;product_name:string;last_purchase:string}>();
 for(let i=0;i<users.length;i+=250){
  const result=await evidence(scope,'catalog',users.slice(i,i+250),secret);
  for(const row of result){
   if(!obj(row)||typeof row.product_id!=='string'||!uuid.test(row.product_id)||typeof row.product_name!=='string'||typeof row.last_purchase!=='string'||!Number.isFinite(Date.parse(row.last_purchase)))throw Error('Invalid purchased plant');
   const prior=products.get(row.product_id);if(!prior||Date.parse(prior.last_purchase)<Date.parse(row.last_purchase))products.set(row.product_id,{product_id:row.product_id,product_name:row.product_name,last_purchase:row.last_purchase});
  }
 }
 return [...products.values()].sort((a,b)=>Date.parse(b.last_purchase)-Date.parse(a.last_purchase)).slice(0,100);
}
