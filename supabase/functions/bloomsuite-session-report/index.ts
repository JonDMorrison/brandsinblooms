/**
 * bloomsuite-session-report — JWT-verified endpoint (central login).
 * The signed-in CRM user reports their own session (sign_in, active or sign_out) to BloomSuite ID.
 * The gateway user comes from the user's custom:bloomsuite identity and the session from the verified
 * access token; nothing about identity is taken from the body. The first report after an account's
 * first BloomSuite link also runs the first-link step (decision 25).
 */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  BLOOMSUITE_PROVIDER,
  bloomsuiteSignedHeaders,
  deviceLabel,
  readCappedBody,
} from "../_shared/bloomsuite-id.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const bloomsuiteApiUrl = (Deno.env.get("BLOOMSUITE_API_URL") ?? "").replace(/\/+$/, "");
const EVENTS = new Set(["sign_in", "active", "sign_out"]);
// crm-r2-F22: signed reports per session. The browser sends sign_in once, active every 15 minutes and sign_out
// once; anything beyond these budgets is answered 429 without a signed call to BloomSuite ID.
const REPORT_BUDGETS: Record<string, { limit: number; windowSeconds: number }> = {
  sign_in: { limit: 5, windowSeconds: 3600 },
  active: { limit: 1, windowSeconds: 300 },
  sign_out: { limit: 3, windowSeconds: 3600 },
};

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1] ?? "";
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sessionIdFromJwt(token: string): string | null {
  const sessionId = jwtPayload(token)?.["session_id"];
  return typeof sessionId === "string" && sessionId ? sessionId : null;
}

/** True when this session was made by an OAuth sign-in (the token's amr), the only way in through BloomSuite. */
function signedInWithOAuth(token: string): boolean {
  const amr = jwtPayload(token)?.["amr"];
  return Array.isArray(amr) && amr.some((entry) => (entry as { method?: unknown })?.method === "oauth");
}

/**
 * Decision 25, first link: when an account that already had a CRM password first signs in through
 * BloomSuite ID, its password becomes a random value nobody knows and its other sessions end, in one
 * database call, once per account. It runs only from the session the BloomSuite sign-in made, so a
 * session opened with the old password can't use it to end the real owner's session. Since crm-r2-F21 the
 * database runs the same step when Auth links the identity; this call is the idempotent fallback.
 */
async function completeFirstLink(
  admin: SupabaseClient,
  user: User,
  token: string,
  sessionId: string,
): Promise<"done" | "not_needed" | "failed"> {
  if (!(user.identities ?? []).some((identity) => identity.provider === "email")) return "not_needed";
  if (!signedInWithOAuth(token)) return "not_needed";
  const { error } = await admin.rpc("bloomsuite_complete_first_link", {
    p_user_id: user.id,
    p_keep_session_id: sessionId,
  });
  return error ? "failed" : "done";
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req, { allowMethods: "POST, OPTIONS" });
  if (preflight) return preflight;
  const cors = buildCorsHeaders(req, { allowMethods: "POST, OPTIONS" });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // The body is one small field; anything larger is refused before it is read.
  const raw = await readCappedBody(req, 1024);
  if (raw === null) return json({ error: "Request too large" }, 413);
  let event = "";
  try {
    const parsed = JSON.parse(raw) as { event?: unknown };
    event = typeof parsed.event === "string" ? parsed.event : "";
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!EVENTS.has(event)) return json({ error: "event must be sign_in, active or sign_out" }, 400);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const sessionId = sessionIdFromJwt(token);
  if (!token || !sessionId) return json({ error: "A signed-in session is required" }, 401);

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: "A signed-in session is required" }, 401);

  const identity = (data.user.identities ?? []).find((entry) => entry.provider === BLOOMSUITE_PROVIDER);
  const gatewayUserId = String(identity?.identity_data?.["sub"] ?? identity?.id ?? "");
  if (!identity || !gatewayUserId) return json({ reported: false, reason: "not_linked" });
  if (event !== "sign_out" && (await completeFirstLink(admin, data.user, token, sessionId)) === "failed") {
    return json({ error: "The first BloomSuite sign-in could not finish" }, 500);
  }
  if (!bloomsuiteApiUrl) return json({ error: "BloomSuite ID is not configured" }, 503);

  const budget = REPORT_BUDGETS[event];
  const { data: withinBudget, error: budgetError } = await admin.rpc("bloomsuite_consume_call_budget", {
    p_user_id: data.user.id,
    p_bucket: `${event}:${sessionId}`,
    p_limit: budget.limit,
    p_window_seconds: budget.windowSeconds,
  });
  if (budgetError) return json({ error: "BloomSuite ID is unavailable" }, 503);
  if (withinBudget !== true) return json({ error: "Too many session reports. Try again later." }, 429);

  const userAgent = (req.headers.get("User-Agent") ?? "").slice(0, 400);
  const report = JSON.stringify({
    event,
    gateway_user_id: gatewayUserId,
    app_user_id: data.user.id,
    app_session_id: sessionId,
    device_label: deviceLabel(userAgent),
    user_agent: userAgent || null,
    occurred_at: new Date().toISOString(),
  });
  try {
    const response = await fetch(`${bloomsuiteApiUrl}/functions/v1/session-report`, {
      method: "POST",
      redirect: "error",
      headers: await bloomsuiteSignedHeaders(report),
      body: report,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return json({ error: "BloomSuite ID did not accept the report", status: response.status }, 502);
    }
  } catch {
    return json({ error: "BloomSuite ID is unavailable" }, 502);
  }
  return json({ reported: true });
});
