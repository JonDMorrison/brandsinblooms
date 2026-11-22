import {serve} from "https://deno.land/std@0.190.0/http/server.ts";
import {createClient} from "npm:@supabase/supabase-js@2.117.2";
const headers = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store"};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, {headers});
  if (req.method !== "POST") return reply({error: "Method not allowed"}, 405);
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({error: "Review is temporarily unavailable"}, 503);
  if (!token || token === service) return reply({error: "Sign in to review membership requests"}, 401);
  try {
    // Enforce the actual streamed bytes, including chunked requests or a false Content-Length.
    const reader = req.body?.getReader();
    if (!reader) return reply({error: "Request body required"}, 400);
    const decoder = new TextDecoder();
    let bytes = 0, body = "";
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) {await reader.cancel(); return reply({error: "Request body is too large"}, 413);}
      body += decoder.decode(value, {stream: true});
    }
    body += decoder.decode();
    let input;
    try {input = JSON.parse(body);} catch {return reply({error: "Invalid JSON body"}, 400);}

    if (!input || !uuid.test(input.requestId ?? "") || !uuid.test(input.tenantId ?? "") || typeof input.reject !== "boolean" || typeof input.reason !== "string" || input.reason.trim().length < 20 || input.reason.trim().length > 2000) return reply({error: "Select a request and provide review notes of 20–2000 characters"}, 400);
    const userClient = createClient(url, anon, {global: {headers: {Authorization: `Bearer ${token}`}}, auth: {persistSession: false, autoRefreshToken: false}});
    const [{data: {user}, error: userError}, {data: access, error: accessError}] = await Promise.all([userClient.auth.getUser(token), userClient.rpc("get_current_crm_access")]);
    if (userError || !user) return reply({error: "Sign in again to review requests"}, 401);
    if (accessError || access?.tenantId !== input.tenantId) return reply({error: "The selected business is not available in this session"}, 403);
    // This RPC checks the current auth.sessions record as well as reviewer role.
    const {data: workspace, error: workspaceError} = await userClient.rpc("pos_membership_workspace");
    if (workspaceError || !workspace || !Array.isArray(workspace.requests)) return reply({error: "A current owner or marketing staff session is required"}, 403);
    const request = workspace.requests.find((row: {id?: string; state?: string; purchase_result?: string}) => row.id === input.requestId);
    const mayReview = request && (["REVIEW_REQUIRED", "PROVIDER_PENDING"].includes(request.state) || (request.state === "CONFIRMED" && !input.reject && ["pending", "review_required"].includes(request.purchase_result ?? "")));
    if (!mayReview) return reply({error: "This request is unavailable or already finalized. Refresh the list."}, 409);
    const admin = createClient(url, service, {auth: {persistSession: false, autoRefreshToken: false}});
    const {error} = await admin.rpc("review_pos_membership_request", {p_tenant: access.tenantId, p_user: user.id, p_request: input.requestId, p_reject: input.reject, p_reason: input.reason.trim()});
    if (error) return reply({error: "The request could not be reviewed. Refresh its policy and identity evidence before trying again."}, 409);
    return reply({reviewed: true});
  } catch {return reply({error: "Membership review is temporarily unavailable"}, 503);}
});
