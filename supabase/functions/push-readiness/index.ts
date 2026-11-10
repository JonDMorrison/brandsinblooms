import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function response(status:number, value:Record<string,unknown>) {
  return new Response(JSON.stringify(value), {
    status, headers:{...cors,"Content-Type":"application/json","Cache-Control":"private, no-store"},
  });
}
Deno.serve(async(request:Request):Promise<Response>=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method!=="POST")return response(405,{error:"Method not allowed"});
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return response(503,{error:"CRM configuration unavailable"});
  const authorization=request.headers.get("Authorization")||"";
  if(!authorization.startsWith("Bearer ")||authorization.length<40){
    return response(401,{error:"Sign in to Customer Intelligence"});
  }
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await db.auth.getUser(authorization.slice(7));
  if(authError||!auth.user)return response(401,{error:"CRM session expired"});
  const {data:actor}=await db.from("users").select("tenant_id,role")
    .eq("id",auth.user.id).maybeSingle();
  if(!actor?.tenant_id||actor.role!=="admin"){
    return response(403,{error:"Tenant administrator required"});
  }
  const tenantId=actor.tenant_id;
  const count=(name:string,filters:Record<string,string|boolean>,tenantColumn="tenant_id")=>{
    let query=db.from(name).select("*",{head:true,count:"exact"}).eq(tenantColumn,tenantId);
    for(const [column,value] of Object.entries(filters))query=query.eq(column,value);
    return query.then(({count,error})=>error?null:count??0);
  };
  const [
    linkedSites, pendingIdentities,verifiedIdentities,
    activeSubscriptions,optedIn,queued,accepted,failed,
  ]=await Promise.all([
    count("crm_storefront_tenant_links",{enabled:true},"crm_tenant_id"),
    count("crm_storefront_customer_links",{status:"pending"}),
    count("crm_storefront_customer_links",{status:"verified"}),
    count("crm_push_subscriptions",{status:"active"}),
    count("crm_push_preferences",{status:"opted_in"}),
    count("crm_push_messages",{status:"queued"}),
    count("crm_push_messages",{status:"accepted"}),
    count("crm_push_messages",{status:"failed"}),
  ]);
  const usable=linkedSites!=null&&pendingIdentities!=null&&verifiedIdentities!=null&&
    activeSubscriptions!=null&&optedIn!=null&&queued!=null&&accepted!=null&&failed!=null;
  if(!usable)return response(503,{error:"Push health information is temporarily unavailable"});
  const {count:clicks,error:clickError}=await db.from("crm_push_events")
    .select("id",{head:true,count:"exact"}).eq("tenant_id",tenantId).eq("event_type","clicked");
  if(clickError)return response(503,{error:"Push health information is temporarily unavailable"});
  const configured=Boolean(
    Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY")&&
    Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY")&&
    Deno.env.get("WEB_PUSH_VAPID_SUBJECT"),
  );
  return response(200,{
    tenantId,linkedSites,pendingIdentities,verifiedIdentities,
    activeSubscriptions,optedIn,queued,accepted,failed,clicks:clicks??0,
    // Presence/status booleans only; never expose VAPID private keys.
    vapidConfigured:configured,
    pilotEnabled:Deno.env.get("WEB_PUSH_PILOT_ENABLED")==="true",
    deliveryEnabled:Deno.env.get("WEB_PUSH_DELIVERY_ENABLED")==="true",
    campaignsEnabled:Deno.env.get("WEB_PUSH_CAMPAIGN_ENABLED")==="true",
    note:"Provider accepted is not guaranteed device delivery. Install counts are not available yet.",
  });
});
