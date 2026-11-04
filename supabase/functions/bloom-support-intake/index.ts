// Bloom Support intake — every "Report a problem" / support entry point lands here.
//
//   POST /report   BloomSuite CRM session (Bearer JWT), or a BloomSites / POS
//                  server request signed with its per-product secret
//   POST /public   people who cannot sign in (rate-limited, honeypot)
//
// Users never classify their request: Bloom triages it in the background.
import {
  authenticate, authenticateProduct, BloomError, cors, errorResponse, json, parseJsonObject, preflightProductAuthentication, principalForProductUser, readBodyText, readJson, rpc,
  servicePrincipal, str, type Caller,
} from "../_shared/bloom-support/runtime.ts";
import { actions } from "../_shared/bloom-support/service.ts";
import {
  decodeBase64File,
  type AttachmentFile,
  MAX_ATTACHMENT_TOTAL_BYTES,
  storeAttachment,
  validateAttachmentFile,
  validateAttachmentName,
} from "../_shared/bloom-support/attachments.ts";
import { trackingLink } from "../_shared/bloom-support/email.ts";
import { sha256Hex } from "../_shared/bloom-support/crypto.ts";
import { redactText, sanitizeContext } from "../_shared/bloom-support/policy.ts";

interface Upload { file_name?: string; content_type?: string; data_base64?: string }
interface PreparedAttachment extends AttachmentFile { digest: string }
const MAX_REPORT_JSON_BYTES = 17 * 1024 * 1024;
const MAX_PUBLIC_JSON_BYTES = 64 * 1024;
const MAX_REPORT_BODY_LENGTH = 20_000;
const MAX_PUBLIC_BODY_LENGTH = 10_000;

function requireJson(req: Request): void {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new BloomError(
      415,
      "unsupported_media_type",
      "Content-Type must be application/json",
    );
  }
}

async function prepareAttachments(uploads: unknown): Promise<PreparedAttachment[]> {
  if (uploads === undefined || uploads === null) return [];
  if (!Array.isArray(uploads)) {
    throw new BloomError(400, "invalid", "Attachments must be an array");
  }
  if (uploads.length > 5) {
    throw new BloomError(400, "invalid", "Up to 5 files can be attached");
  }
  let totalBytes = 0;
  const prepared: PreparedAttachment[] = [];
  const identities = new Set<string>();
  for (const upload of uploads as Upload[]) {
    if (!upload || typeof upload !== "object") {
      throw new BloomError(400, "invalid", "Each attachment must be an object");
    }
    const file: AttachmentFile = {
      name: validateAttachmentName(String(upload.file_name ?? "")),
      type: String(upload.content_type ?? ""),
      bytes: decodeBase64File(String(upload.data_base64 ?? "")),
    };
    validateAttachmentFile(file);
    totalBytes += file.bytes.byteLength;
    if (totalBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
      throw new BloomError(413, "too_large", "Attachments must total 12 MB or less");
    }
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(file.bytes).buffer))]
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const identity = `${digest}:${file.name}`;
    if (identities.has(identity)) {
      throw new BloomError(400, "invalid", `Attachment ${file.name} was selected more than once`);
    }
    identities.add(identity);
    prepared.push({ ...file, digest });
  }
  return prepared;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

async function intakeFingerprint(
  report: Record<string, unknown>,
  product: string,
  attachments: PreparedAttachment[],
): Promise<string> {
  const safeReport = { ...report };
  delete safeReport.attachments;
  delete safeReport.idempotency_key;
  delete safeReport.intake_fingerprint;
  return await sha256Hex(JSON.stringify(canonical({
    product,
    report: safeReport,
    attachments: attachments.map((file) => ({
      name: file.name,
      type: file.type.split(";", 1)[0].trim().toLowerCase(),
      size: file.bytes.byteLength,
      digest: file.digest,
    })),
  })));
}

async function attachAll(actor: string, ticketId: string, uploads: AttachmentFile[]): Promise<{ stored: number; failed: string[] }> {
  const failed: string[] = [];
  let stored = 0;
  for (const upload of uploads) {
    try {
      await storeAttachment(actor, ticketId, upload);
      stored++;
    } catch (error) {
      console.error("Bloom attachment storage failed", {
        ticketId,
        fileName: upload.name,
        error,
      });
      failed.push(`${upload.name}: could not be stored; attach it to your reply`);
    }
  }
  return { stored, failed };
}

async function receipt(caller: Caller, created: Record<string, unknown>, uploads: AttachmentFile[], withTracking = true) {
  const ticketId = String(created.ticket_id);
  // The intake claim binds this idempotency key to the exact report and file
  // manifest before ticket creation. Exact retries can therefore safely finish
  // a storage write interrupted after the ticket committed; storeAttachment is
  // itself digest-path idempotent and verifies any existing database row.
  const files = await attachAll(caller.principalId, ticketId, uploads);
  return {
    received: true,
    duplicate_delivery: created.duplicate_delivery === true,
    ticket_id: ticketId,
    number: created.number,
    conversation_id: created.conversation_id,
    attachments: files,
    tracking_url: withTracking ? await trackingLink(ticketId) : undefined,
  };
}

async function report(req: Request): Promise<unknown> {
  if (req.headers.get("x-bloom-product")) {
    preflightProductAuthentication(req);
    const raw = await readBodyText(req, MAX_REPORT_JSON_BYTES);
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
    if (typeof r.subject === "string" && r.subject.length > 300) {
      throw new BloomError(400, "invalid", "Subject must be 300 characters or fewer");
    }
    if (typeof r.body === "string" && r.body.length > MAX_REPORT_BODY_LENGTH) {
      throw new BloomError(400, "invalid", "Message must be 20,000 characters or fewer");
    }
    const attachments = await prepareAttachments(r.attachments);
    const fingerprint = await intakeFingerprint(
      { ...r, account_id: who.account_id },
      product,
      attachments,
    );
    const created = await actions.createTicket(
      caller,
      { ...r, product, channel: product, account_id: who.account_id },
      product,
      { intakeFingerprint: fingerprint },
    ) as Record<string, unknown>;
    return await receipt(caller, created, attachments);
  }
  const caller = await authenticate(req);
  const raw = await readBodyText(req, MAX_REPORT_JSON_BYTES);
  const r = raw ? parseJsonObject(raw) : {};
  if (typeof r.subject === "string" && r.subject.length > 300) {
    throw new BloomError(400, "invalid", "Subject must be 300 characters or fewer");
  }
  if (typeof r.body === "string" && r.body.length > MAX_REPORT_BODY_LENGTH) {
    throw new BloomError(400, "invalid", "Message must be 20,000 characters or fewer");
  }
  const attachments = await prepareAttachments(r.attachments);
  const me = await rpc<{ accounts: Array<{ id: string }>; role: string }>("whoami", { actor: caller.principalId });
  // A client's account comes from their verified membership, never the request.
  const accountId = me.role === "client" ? me.accounts[0]?.id ?? null : str(r.account_id, 40) ?? null;
  const fingerprint = await intakeFingerprint({ ...r, account_id: accountId }, "crm", attachments);
  const created = await actions.createTicket(
    caller,
    { ...r, product: str(r.product, 20) ?? "crm", channel: "crm", account_id: accountId },
    "crm",
    { intakeFingerprint: fingerprint },
  ) as Record<string, unknown>;
  return await receipt(caller, created, attachments);
}

async function publicRequest(req: Request): Promise<unknown> {
  const b = await readJson(req, MAX_PUBLIC_JSON_BYTES);
  // Honeypot: real forms leave "website" empty.
  // Keep the fake receipt contract-shaped so automated callers cannot discover
  // the trap by comparing it with a real 2xx response.
  if (str(b.website, 200)) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    return { received: true, duplicate_delivery: false, number: 900_000 + (random % 100_000), email_delivery: "pending" };
  }
  if (typeof b.email !== "string" || b.email.length > 320) {
    throw new BloomError(400, "invalid", "Email must be 320 characters or fewer");
  }
  if (typeof b.name === "string" && b.name.length > 200) {
    throw new BloomError(400, "invalid", "Name must be 200 characters or fewer");
  }
  if (typeof b.subject === "string" && b.subject.length > 300) {
    throw new BloomError(400, "invalid", "Subject must be 300 characters or fewer");
  }
  const email = b.email.trim().toLowerCase();
  const rawBody = b.body ?? b.message;
  if (typeof rawBody === "string" && rawBody.length > MAX_PUBLIC_BODY_LENGTH) {
    throw new BloomError(400, "invalid", "Message must be 10,000 characters or fewer");
  }
  const body = typeof rawBody === "string" ? redactText(rawBody.trim()) : undefined;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BloomError(400, "invalid", "A valid email address is required");
  if (!body || body.length < 10) throw new BloomError(400, "invalid", "Tell us a little more (at least 10 characters)");
  const subject = redactText(str(b.subject, 300) ?? "");
  const publicContext = sanitizeContext({
    page_url: str(b.page_url, 1000),
    user_agent: req.headers.get("user-agent")?.slice(0, 300),
  });
  if (typeof publicContext.page_url === "string") {
    try {
      const page = new URL(publicContext.page_url);
      page.search = "";
      page.hash = "";
      publicContext.page_url = page.toString();
    } catch {
      delete publicContext.page_url;
    }
  }
  const attachments = await prepareAttachments(b.attachments);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const hour = new Date().toISOString().slice(0, 13);
  const limits = (await rpc<Record<string, number> | null>("setting", { key: "limits" })) ?? {};
  const intake = await servicePrincipal("intake");
  const sender = await rpc<{ principal_id: string; account_id: string | null }>("resolve_email_sender", { email, name: str(b.name, 200) ?? null });
  const suppliedPublicKey = str(b.idempotency_key, 200);
  const publicKey = suppliedPublicKey
    ? `public:${await sha256Hex(email)}:${suppliedPublicKey}`
    : undefined;
  const fingerprint = await intakeFingerprint({
    name: str(b.name, 200) ?? null,
    email,
    product: ["cms", "crm", "pos"].includes(String(b.product)) ? b.product : "unknown",
    subject,
    body,
    context: publicContext,
    account_id: sender.account_id,
    requester_id: sender.principal_id,
  }, "public", attachments);
  const created = await rpc<Record<string, unknown>>("create_ticket", {
    actor: intake.principalId,
    ticket: {
      product: ["cms", "crm", "pos"].includes(String(b.product)) ? b.product : "unknown",
      channel: "public",
      subject,
      body,
      account_id: sender.account_id,
      requester_id: sender.principal_id,
      intake_fingerprint: fingerprint,
      context: publicContext,
      dedupe_key: publicKey ?? null,
      public_rate: {
        email_bucket: `public-email:${day}`,
        email_subject: await sha256Hex(email),
        email_limit: Number(limits.public_tickets_per_email_per_day ?? 5),
        ip_bucket: `public-ip:${hour}`,
        ip_subject: await sha256Hex(ip),
        ip_limit: 20,
      },
      email: { reply_to: email },
    },
  });
  // Attachments are stored under the intake identity; the requester can still see them on their ticket.
  // The submitter has proven nothing about the address they typed, so the tracking link goes only
  // to that inbox (in the acknowledgement email), never back to whoever filled in the form.
  const r = await receipt({ ...intake }, created, attachments, false);
  return { received: r.received, duplicate_delivery: r.duplicate_delivery, number: r.number, attachments: r.attachments, email_delivery: "pending" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const path = new URL(req.url).pathname.replace(/^.*\/bloom-support-intake/, "") || "/";
  try {
    if (req.method === "POST" && path === "/report") {
      requireJson(req);
      return json(req, await report(req), 201);
    }
    if (req.method === "POST" && path === "/public") {
      requireJson(req);
      return json(req, await publicRequest(req), 201);
    }
    throw new BloomError(404, "not_found", "Use POST /report or POST /public");
  } catch (e) {
    return errorResponse(req, e);
  }
});
