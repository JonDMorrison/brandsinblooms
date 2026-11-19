/**
 * bloomsuite-revoke — signed server-to-server endpoint (central login).
 * BloomSuite ID asks the CRM to end one session (app_session_id), every session of one CRM user (app_user_id with
 * all: true), or every session of the CRM account linked to one BloomSuite ID user (gateway_user_id with all: true,
 * for an account that never reported a sign-in: 37/R-01, gateway contract 39-D8). The X-BloomSuite-Signature HMAC is
 * verified before any data access; the body must be a BloomSuite ID command ("_from": "gateway", 50/R-01), and each
 * signed request is accepted once (46/R-01): the identical request delivered again inside its 300-second window
 * answers 409. Sessions end through bloomsuite_private.end_sessions (refresh tokens, then auth.sessions). Unknown
 * fields are ignored.
 */
import { createClient } from "@supabase/supabase-js";

import { readCappedBody, verifyBloomsuiteRequest } from "../_shared/bloomsuite-id.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  // BloomSuite ID's calls are a few hundred bytes; anything larger is refused before it is read.
  const raw = await readCappedBody(req, 4 * 1024);
  if (raw === null) return json({ error: "Request too large" }, 413);
  if (!(await verifyBloomsuiteRequest(req.headers, raw))) return json({ error: "unauthorized" }, 401);

  let body: { app_session_id?: unknown; app_user_id?: unknown; gateway_user_id?: unknown; all?: unknown; _from?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  // Only BloomSuite ID's commands (50/R-01). The CRM signs its own calls to BloomSuite ID with the same secret, and
  // its session report carries app_session_id; BloomSuite ID marks every gateway-to-app body "_from": "gateway"
  // (gatewayBody), which the CRM's own bodies never carry. Same rule as the CMS receiver (cms-r1-F51).
  if (body === null || typeof body !== "object" || body._from !== "gateway") return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // One use per signed request (46/R-01). The signature covers the timestamp and the body, so a retry from
  // BloomSuite ID (a new timestamp) is a new message; only the identical request is refused.
  const { data: accepted, error: receiptError } = await admin.rpc("bloomsuite_accept_signed_call", {
    p_signature_sha256: await sha256Hex(req.headers.get("X-BloomSuite-Signature") ?? ""),
    p_signed_at: new Date(Number(req.headers.get("X-BloomSuite-Timestamp")) * 1000).toISOString(),
  });
  if (receiptError) return json({ error: "Sessions could not be ended" }, 500);
  if (accepted !== true) return json({ error: "replayed" }, 409);

  const sessionId = typeof body.app_session_id === "string" ? body.app_session_id : null;
  const userId = typeof body.app_user_id === "string" && body.all === true ? body.app_user_id : null;
  // Only when neither CRM id is sent: the BloomSuite ID user, resolved through the CRM's stored link.
  const gatewayUserId =
    sessionId === null && userId === null && typeof body.gateway_user_id === "string" && body.all === true
      ? body.gateway_user_id
      : null;

  if (gatewayUserId !== null) {
    if (!uuid.test(gatewayUserId)) {
      return json({ error: "Send app_session_id, or app_user_id or gateway_user_id with all: true" }, 400);
    }
    const { data, error } = await admin.rpc("bloomsuite_end_sessions_for_gateway_user", {
      p_gateway_user_id: gatewayUserId,
    });
    if (error) return json({ error: "Sessions could not be ended" }, 500);
    return json({ revoked: typeof data === "number" ? data : 0 });
  }

  if ((sessionId === null) === (userId === null) || !uuid.test(sessionId ?? userId ?? "")) {
    return json({ error: "Send app_session_id, or app_user_id or gateway_user_id with all: true" }, 400);
  }

  const { data, error } = await admin.rpc("bloomsuite_end_sessions", { p_session_id: sessionId, p_user_id: userId });
  if (error) return json({ error: "Sessions could not be ended" }, 500);
  return json({ revoked: typeof data === "number" ? data : 0 });
});
