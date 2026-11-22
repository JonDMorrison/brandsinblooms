import {createClient} from "npm:@supabase/supabase-js@2.117.2";
import {readNativeRewardBalances} from "../_shared/nativeRewardBalances.ts";
const headers = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store"};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, {headers});
  if (req.method !== "POST") return reply({error: "Method not allowed"}, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !anon || !service) return reply({error: "Balances unavailable"}, 503);
  if (!token || token === service) return reply({error: "Sign in required"}, 401);
  try {
    const reader = req.body?.getReader(); if (!reader) return reply({error: "Body required"}, 400);
    let bytes = 0, text = ""; const decoder = new TextDecoder();
    try {while (true) {const {value, done} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 4096) {await reader.cancel(); return reply({error: "Request too large"}, 413);} text += decoder.decode(value, {stream: true});}} finally {reader.releaseLock();}
    const input = JSON.parse(text + decoder.decode());
    if (!uuid.test(input?.customerId ?? "") || !uuid.test(input?.tenantId ?? "")) return reply({error: "Customer and business required"}, 400);
    const userClient = createClient(url, anon, {global: {headers: {Authorization: `Bearer ${token}`}}, auth: {persistSession: false, autoRefreshToken: false}});
    const [{data: {user}, error: userError}, {data: access, error: accessError}] = await Promise.all([userClient.auth.getUser(token), userClient.rpc("get_current_crm_access")]);
    if (userError || !user) return reply({error: "Sign in required"}, 401);
    if (accessError || access?.tenantId !== input.tenantId || !Array.isArray(access.permissions) || !access.permissions.includes("customers.read")) return reply({error: "Customer access required"}, 403);
    const {data: customer, error: customerError} = await userClient.from("crm_customers").select("id").eq("tenant_id", access.tenantId).eq("id", input.customerId).is("deleted_at", null).is("merged_into_customer_id", null).maybeSingle();
    if (customerError || !customer) return reply({error: "Customer unavailable"}, 404);
    const admin = createClient(url, service, {auth: {persistSession: false, autoRefreshToken: false}});
    return reply({balances: await readNativeRewardBalances(admin, access.tenantId, customer.id)});
  } catch {return reply({error: "Balances could not be checked"}, 503);}
});
