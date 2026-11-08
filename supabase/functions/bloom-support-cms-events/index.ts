// HMAC-authenticated, event-driven major project updates from BloomSites.
// The CMS site/project database stays authoritative. No private client data in request.
import { db, env } from "../_shared/bloom-support/runtime.ts";

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {status, headers:{"content-type":"application/json"}});
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch=0;
  for(let i=0;i<a.length;i++)mismatch |= a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
}
async function verify(secret:string,timestamp:string,body:string,signature:string):Promise<boolean> {
  if(!/^\d{10}$/.test(timestamp) || Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300 ||
     !/^sha256=[0-9a-f]{64}$/i.test(signature))return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,
    new TextEncoder().encode(timestamp+"."+body)));
  const expected="sha256="+Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  return constantTimeEqual(expected,signature.toLowerCase());
}
const TYPES=new Set([
  "major_project.created","major_project.stage_changed",
  "major_project.accepted","major_project.onboarding"
]);
Deno.serve(async(req)=>{
  if(req.method!=="POST")return respond({error:"POST only"},405);
  const secret=env("BLOOM_SUPPORT_CMS_EVENTS_SECRET");
  if(!secret||secret.length<24)return respond({error:"not configured"},503);
  if(Number(req.headers.get("content-length")??0)>8192)return respond({error:"too large"},413);
  const raw=await req.text();
  if(new TextEncoder().encode(raw).length>8192)return respond({error:"too large"},413);
  if(!(await verify(secret,req.headers.get("x-bloom-timestamp")??"",raw,
    req.headers.get("x-bloom-signature")??"")))return respond({error:"unauthenticated"},401);
  let payload:Record<string,unknown>;
  try{
    payload=JSON.parse(raw);
    if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("invalid");
  }catch{return respond({error:"invalid"},400)}
  const {source,event_id,project_id,kind}=payload;
  if(source!=="cms"||typeof event_id!=="string"||
    !/^[0-9a-f-]{36}$/i.test(event_id)||typeof project_id!=="string"||
    !/^[0-9a-f-]{36}$/i.test(project_id)||!TYPES.has(String(kind)))
    return respond({error:"invalid"},400);
  const {data,error}=await db().rpc("bloom_support_enqueue_slack_external",{
    p_source:"cms",p_event_id:event_id,p_kind:kind,
    p_url:null,p_project_id:project_id,
  });
  if(error){
    console.error("Major Project Slack queue failed",error.code);
    return respond({error:"queue unavailable"},503);
  }
  return respond({ok:true,queued:data?.queued===true});
});