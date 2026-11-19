/**
 * bloomsuite-deletion-notices — the CRM's collector for BloomSuite ID's deletion notices (central login 36/R-01,
 * gateway contract 39-D7). Run every 10 minutes by the database scheduler (bloomsuite_private.
 * invoke_deletion_notice_worker), which sends the worker token in X-BloomSuite-Notice-Worker. It collects this app's
 * notices with a signed call, applies each one (public.bloomsuite_apply_deletion_notice: ends the linked CRM
 * account's sessions, removes its BloomSuite identity and records it as previously linked), and acknowledges only
 * the notices it applied; a failed one is collected again next time. Nothing here reads a request body.
 */
import { createClient } from "@supabase/supabase-js";

import { bloomsuiteSignedHeaders } from "../_shared/bloomsuite-id.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const bloomsuiteApiUrl = (Deno.env.get("BLOOMSUITE_API_URL") ?? "").replace(/\/+$/, "");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** True only for the scheduler's token (at least 32 bytes), compared in constant time. */
function isWorker(headers: Headers): boolean {
  const expected = encoder.encode(Deno.env.get("BLOOMSUITE_NOTICE_WORKER_TOKEN") ?? "");
  const given = encoder.encode(headers.get("X-BloomSuite-Notice-Worker") ?? "");
  if (expected.byteLength < 32 || given.byteLength !== expected.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < expected.byteLength; i++) diff |= expected[i] ^ given[i];
  return diff === 0;
}

async function callGateway(body: Record<string, unknown>): Promise<unknown> {
  const raw = JSON.stringify(body);
  const response = await fetch(`${bloomsuiteApiUrl}/functions/v1/deletion-notices`, {
    method: "POST",
    headers: await bloomsuiteSignedHeaders(raw),
    body: raw,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`BloomSuite ID answered ${response.status}`);
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isWorker(req.headers)) return json({ error: "unauthorized" }, 401);
  if (!bloomsuiteApiUrl) return json({ error: "BloomSuite ID address unavailable" }, 500);

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let notices: Array<{ id?: unknown; gateway_user_id?: unknown }> = [];
  try {
    const collected = (await callGateway({ op: "collect", limit: 100 })) as { notices?: unknown };
    notices = Array.isArray(collected.notices) ? collected.notices : [];
  } catch (error) {
    console.warn("BloomSuite deletion notices: collect failed", { reason: error instanceof Error ? error.message : "unknown" });
    return json({ error: "collect_failed" }, 502);
  }

  const applied: string[] = [];
  let linked = 0;
  for (const notice of notices) {
    const id = typeof notice.id === "string" ? notice.id : null;
    const gatewayUserId = typeof notice.gateway_user_id === "string" ? notice.gateway_user_id : null;
    if (!id || !gatewayUserId || !uuid.test(gatewayUserId)) continue;
    const { data, error } = await admin.rpc("bloomsuite_apply_deletion_notice", {
      p_gateway_user_id: gatewayUserId,
      p_notice_id: id,
    });
    if (error) {
      console.warn("BloomSuite deletion notice not applied; it will be collected again", { notice: id });
      continue;
    }
    if ((data as { linked?: boolean } | null)?.linked) linked += 1;
    applied.push(id);
  }

  let acknowledged = 0;
  if (applied.length > 0) {
    try {
      const ack = (await callGateway({ op: "ack", ids: applied })) as { acknowledged?: unknown };
      acknowledged = typeof ack.acknowledged === "number" ? ack.acknowledged : 0;
    } catch (error) {
      console.warn("BloomSuite deletion notices: acknowledge failed", { reason: error instanceof Error ? error.message : "unknown" });
      return json({ collected: notices.length, applied: applied.length, linked, acknowledged: 0, error: "ack_failed" }, 502);
    }
  }
  return json({ collected: notices.length, applied: applied.length, linked, acknowledged });
});
