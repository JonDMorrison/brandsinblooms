// Bloom Support intake — every "Report a problem" / support entry point lands here.
//
//   POST /report   BloomSuite CRM session (Bearer JWT), or a BloomSites / POS
//                  server request signed with its per-product secret
//   POST /public   people who cannot sign in (rate-limited, honeypot)
//
// Users never classify their request: Bloom triages it in the background.
import {
  authenticate, authenticateProduct, BloomError, cors, errorResponse, json, principalForProductUser, readJson, rpc,
  servicePrincipal, str, type Caller,
} from "../_shared/bloom-support/runtime.ts";
import { actions } from "../_shared/bloom-support/service.ts";
import { decodeBase64File, storeAttachment } from "../_shared/bloom-support/attachments.ts";
import { trackingLink } from "../_shared/bloom-support/email.ts";
import { sha256Hex } from "../_shared/bloom-support/crypto.ts";

interface Upload { file_name?: string; content_type?: string; data_base64?: string }

async function attachAll(actor: string, ticketId: string, uploads: unknown): Promise<{ stored: number; failed: string[] }> {
  const failed: string[] = [];
  let stored = 0;
  for (const u of (Array.isArray(uploads) ? uploads : []).slice(0, 5) as Upload[]) {
    try {
      await storeAttachment(actor, ticketId, { name: String(u.file_name ?? "screenshot.png"), type: String(u.content_type ?? ""), bytes: decodeBase64File(String(u.data_base64 ?? "")) });
      stored++;
    } catch (e) {
      failed.push(`${u.file_name ?? "file"}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { stored, failed };
}

async function receipt(caller: Caller, created: Record<string, unknown>, uploads: unknown) {
  const ticketId = String(created.ticket_id);
  const files = created.duplicate_delivery ? { stored: 0, failed: [] } : await attachAll(caller.principalId, ticketId, uploads);
  return {
    received: true,
    duplicate_delivery: created.duplicate_delivery === true,
    ticket_id: ticketId,
    number: created.number,
    conversation_id: created.conversation_id,
    attachments: files,
    tracking_url: await trackingLink(ticketId),
  };
}

async function report(req: Request): Promise<unknown> {
  const raw = await req.text();
  if (raw.length > 25_000_000) throw new BloomError(413, "too_large", "Report too large");
  if (req.headers.get("x-bloom-product")) {
    const { product, payload } = await authenticateProduct(req, raw);
    const identity = (payload.identity ?? {}) as Record<string, unknown>;
    const who = await principalForProductUser({
      product,
      external_user_id: String(identity.external_user_id ?? ""),
      email: str(identity.email, 320) ?? null,
      name: str(identity.name, 200) ?? null,
      external_account_id: str(identity.external_account_id, 200) ?? null,
      account_name: str(identity.account_name, 200) ?? null,
    });
    const caller: Caller = { principalId: who.principal_id, role: "client", via: "product_intake", scopes: [] };
    const r = (payload.report ?? {}) as Record<string, unknown>;
    const created = await actions.createTicket(caller, { ...r, product, channel: product, account_id: who.account_id }, product) as Record<string, unknown>;
    return await receipt(caller, created, r.attachments);
  }
  const caller = await authenticate(req);
  const r = JSON.parse(raw || "{}") as Record<string, unknown>;
  const me = await rpc<{ accounts: Array<{ id: string }>; role: string }>("whoami", { actor: caller.principalId });
  // A client's account comes from their verified membership, never the request.
  const accountId = me.role === "client" ? me.accounts[0]?.id ?? null : str(r.account_id, 40) ?? null;
  const created = await actions.createTicket(caller, { ...r, product: str(r.product, 20) ?? "crm", channel: "crm", account_id: accountId }, "crm") as Record<string, unknown>;
  return await receipt(caller, created, r.attachments);
}

async function publicRequest(req: Request): Promise<unknown> {
  const b = await readJson(req, 12_000_000);
  // Honeypot: real forms leave "website" empty.
  if (str(b.website, 200)) return { received: true };
  const email = str(b.email, 320)?.trim().toLowerCase();
  const body = str(b.body ?? b.message, 10000)?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BloomError(400, "invalid", "A valid email address is required");
  if (!body || body.length < 10) throw new BloomError(400, "invalid", "Tell us a little more (at least 10 characters)");
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const hour = new Date().toISOString().slice(0, 13);
  const limits = (await rpc<Record<string, number> | null>("setting", { key: "limits" })) ?? {};
  const perEmail = await rpc<boolean>("consume_usage", { bucket: `public-email:${day}`, subject: await sha256Hex(email), limit: Number(limits.public_tickets_per_email_per_day ?? 5) });
  const perIp = await rpc<boolean>("consume_usage", { bucket: `public-ip:${hour}`, subject: await sha256Hex(ip), limit: 20 });
  if (!perEmail || !perIp) throw new BloomError(429, "rate_limited", "Too many requests — please email us instead or try again later");

  const intake = await servicePrincipal("intake");
  const sender = await rpc<{ principal_id: string; account_id: string | null }>("resolve_email_sender", { email, name: str(b.name, 200) ?? null });
  const created = await rpc<Record<string, unknown>>("create_ticket", {
    actor: intake.principalId,
    ticket: {
      product: ["cms", "crm", "pos"].includes(String(b.product)) ? b.product : "unknown",
      channel: "public",
      subject: str(b.subject, 300) ?? "",
      body,
      account_id: sender.account_id,
      requester_id: sender.principal_id,
      context: { page_url: str(b.page_url, 1000), user_agent: req.headers.get("user-agent")?.slice(0, 300) },
      dedupe_key: str(b.idempotency_key, 200) ? `public:${await sha256Hex(email)}:${b.idempotency_key}` : null,
      email: { reply_to: email },
    },
  });
  // Attachments are stored under the intake identity; the requester can still see them on their ticket.
  return await receipt({ ...intake }, created, b.attachments);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const path = new URL(req.url).pathname.replace(/^.*\/bloom-support-intake/, "") || "/";
  try {
    if (req.method === "POST" && path === "/report") return json(req, await report(req), 201);
    if (req.method === "POST" && path === "/public") return json(req, await publicRequest(req), 201);
    throw new BloomError(404, "not_found", "Use POST /report or POST /public");
  } catch (e) {
    return errorResponse(req, e);
  }
});
