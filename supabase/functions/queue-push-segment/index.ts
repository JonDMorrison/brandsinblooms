import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function response(code: number, value: Record<string, unknown>): Response {
  return new Response(JSON.stringify(value), { status: code, headers: {
    ...cors, "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  } });
}
function uuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}
function safeOpenPath(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 && value.length <= 1024 &&
    value.startsWith("/") && !value.startsWith("//") &&
    !value.includes("\\") && !/[\u0000-\u001f]/.test(value);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return response(405, { error: "Method not allowed" });

  // Preview is safe when credentials are available, but no queue or send may
  // happen without a separate platform pilot gate.
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response(503, { error: "Customer Intelligence unavailable" });

  const header = req.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ") || header.length < 40) {
    return response(401, { error: "CRM administrator sign-in required" });
  }
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await db.auth.getUser(header.slice(7));
  if (authError || !auth.user) return response(401, { error: "CRM session is invalid" });
  const { data: actor, error: actorError } = await db.from("users")
    .select("id,tenant_id,role").eq("id", auth.user.id).maybeSingle();
  if (actorError || !actor?.tenant_id || actor.role !== "admin") {
    return response(403, { error: "CRM tenant administrator required" });
  }

  let input: Record<string, unknown>;
  try {
    const raw: unknown = await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Invalid");
    input = raw as Record<string, unknown>;
  } catch { return response(400, { error: "Invalid request body" }); }

  const action = input.action;
  if (action === "history") {
    const {data,error}=await db.rpc("crm_push_campaign_overview_v1",{
      p_tenant_id:actor.tenant_id,p_limit:25,
    });
    if (error) return response(503,{error:"Campaign history temporarily unavailable"});
    return response(200,{campaigns:data||[]});
  }
  if (action === "pause" || action === "resume" || action === "cancel") {
    if (!uuid(input.campaignId) || (action === "cancel" && input.confirmed !== true)) {
      return response(400,{error:"Confirm the campaign action"});
    }
    const next=action === "pause" ? "paused" :
      action === "resume" ? "queued" : "cancelled";
    let query=db.from("crm_push_campaigns").update({status:next})
      .eq("id",input.campaignId).eq("tenant_id",actor.tenant_id);
    query=action === "resume" ? query.eq("status","paused") :
      action === "pause" ? query.eq("status","queued") :
      query.in("status",["queued","paused"]);
    const {data,error}=await query.select("id,status,title").maybeSingle();
    if (error || !data) return response(409,{error:"Campaign is no longer editable or was not found"});
    if (next==="cancelled") {
      await db.from("crm_push_messages").update({status:"cancelled",claimed_at:null})
        .eq("tenant_id",actor.tenant_id).eq("push_campaign_id",data.id)
        .in("status",["queued","retry"]);
    }
    return response(200,{campaign:data,
      note:"Already accepted notifications cannot be recalled."});
  }
  if (action === "list") {
    const { data, error } = await db.from("crm_segments")
      .select("id,name,customer_count")
      .eq("tenant_id",actor.tenant_id)
      .eq("status","active").is("deleted_at",null)
      .order("name").limit(100);
    if (error) return response(503, { error: "Customer segments unavailable" });
    return response(200, { segments: data || [] });
  }

  if (!uuid(input.segmentId)) return response(400, { error: "Valid segment ID required" });
  if (action !== "preview" && action !== "queue") {
    return response(400, { error: "Unknown campaign action" });
  }

  const { data: segment, error: segmentError } = await db.from("crm_segments")
    .select("id,name,status").eq("id",input.segmentId)
    .eq("tenant_id", actor.tenant_id)
    .eq("status","active").is("deleted_at",null).maybeSingle();
  if (segmentError || !segment) {
    return response(404, { error: "Active segment not found in your tenant" });
  }
  const { data: preview, error: previewError } = await db.rpc(
    "preview_crm_push_segment_v1", {
      p_tenant_id: actor.tenant_id, p_segment_id: input.segmentId,
    },
  );
  if (previewError || !preview) {
    console.error("[queue-push-segment] preview query failed", { code: previewError?.code });
    return response(503, { error: "Unable to evaluate push audience" });
  }
  if (action === "preview") {
    return response(200, { segmentId:segment.id,segmentName:segment.name,
      audience:preview,
      pilotCap:250,
      message: "Only active, reviewed and opted-in subscriptions are eligible.",
    });
  }

  if (Deno.env.get("WEB_PUSH_CAMPAIGN_ENABLED") !== "true") {
    return response(403, { error: "Push campaigns have not been activated for this pilot" });
  }
  if (input.confirmed !== true || input.audienceReviewed !== true) {
    return response(400, { error: "Confirm the audience and channel before queueing" });
  }
  if (typeof input.title !== "string" ||
      input.title.trim().length < 3 || input.title.trim().length > 120 ||
      typeof input.body !== "string" || input.body.length > 240 ||
      !safeOpenPath(input.openPath) ||
      typeof input.requestKey !== "string" ||
      !/^[a-zA-Z0-9:_-]{8,100}$/.test(input.requestKey)) {
    return response(400, { error: "Enter a valid title, message, path and request ID" });
  }

  const { data, error } = await db.rpc("queue_crm_push_segment_v1", {
    p_tenant_id:actor.tenant_id,
    p_segment_id:input.segmentId,
    p_created_by:auth.user.id,
    p_request_key:input.requestKey,
    p_title:input.title.trim(),
    p_body:input.body,
    p_open_path:input.openPath,
  });
  if (error || !data) {
    console.error("[queue-push-segment] queue rejected", { code:error?.code });
    return response(409, { error: "Unable to queue this push campaign. Review audience, permissions and pilot limit." });
  }
  return response(202, { ...data, segmentName:segment.name });
});
