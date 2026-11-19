/**
 * bloomsuite-my-apps — JWT-verified endpoint (central login).
 * The CRM's app switcher: asks BloomSuite ID which apps the signed-in person can use. The gateway user
 * comes from the person's custom:bloomsuite identity on the verified token; the call to BloomSuite ID's
 * my-apps is signed here, server-side, so the browser never holds the app secret.
 */
import { createClient } from "@supabase/supabase-js";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { BLOOMSUITE_PROVIDER, bloomsuiteSignedHeaders } from "../_shared/bloomsuite-id.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const bloomsuiteApiUrl = (Deno.env.get("BLOOMSUITE_API_URL") ?? "").replace(/\/+$/, "");

type GatewayApp = { id: string; name: string; home_url: string | null; last_used_at: string | null };

function webAddress(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** One signed my-apps call; a same-second repeat of the same message is refused as a replay, so it waits once. */
async function askGateway(gatewayUserId: string): Promise<Response> {
  const body = JSON.stringify({ gateway_user_id: gatewayUserId });
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${bloomsuiteApiUrl}/functions/v1/my-apps`, {
      method: "POST",
      redirect: "error",
      headers: await bloomsuiteSignedHeaders(body),
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (response.status !== 409 || attempt >= 2) return response;
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req, { allowMethods: "POST, OPTIONS" });
  if (preflight) return preflight;
  const cors = buildCorsHeaders(req, { allowMethods: "POST, OPTIONS" });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "A signed-in session is required" }, 401);

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: "A signed-in session is required" }, 401);

  const identity = (data.user.identities ?? []).find((entry) => entry.provider === BLOOMSUITE_PROVIDER);
  const gatewayUserId = String(identity?.identity_data?.["sub"] ?? identity?.id ?? "");
  if (!identity || !gatewayUserId) return json({ apps: [], linked: false });
  if (!bloomsuiteApiUrl) return json({ error: "BloomSuite ID is not configured" }, 503);

  // crm-r2-F22: the switcher asks once per session; past 30 requests an hour for one account the CRM answers 429
  // without a signed call to BloomSuite ID.
  const { data: withinBudget, error: budgetError } = await admin.rpc("bloomsuite_consume_call_budget", {
    p_user_id: data.user.id,
    p_bucket: "my-apps",
    p_limit: 30,
    p_window_seconds: 3600,
  });
  if (budgetError) return json({ error: "BloomSuite ID is unavailable" }, 503);
  if (withinBudget !== true) return json({ error: "Too many app list requests. Try again later." }, 429);

  try {
    const response = await askGateway(gatewayUserId);
    if (!response.ok) return json({ error: "BloomSuite ID did not answer", status: response.status }, 502);
    const answer = (await response.json()) as { apps?: GatewayApp[] };
    const apps = (answer.apps ?? []).map((app) => ({
      id: String(app.id).slice(0, 40),
      name: String(app.name).slice(0, 80),
      home_url: webAddress(app.home_url),
      last_used_at: typeof app.last_used_at === "string" ? app.last_used_at : null,
    }));
    return json({ apps, linked: true });
  } catch {
    return json({ error: "BloomSuite ID is unavailable" }, 502);
  }
});
