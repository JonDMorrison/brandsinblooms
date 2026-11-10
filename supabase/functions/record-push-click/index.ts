import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function response(status: number): Response {
  // Do not allow probing individual customers, subscriptions or campaign IDs.
  return new Response(JSON.stringify({ accepted: true }), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
const UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
  if (request.method !== "POST") return response(405);
  const text = await request.text();
  if (text.length > 512) return response(413);

  let token: string | null = null;
  try {
    const body = JSON.parse(text) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const value = (body as Record<string,unknown>).clickToken;
      if (typeof value === "string" && UUID_V4.test(value)) token = value;
    }
  } catch {}
  // Identical answers for unknown tokens avoid building an enumeration API.
  if (!token) return response(200);

  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url||!key) return response(503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:message,error} = await db.from("crm_push_messages")
    .select("id,tenant_id,status,created_at")
    .eq("click_token",token).maybeSingle();
  if (error || !message || message.status !== "accepted" ||
      new Date(message.created_at).getTime() < Date.now()-45*86400_000) {
    return response(200);
  }
  const {error:insertError}=await db.from("crm_push_events").insert({
    message_id:message.id,
    tenant_id:message.tenant_id,
    event_type:"clicked",
    details:{source:"service_worker"},
  });
  if (insertError && insertError.code !== "23505") {
    console.error("[record-push-click] write rejected", {code:insertError.code});
    return response(503);
  }
  return response(200);
});
