/** Owner-authorized Care Guide theme synchronization to CRM-connected BloomSites. */
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';

const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
 'Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const response=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CMS_SYNC_URL='https://bloomsites.app/api/internal/care-guides/sync';
const normalize=(value:unknown):Record<string,string>=>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid published Care Guide design');
 const keys=['storeName','logoUrl','primaryColor','accentColor','headline','intro','helpHeading','helpBody','helpUrl','helpLinkText'];
 const out:Record<string,string>={};
 for(const k of keys){const v=(value as Record<string,unknown>)[k];if(typeof v==='string')out[k]=v;}
 if(!out.storeName?.trim())throw Error('Store name must be set');
 return out;
};
const sign=async(secret:string,ts:string,body:string)=>{
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const raw=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ts+'.'+body)));
 return Array.from(raw).map(byte=>byte.toString(16).padStart(2,'0')).join('');
};
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return response({error:'method_not_allowed'},405);
 const secret=Deno.env.get('CARE_GUIDE_DESIGN_SYNC_SECRET')??'';
 if(secret.length<32)return response({error:'theme_sync_not_configured'},503);
 const bearer=request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
 const url=Deno.env.get('SUPABASE_URL')||'';
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!bearer||!url||!anon||!service)return response({error:'unauthorized'},401);
 try{
  const authed=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+bearer}},auth:{persistSession:false,autoRefreshToken:false}});
  const [{data:{user},error:userError},{data:access,error:accessError}]=await Promise.all([
   authed.auth.getUser(bearer),authed.rpc('get_current_crm_access'),
  ]);
  if(userError||!user||accessError||!access||
   typeof access.tenantId!=='string'||!uuid.test(access.tenantId)||
   !Array.isArray(access.permissions)||!access.permissions.includes('campaigns.write'))
    return response({error:'campaign_permission_required'},403);
  const tenantId=access.tenantId;
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const [draft,links]=await Promise.all([
   admin.from('care_guide_designs').select('published,published_version').eq('tenant_id',tenantId).maybeSingle(),
   admin.from('crm_connected_websites').select('cms_site_id').eq('tenant_id',tenantId).eq('status','active').order('linked_at',{ascending:false}).limit(10),
  ]);
  if(draft.error||links.error)return response({error:'care_guide_published_source_unavailable'},503);
  const version=Number(draft.data?.published_version||0);
  if(!Number.isSafeInteger(version)||version<1||!draft.data?.published)
   return response({error:'publish_a_design_first'},409);
  const design=normalize(draft.data.published);
  const sites=[...new Set((links.data||[]).map(x=>String(x.cms_site_id)).filter(id=>uuid.test(id)))];
  if(!sites.length)return response({synced:[],failed:[],version,reason:'no_connected_bloomsites'});
  const ts=String(Math.floor(Date.now()/1000));
  const outcomes=await Promise.all(sites.map(async siteId=>{
   const body=JSON.stringify({siteId,crmTenantId:tenantId,version,design});
   const signature=await sign(secret,ts,body);
   try{
    const upstream=await fetch(CMS_SYNC_URL,{method:'POST',redirect:'error',cache:'no-store',
     signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json','x-care-guide-timestamp':ts,
      'x-care-guide-signature':'sha256='+signature},body});
    const result=await upstream.json().catch(()=>({}));
    return {siteId,ok:upstream.ok&&result.siteId===siteId&&['created','updated','already_current','stale'].includes(result.status),
      status:upstream.ok?result.status:'rejected',posTheme:upstream.ok?result.posTheme:undefined};
   }catch{return {siteId,ok:false,status:'unavailable'};}
  }));
  return response({version,synced:outcomes.filter(x=>x.ok).map(x=>x.siteId),
   failed:outcomes.filter(x=>!x.ok).map(x=>({siteId:x.siteId,status:x.status})),posUpdated:outcomes.filter(x=>x.ok&&x.posTheme==='updated').length,posPending:outcomes.filter(x=>x.ok&&x.posTheme==='pending').length},200);
 }catch{return response({error:'care_guide_theme_sync_failed'},503);}
});
