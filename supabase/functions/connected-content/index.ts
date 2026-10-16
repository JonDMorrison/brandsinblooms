/**
 * Owner-authorized BloomSites content bridge. No code or CMS service secrets
 * are ever exposed to CRM browsers after a link is redeemed.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const BLOOMSITES_API_ORIGIN = "https://bloomsites.app";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codePattern = /^[0-9a-f]{64}$/;
const allowedKinds = new Set(["all","events","pages","products","blogs","fundraisers"]);
const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers});

type WebsiteLink = {
  id: string;
  cms_site_id: string;
  tenant_id: string;
  site_name: string;
  site_origin: string;
  status: "active" | "disconnected";
  linked_at: string;
};
type ContentItem = {
  id: string; siteId: string; type: string; title: string;
  publicUrl: string; description: string; imageUrl: string|null;
  ctaLabel: string; updatedAt: string;
  [key: string]: unknown;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, {headers});
  if (!["GET","POST"].includes(req.method)) return ok({error:"method_not_allowed"},405);
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) return ok({error:"service_unavailable"},503);
  if (!token || token === serviceRole) return ok({error:"authentication_required"},401);

  // Both auth and effective tenant permission are verified with the user's
  // JWT. Never trust tenant_id, permissions or CMS site IDs from browser data.
  const authed = createClient(url, anon, {
    global: {headers: {Authorization: `Bearer ${token}`}},
    auth: {autoRefreshToken:false,persistSession:false},
  });
  const [{data:{user},error:userError},{data:access,error:accessError}] =
    await Promise.all([authed.auth.getUser(token), authed.rpc("get_current_crm_access")]);
  if (userError || !user || accessError || !access ||
      typeof access.tenantId !== "string" || !uuid.test(access.tenantId)) {
    return ok({error:"unauthorized"},401);
  }
  const tenantId: string = access.tenantId;
  const permissions: string[] = Array.isArray(access.permissions) ? access.permissions : [];
  const mayConnect = permissions.includes("integrations.manage");
  const mayPromote = permissions.includes("campaigns.write");
  const mayBrowse = mayConnect || mayPromote || permissions.includes("reports.read");

  const admin = createClient(url,serviceRole,{
    auth:{autoRefreshToken:false,persistSession:false},
  });

  try {
    if (req.method === "POST") {
      if (!mayConnect) return ok({error:"integration_permission_required"},403);
      const body = await req.json().catch(() => null);
      if (body?.action === "connect") {
        const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
        if (!codePattern.test(code)) return ok({error:"invalid_code"},400);
        const response = await fetch(`${BLOOMSITES_API_ORIGIN}/api/connected-content/redeem`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({code}),
          signal:AbortSignal.timeout(12000),
          redirect:"error",
        });
        const linked = await response.json().catch(()=>null);
        if (!response.ok || !linked ||
          typeof linked.siteId !== "string" || !uuid.test(linked.siteId) ||
          typeof linked.siteName !== "string" ||
          typeof linked.siteOrigin !== "string" ||
          !/^https:\/\/[a-z0-9][a-z0-9.-]+$/i.test(linked.siteOrigin)) {
          return ok({error:"invalid_expired_or_unpublished_site"},response.status===410?410:409);
        }

        const {data:existing} = await admin.from("crm_connected_websites")
          .select("id,tenant_id,status").eq("cms_site_id",linked.siteId);
        if ((existing||[]).some((row) => row.tenant_id!==tenantId && row.status==="active")) {
          return ok({error:"site_already_connected_to_another_business"},409);
        }
        const {data:connection,error:saveError} = await admin
          .from("crm_connected_websites").upsert({
            tenant_id:tenantId,
            cms_site_id:linked.siteId,
            site_name:linked.siteName.slice(0,200),
            site_origin:linked.siteOrigin,
            status:"active",
            linked_by:user.id,
            last_connected_at:new Date().toISOString(),
            disconnected_at:null,
          },{onConflict:"tenant_id,cms_site_id"})
          .select("id,cms_site_id,site_name,site_origin,status,linked_at")
          .single();
        if (saveError || !connection) {
          const duplicate=saveError?.code==="23505";
          return ok({error:duplicate?"site_already_connected":"connection_failed"},duplicate?409:503);
        }
        return ok({connected:true,connection});
      }
      if (body?.action==="disconnect") {
        const siteId = typeof body.siteId==="string"?body.siteId:"";
        if (!uuid.test(siteId)) return ok({error:"invalid_site"},400);
        const {data, error} = await admin.from("crm_connected_websites")
          .update({status:"disconnected",disconnected_at:new Date().toISOString()})
          .eq("tenant_id",tenantId).eq("cms_site_id",siteId)
          .select("id").maybeSingle();
        if (error) return ok({error:"disconnect_failed"},503);
        if (!data) return ok({error:"connection_not_found"},404);
        return ok({disconnected:true});
      }
      return ok({error:"unsupported_action"},400);
    }
    if (!mayBrowse) return ok({error:"campaign_or_integration_permission_required"},403);

    const {data:links,error:linkError} = await admin.from("crm_connected_websites")
      .select("id,cms_site_id,site_name,site_origin,status,linked_at")
      .eq("tenant_id",tenantId).eq("status","active")
      .order("linked_at",{ascending:false}).limit(25);
    if (linkError) return ok({error:"connection_lookup_failed"},503);
    const connectionList=(links??[]) as WebsiteLink[];
    const requested = new URL(req.url);
    const action = requested.searchParams.get("action")??"catalog";
    if (action==="connections") {
      return ok({connections:connectionList});
    }
    if (action!=="catalog") return ok({error:"invalid_action"},400);
    const kind = requested.searchParams.get("type")??"all";
    if (!allowedKinds.has(kind)) return ok({error:"invalid_content_type"},400);
    const query = (requested.searchParams.get("q")??"").trim().slice(0,100);
    const siteId=requested.searchParams.get("siteId")??"";
    if (siteId && !uuid.test(siteId)) return ok({error:"invalid_site"},400);
    const permittedLinks = siteId ? connectionList.filter(x=>x.cms_site_id===siteId):connectionList;
    if (siteId && permittedLinks.length===0) return ok({error:"site_not_connected"},404);
    const limit = Math.min(50,Math.max(1,Number(requested.searchParams.get("limit"))||24));
    const outcomes=await Promise.all(permittedLinks.map(async(link)=>{
      const upstream=new URL(`${BLOOMSITES_API_ORIGIN}/api/connected-content/catalog`);
      upstream.searchParams.set("siteId",link.cms_site_id);
      upstream.searchParams.set("type",kind);
      upstream.searchParams.set("limit",String(limit));
      if (query)upstream.searchParams.set("q",query);
      try {
        const res=await fetch(upstream,{headers:{"Accept":"application/json"},
          signal:AbortSignal.timeout(10000),redirect:"error"});
        if(!res.ok) return {siteId:link.cms_site_id,error:"content_unavailable",items:[]};
        const payload=await res.json();
        if(payload?.siteId!==link.cms_site_id ||
           !Array.isArray(payload.items)) {
          return {siteId:link.cms_site_id,error:"invalid_catalog",items:[]};
        }
        const allowedOrigin = new URL(payload.siteOrigin).origin;
        const items:ContentItem[]=payload.items.filter((item:ContentItem)=>{
          if (typeof item?.id!=="string" || !uuid.test(item.id) ||
              typeof item?.publicUrl!=="string" ||
              typeof item?.title!=="string" ||
              !["event","page","product","blog","fundraiser"].includes(item.type))return false;
          try {return new URL(item.publicUrl).origin===allowedOrigin &&
            item.siteId===link.cms_site_id;
          }catch{return false;}
        }).map((item:ContentItem)=>({
          ...item,siteName:link.site_name,
        }));
        return {siteId:link.cms_site_id,siteName:link.site_name,
          refreshedAt:payload.refreshedAt,hasMore:Boolean(payload.hasMore),items};
      }catch{return {siteId:link.cms_site_id,error:"content_unavailable",items:[]};}
    }));
    return ok({
      connections:connectionList,
      items:outcomes.flatMap(x=>x.items),
      sources:outcomes.map(({items,...source})=>source),
      errors:outcomes.filter(x=>"error" in x).map(x=>({siteId:x.siteId,error:x.error})),
    });
  } catch {
    return ok({error:"connected_content_temporarily_unavailable"},503);
  }
});
