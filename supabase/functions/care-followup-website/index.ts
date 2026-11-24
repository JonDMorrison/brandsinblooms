import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {validateCandidates,audienceDigest,websiteBuyerIds,websitePurchasedProducts,type WebsiteScope} from '../_shared/website-care-followup.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 if(Deno.env.get('CARE_GUIDE_WEBSITE_FOLLOWUP_ENABLED')!=='true')return reply({error:'not_enabled'},503);
 const authorization=req.headers.get('Authorization'),secret=Deno.env.get('CARE_GUIDE_DESIGN_SYNC_SECRET')||'';
 if(!authorization||secret.length<32)return reply({error:'not_available'},401);
 try{
  const raw=await req.text();if(raw.length>4096)return reply({error:'too_large'},413);
  const body=JSON.parse(raw);
  if(!body||!uuid.test(String(body.siteId))||!['catalog','preview','create'].includes(body.action))return reply({error:'invalid_scope'},400);
  const url=Deno.env.get('SUPABASE_URL')??'';
  const authed=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')??'',{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const [user,access]=await Promise.all([authed.auth.getUser(),authed.rpc('get_current_crm_access')]);
  const tenant=access.data?.tenantId;
  if(user.error||!user.data.user||access.error||typeof tenant!=='string'||!uuid.test(tenant)||!Array.isArray(access.data.permissions)||!['campaigns.write','customers.read'].every(p=>access.data.permissions.includes(p)))return reply({error:'permission_required'},403);
  const allowed=await authed.rpc('list_care_followup_websites',{p_tenant:tenant});
  if(allowed.error||!Array.isArray(allowed.data)||!allowed.data.some(v=>v.siteId===body.siteId))return reply({error:'reviewed_website_link_required'},403);
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',{auth:{persistSession:false,autoRefreshToken:false}});
  const data=await admin.rpc('care_website_candidates',{p_tenant:tenant,p_site:body.siteId});
  if(data.error)return reply({error:'identity_evidence_unavailable'},503);
  const candidates=validateCandidates(data.data);
  const now=Date.now(),asOf=body.action==='catalog'||body.action==='preview'?now:Date.parse(String(body.asOf));
  const days=body.action==='catalog'?90:body.days;
  if(![7,14,30,60,90].includes(days)||!Number.isFinite(asOf)||asOf>now+60000||asOf<now-900000||
   (body.action!=='catalog'&&!uuid.test(String(body.productId))))return reply({error:'review_window_expired'},400);
  const scope:WebsiteScope={siteId:body.siteId,tenantId:tenant,productId:body.action==='catalog'?null:body.productId,from:new Date(asOf-days*86400000).toISOString(),until:new Date(asOf-86400000).toISOString()};
  if(body.action==='catalog')return reply({products:await websitePurchasedProducts(scope,candidates,secret)});
  const ids=await websiteBuyerIds(scope,candidates,secret),digest=await audienceDigest(ids);
  if(body.action==='preview')return reply({count:ids.length,digest,asOf:new Date(asOf).toISOString()});
  if(body.confirmed!==true||body.digest!==digest||!ids.length||!uuid.test(String(body.requestId))||typeof body.productName!=='string')return reply({error:'review_changed'},409);
  const catalog=await websitePurchasedProducts({...scope,productId:null},candidates,secret);
  if(!catalog.some(p=>p.product_id===scope.productId&&p.product_name===body.productName))return reply({error:'plant_identity_changed'},409);
  const saved=await admin.rpc('create_website_care_followup_draft',{p_tenant:tenant,p_actor:user.data.user.id,p_site:scope.siteId,p_product:scope.productId,p_from:scope.from,p_until:scope.until,p_ids:ids,p_digest:digest,p_request:body.requestId,p_label:body.productName});
  if(saved.error||!saved.data?.campaignId)return reply({error:'draft_not_created'},409);
  return reply(saved.data);
 }catch{return reply({error:'purchase_evidence_unavailable'},503);}
});
