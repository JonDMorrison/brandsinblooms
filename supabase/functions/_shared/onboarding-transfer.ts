/** Read-only, explicitly paired onboarding protocol. Never accepts an arbitrary URL from a browser. */
export interface OnboardingBinding {tenantId:string;accountId:string;secret:string}
export interface OnboardingConnection extends OnboardingBinding {id:string;storeId:string;label:string;source:'BLOOMSITES'|'CRM';url:string;keyId:string}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function transferSignature(secret:string,timestamp:string,body:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+body)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function boundedText(body:ReadableStream<Uint8Array>|null,limit:number){
 if(!body)throw Error('Body required');const reader=body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit){await reader.cancel();throw Error('Response too large');}chunks.push(part.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function onboardingExporter(deps:{binding:(key:string)=>Promise<OnboardingBinding|null>;snapshot:(key:string)=>Promise<unknown>;now?:()=>number}){
 return async(req:Request)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
   const key=req.headers.get('x-bloom-key-id')??'',timestamp=req.headers.get('x-bloom-timestamp')??'',signature=req.headers.get('x-bloom-signature')??'';
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(key)||!/^\d{10}$/.test(timestamp)||Math.abs((deps.now?.()??Date.now())/1000-Number(timestamp))>300||! /^[a-f0-9]{64}$/.test(signature))return json({error:'Connection not authorized'},401);
   const binding=await deps.binding(key);if(!binding||binding.secret.length<32)return json({error:'Connection not authorized'},401);
   const raw=await boundedText(req.body,4096);const expected=await transferSignature(binding.secret,timestamp,raw);let diff=0;for(let i=0;i<64;i++)diff|=signature.charCodeAt(i)^expected.charCodeAt(i);
   if(diff)return json({error:'Connection not authorized'},401);
   const body=JSON.parse(raw);
   if(body?.action!=='preview-onboarding'||body.version!==1||body.tenantId!==binding.tenantId||body.accountId!==binding.accountId)return json({error:'Wrong business or request'},403);
   const snapshot=await deps.snapshot(key);if(!snapshot)return json({error:'Connection unavailable'},409);
   const result=JSON.stringify(snapshot);if(new TextEncoder().encode(result).length>5*1024*1024)return json({error:'Catalogue needs an assisted transfer'},413);
   return new Response(result,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }catch{return json({error:'Could not prepare the connected catalogue. No source records changed.'},503);}
 };
}
export function configuredConnections(raw:string|undefined):OnboardingConnection[]{
 if(!raw)return [];const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed))throw Error('Invalid connections');
 const ids=new Set<string>();return parsed.map((c:OnboardingConnection)=>{
  const url=new URL(c.url);
  // Only the explicitly provisioned Supabase Edge endpoint. No redirects, private IPs, credentials or query parameters.
  if(!/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)||url.protocol!=='https:'||url.pathname!=='/functions/v1/pos-onboarding-export'||url.port||url.search||url.hash||url.username||url.password||!['CRM','BLOOMSITES'].includes(c.source)||!c.tenantId||!c.storeId||!c.accountId||typeof c.secret!=='string'||c.secret.length<32||! /^[a-zA-Z0-9_-]{1,100}$/.test(c.id)||! /^[a-zA-Z0-9_-]{1,100}$/.test(c.keyId)||typeof c.label!=='string'||c.label.length>120||ids.has(c.id))throw Error('Invalid connection');
  ids.add(c.id);return c;
 });
}
export function onboardingReader(deps:{authorize:(req:Request)=>Promise<{tenantId:string;stores:{id:string;name:string;currency:string}[]}|null>;connections:()=>OnboardingConnection[];fetch?:typeof fetch;now?:()=>number}){
 return async(req:Request)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
   const owner=await deps.authorize(req);if(!owner)return json({error:'Sign in as the owner to connect your business'},403);
   const tenant=owner.tenantId;const body=JSON.parse(await boundedText(req.body,4096));const connections=deps.connections().filter(c=>c.tenantId===tenant&&owner.stores.some(s=>s.id===c.storeId));
   if(body.action==='list')return json({connections:connections.map(c=>({id:c.id,label:c.label,source:c.source,storeName:owner.stores.find(s=>s.id===c.storeId)!.name}))});
   const c=connections.find(c=>c.id===body.connectionId);if(body.action!=='preview'||!c)return json({error:'Choose a connection for this business'},404);
   const timestamp=String(Math.floor((deps.now?.()??Date.now())/1000));const payload=JSON.stringify({version:1,action:'preview-onboarding',tenantId:tenant,accountId:c.accountId});
   const response=await(deps.fetch??fetch)(c.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','x-bloom-key-id':c.keyId,'x-bloom-timestamp':timestamp,'x-bloom-signature':await transferSignature(c.secret,timestamp,payload)},body:payload});
   if(!response.ok)return json({error:'Your connection could not prepare a preview. Ask your setup team to check its transfer permission.'},502);
   const snapshot=JSON.parse(await boundedText(response.body,5*1024*1024));
   if(snapshot.version!==1||snapshot.source!==c.source||snapshot.tenantId!==tenant||snapshot.accountId!==c.accountId||!['CAD','USD'].includes(snapshot.currency)||!Array.isArray(snapshot.products)||snapshot.products.length>2000||snapshot.complete!==true||snapshot.currency!==owner.stores.find(s=>s.id===c.storeId)?.currency)throw Error('Invalid or incomplete snapshot');
   // Namespace stable identities by source account, preventing accidental cross-store overwrite on a second connection.
   snapshot.products=snapshot.products.map((p:Record<string,unknown>)=>{if(!p||typeof p.id!=='string'||!p.id.trim()||p.id.length>100)throw Error('Missing source identity');return {...p,id:`${c.source}:${c.accountId}:${p.id}`};});
   return json({snapshot,connection:{id:c.id,label:c.label,source:c.source}});
  }catch{return json({error:'The connected preview is unavailable. Retry or use a prepared export; your products have not changed.'},503);}
 };
}
