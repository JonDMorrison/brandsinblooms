// Bloom Support — the public tracking page's server side (/support/track/:token).
//
// Unauthenticated: the 192-bit token from the "Track this request" email link
// is the only credential, and it is only ever handled as its SHA-256 hash.
// Every call goes to public.bloom_support_track (service role only), which
// resolves the hash to ONE ticket, projects it for the client, rate-limits
// writes per link and per IP, and runs writes as the ticket's requester through
// the same add_message / client_action rules as email and the portal.
// sanitizeTrackView then rebuilds the response from an allow-list.
import { BloomError, type Caller, db, readJson, servicePrincipal } from "./runtime.ts";
import { sha256Hex } from "./crypto.ts";
import { type AttachmentFile, decodeBase64File, storeAttachment } from "./attachments.ts";
import { sendSupportEmail, subjectFor, trackingLink } from "./email.ts";
import { type ClientBrand, clientLogoUrl, clientWebsite } from "./botanical-email.ts";
import { clientBrand } from "./client-brand-loader.ts";
import {
  isTrackToken,
  sanitizeTrackView,
  TRACK_MAX_REQUEST_BYTES,
  type TrackResponse,
  type TrackView,
  validateTrackReply,
} from "../../../../src/lib/bloomSupport/trackView.ts";

/** Headers for every tracking response: private, never cached, never indexed, never leaks the URL. */
export const TRACK_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
};

type TrackOp = "view" | "reply" | "action" | "attachment" | "renew";
export type TrackRpc = (op: TrackOp, hash: string, payload: Record<string, unknown>) => Promise<unknown>;
export type AttachmentStore = (actor: string, ticketId: string, file: AttachmentFile, opts: { messageId: string; visibility: "public" }) => Promise<unknown>;

function mapError(e: { code?: string; message?: string }): BloomError {
  // Messages raised by bloom_support_track are written for the person on the page.
  const msg = (e.message ?? "").replace(/^(not_found|invalid|forbidden|rate_limited):\s*/, "");
  switch (e.code) {
    case "P0002": return new BloomError(404, "not_found", "This link has expired or does not exist");
    case "42501": return new BloomError(403, "forbidden", msg || "This request can't be changed from this page");
    case "22023": case "22P02": return new BloomError(400, "invalid", msg || "That wasn't quite right");
    case "54000": return new BloomError(429, "rate_limited", msg || "Please wait a little and try again");
    case "23505": return new BloomError(409, "conflict", "This message was already sent with different text");
    default:
      console.error("bloom-support track", e.code, e.message);
      return new BloomError(503, "unavailable", "Bloom Support is briefly unavailable. Please try again in a minute.");
  }
}

export const trackRpc: TrackRpc = async (op, hash, payload) => {
  const { data, error } = await db().rpc("bloom_support_track", { p_op: op, p_hash: hash, p: payload });
  if (error) throw mapError(error);
  return data;
};

const tokenHash = async (token: string): Promise<string> => {
  if (!isTrackToken(token)) throw new BloomError(404, "not_found", "This link has expired or does not exist");
  return await sha256Hex(token);
};

/** A per-IP rate-limit subject that never stores the address itself. */
export async function clientIpKey(req: Request): Promise<string> {
  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return ip ? (await sha256Hex(`bloom-track-ip:${ip}`)).slice(0, 32) : "unknown";
}

export type BrandLookup = (account: { id: string; name: string }) => Promise<ClientBrand | null>;

let automation: Promise<Caller> | null = null;
/** Same records and cache as the support emails; never waits more than 2.5 s for the page. */
const defaultBrand: BrandLookup = (account) => {
  automation ??= servicePrincipal("automation");
  const lookup = automation.then((actor) => clientBrand(actor, account)).catch(() => null);
  return Promise.race([lookup, new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))]);
};

/**
 * The database names the ticket's own account in `_account`; its website and
 * logo come from our stored records via the shared loader and are re-validated
 * with clientWebsite / clientLogoUrl (https, our own logo hosts). `_account`
 * never leaves the server: sanitizeTrackView only copies allow-listed fields.
 */
async function withBrand(raw: unknown, brand: BrandLookup): Promise<unknown> {
  if (typeof raw !== "object" || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  const acct = r._account as { id?: unknown; name?: unknown } | null | undefined;
  if (!acct || typeof acct.id !== "string" || typeof acct.name !== "string") return raw;
  const b = await brand({ id: acct.id, name: acct.name }).catch(() => null);
  return {
    ...r,
    company: { name: acct.name, website: clientWebsite(b?.website)?.href ?? null, logo_url: clientLogoUrl(b?.logoUrl) || null },
  };
}

export async function viewTicket(token: string, call: TrackRpc = trackRpc, brand: BrandLookup = defaultBrand): Promise<TrackResponse> {
  const view = sanitizeTrackView(await withBrand(await call("view", await tokenHash(token), {}), brand));
  if (!view) throw new BloomError(404, "not_found", "This link has expired or does not exist");
  return view;
}

async function liveView(hash: string, call: TrackRpc, brand: BrandLookup = defaultBrand): Promise<TrackView | null> {
  const view = sanitizeTrackView(await withBrand(await call("view", hash, {}), brand));
  return view && view.state === "ok" ? view : null;
}

export async function replyToTicket(
  req: Request,
  token: string,
  call: TrackRpc = trackRpc,
  store: AttachmentStore = storeAttachment,
): Promise<{ message_id: string; duplicate: boolean; attachments: number; view: TrackView | null }> {
  const hash = await tokenHash(token);
  const checked = validateTrackReply(await readJson(req, TRACK_MAX_REQUEST_BYTES));
  if ("error" in checked) throw new BloomError(400, "invalid", checked.error);
  const { body, idempotency_key, attachments } = checked.value;
  // Decode before writing anything so a bad file never leaves a half-sent reply.
  const files = attachments.map((f) => ({ name: f.file_name, type: f.content_type, bytes: decodeBase64File(f.data_base64) }));
  const out = await call("reply", hash, { body, idempotency_key, ip: await clientIpKey(req) }) as {
    message_id: string; duplicate: boolean; ticket_id: string; actor: string;
  };
  // Files are stored as the requester, on their message, through the normal intake checks
  // (type sniffing, size, can_attach). Retries reuse the deterministic storage path.
  for (const file of files) {
    await store(out.actor, out.ticket_id, file, { messageId: out.message_id, visibility: "public" });
  }
  return { message_id: out.message_id, duplicate: out.duplicate === true, attachments: files.length, view: await liveView(hash, call) };
}

export async function actOnTicket(req: Request, token: string, call: TrackRpc = trackRpc): Promise<{ ok: true; view: TrackView | null }> {
  const hash = await tokenHash(token);
  const b = await readJson(req, 64 * 1024);
  const action = b.action;
  if (action !== "confirm_resolved" && action !== "still_broken") throw new BloomError(400, "invalid", "Unknown action");
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length > 5000) throw new BloomError(400, "invalid", "Messages can be up to 5,000 characters.");
  await call("action", hash, { action, message, ip: await clientIpKey(req) });
  return { ok: true, view: await liveView(hash, call) };
}

export async function attachmentLink(token: string, attachmentId: string, call: TrackRpc = trackRpc): Promise<{ url: string; file_name: string }> {
  const hash = await tokenHash(token);
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) throw new BloomError(404, "not_found", "File not found");
  const a = await call("attachment", hash, { attachment_id: attachmentId }) as { bucket: string; path: string; file_name: string };
  const { data, error } = await db().storage.from(a.bucket).createSignedUrl(a.path, 300, { download: a.file_name });
  if (error || !data) throw new BloomError(502, "storage_error", "This file can't be opened right now");
  return { url: data.signedUrl, file_name: a.file_name };
}

/**
 * "Send me a new link" from an expired link. The answer is the same whether or
 * not anything was sent, and the fresh link only ever goes to the requester's
 * own address on file — never to an address typed on the page.
 */
export async function renewLink(req: Request, token: string, call: TrackRpc = trackRpc): Promise<{ ok: true }> {
  if (!isTrackToken(token)) return { ok: true };
  const hash = await sha256Hex(token);
  const found = await call("renew", hash, { ip: await clientIpKey(req) }) as { ticket_id: string; number: number; subject: string; email: string } | null;
  if (!found) return { ok: true };
  const link = await trackingLink(found.ticket_id);
  const hour = new Date().toISOString().slice(0, 13);
  await sendSupportEmail({
    ticketId: found.ticket_id,
    purpose: "notification",
    to: found.email,
    subject: subjectFor(found.number, found.subject),
    text: `Here is a fresh link to follow request #${found.number}:\n\n${link}\n\n` +
      `You asked for this because your previous link had expired. If that wasn't you, you can ignore this email.\n\n` +
      `You can also reply to this email at any time to add something to the request.\n\n— Bloom Support`,
    idempotencyKey: `track-renew:${found.ticket_id}:${hour}`,
    bloomInitiated: false,
    toClient: true,
  });
  return { ok: true };
}
