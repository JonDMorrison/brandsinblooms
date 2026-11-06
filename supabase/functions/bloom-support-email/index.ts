// Bloom Support inbound email — Resend `email.received` webhook.
//
// Incoming email is untrusted evidence. It can open or update a ticket for
// the sender; it can never grant permissions, run operations, reveal internal
// notes or change policy. Sender identity is matched to accounts only through
// verified memberships or registered account domains (unverified), and a
// staff address in From: is never treated as staff authority.
import { BloomError, directRpc, env, errorResponse, json, readBodyText, readResponseBytes, readResponseText, rpc, servicePrincipal } from "../_shared/bloom-support/runtime.ts";
import { verifySvix, sha256Hex, toHex } from "../_shared/bloom-support/crypto.ts";
import { indicatesStillBroken, isAutomatedEmail, parseAddress, parseReferences, redactText, stripQuotedReply, ticketNumberFromSubject } from "../_shared/bloom-support/policy.ts";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
  storeAttachment,
  validateAttachmentFile,
  validateAttachmentMetadata,
  type AttachmentFile,
} from "../_shared/bloom-support/attachments.ts";
import { emailConfig } from "../_shared/bloom-support/email.ts";
import { alignedWith, binaryString, rawFromAddress, verifiedDkimDomains } from "../_shared/bloom-support/dkim.ts";
import { bloomAttachmentRejection } from "../_shared/bloom-support/voice.ts";

interface ReceivedEmail {
  id: string;
  from: string;
  to: string[] | string;
  subject: string;
  text?: string | null;
  html?: string | null;
  message_id?: string | null;
  headers?: Record<string, string> | Array<{ name: string; value: string }>;
  attachments?: Array<{ id: string; filename: string; content_type: string; size?: number; download_url?: string }>;
  raw?: { download_url?: string } | null;
}

function headerMap(h: ReceivedEmail["headers"]): Record<string, string> {
  if (!h) return {};
  if (Array.isArray(h)) {
    // Repeated headers: keep the first occurrence.
    const out: Record<string, string> = {};
    for (const x of h) { const k = x.name.toLowerCase(); if (!(k in out)) out[k] = x.value; }
    return out;
  }
  return Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), String(v)]));
}

function htmlToText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

async function resend(path: string): Promise<unknown> {
  const key = env("RESEND_API_KEY");
  if (!key) throw new BloomError(503, "not_configured", "RESEND_API_KEY is not set");
  const res = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new BloomError(502, "provider_error", `Resend ${path} returned ${res.status}`);
  const raw = await readResponseText(res, 1_000_000);
  try {
    return JSON.parse(raw);
  } catch {
    throw new BloomError(502, "provider_error", "Resend returned invalid JSON");
  }
}

/** The original message as received, for DKIM verification (capped at 10 MB). */
async function rawMessage(url: string): Promise<string | null> {
  if (!/^https:\/\//.test(url)) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!res.ok) return null;
  const bytes = await readResponseBytes(res, 10_000_000);
  return binaryString(new Uint8Array(bytes).buffer);
}

interface PreparedInboundAttachment extends AttachmentFile {
  sha256: string;
}

interface PreparedInboundAttachments {
  accepted: PreparedInboundAttachment[];
  rejected: string[];
}

const safeAttachmentLabel = (value: unknown, index: number) => {
  const raw = typeof value === "string" ? value : "";
  const safe = [...raw]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return character === "\\" || character === "/" || point < 32 || point === 127 ? "_" : character;
    })
    .join("")
    .trim()
    .slice(0, 120);
  return safe || `attachment ${index + 1}`;
};

/** Download and validate the complete inbound manifest before ticket finalization. */
async function prepareInboundAttachments(
  manifest: ReceivedEmail["attachments"],
): Promise<PreparedInboundAttachments> {
  const accepted: PreparedInboundAttachment[] = [];
  const rejected: string[] = [];
  let total = 0;
  for (const [index, attachment] of (manifest ?? []).entries()) {
    const label = safeAttachmentLabel(attachment?.filename, index);
    if (index >= 5) {
      rejected.push(`${label}: only 5 attachments can be accepted`);
      continue;
    }
    if (!attachment || !attachment.download_url || !/^https:\/\//i.test(attachment.download_url)) {
      rejected.push(`${label}: the email provider did not supply a safe download`);
      continue;
    }
    let metadata: { fileName: string; contentType: string };
    try {
      metadata = validateAttachmentMetadata(attachment.filename, attachment.content_type);
    } catch (error) {
      if (error instanceof BloomError && error.status < 500) {
        rejected.push(`${label}: unsupported attachment name or type`);
        continue;
      }
      throw error;
    }
    if (typeof attachment.size === "number" && attachment.size > MAX_ATTACHMENT_BYTES) {
      rejected.push(`${label}: files must be 8 MB or smaller`);
      continue;
    }

    let response: Response;
    try {
      response = await fetch(attachment.download_url, {
        signal: AbortSignal.timeout(20_000),
        redirect: "error",
      });
    } catch (error) {
      throw new BloomError(502, "provider_error", `Could not download inbound attachment: ${error instanceof Error ? error.name : "network error"}`);
    }
    if (!response.ok) {
      throw new BloomError(502, "provider_error", `Attachment provider returned ${response.status}`);
    }

    let bytes: Uint8Array;
    try {
      bytes = await readResponseBytes(response, MAX_ATTACHMENT_BYTES);
    } catch (error) {
      if (error instanceof BloomError && error.status === 413) {
        rejected.push(`${label}: files must be 8 MB or smaller`);
        continue;
      }
      throw error;
    }
    const file: AttachmentFile = {
      name: metadata.fileName,
      type: metadata.contentType,
      bytes,
    };
    try {
      validateAttachmentFile(file);
    } catch (error) {
      if (error instanceof BloomError && error.status < 500) {
        rejected.push(`${label}: contents did not match an accepted file type`);
        continue;
      }
      throw error;
    }
    if (total + bytes.byteLength > MAX_ATTACHMENT_TOTAL_BYTES) {
      rejected.push(`${label}: attachments must total 12 MB or less`);
      continue;
    }
    total += bytes.byteLength;
    accepted.push({
      ...file,
      sha256: toHex(await crypto.subtle.digest("SHA-256", bytes as BufferSource)),
    });
  }
  return { accepted, rejected };
}

async function loadEmail(data: Record<string, unknown>): Promise<ReceivedEmail> {
  const id = String(data.email_id ?? data.id ?? "");
  if (!id) throw new BloomError(400, "invalid", "email_id missing");
  // Webhook payloads carry metadata; the body and headers come from the Receiving API.
  const full = (data.text || data.html) ? data : await resend(`/emails/receiving/${encodeURIComponent(id)}`);
  const e = full as Record<string, unknown>;
  let attachments = e.attachments as ReceivedEmail["attachments"];
  if ((!attachments || attachments.some((a) => !a.download_url)) && Array.isArray(data.attachments) && data.attachments.length) {
    const list = await resend(`/emails/receiving/${encodeURIComponent(id)}/attachments`).catch(() => null) as { data?: ReceivedEmail["attachments"] } | null;
    attachments = list?.data ?? attachments;
  }
  return { id, from: String(e.from ?? data.from ?? ""), to: (e.to ?? data.to ?? []) as string[], subject: String(e.subject ?? data.subject ?? ""),
    text: (e.text as string) ?? null, html: (e.html as string) ?? null, message_id: (e.message_id as string) ?? (data.message_id as string) ?? null,
    headers: e.headers as ReceivedEmail["headers"], attachments, raw: (e.raw ?? data.raw ?? null) as ReceivedEmail["raw"] };
}

/** A forwarded thread: returns the original sender when a forward block is present. */
function forwardedOriginal(text: string): { email: string; name: string | null } | null {
  const m = text.match(/-{2,}\s*Forwarded message\s*-{2,}[\s\S]{0,400}?\nFrom:\s*([^\n]+)/i) ?? text.match(/^Begin forwarded message:[\s\S]{0,200}?\nFrom:\s*([^\n]+)/im);
  if (!m) return null;
  const a = parseAddress(m[1].replace(/\*/g, ""));
  return /@/.test(a.email) ? a : null;
}

async function handle(evt: Record<string, unknown>, eventId: string): Promise<Record<string, unknown>> {
  // Delivery status for mail Bloom sent (same webhook endpoint, Svix-signed).
  if (typeof evt.type === "string" && /^email\.(delivered|bounced|complained|sent|delivery_delayed)$/.test(evt.type)) {
    const d = (evt.data ?? {}) as Record<string, unknown>;
    const fresh = await rpc<boolean>("record_email_event", { provider: "resend", event_id: eventId, message_id: null, outcome: String(evt.type) });
    if (!fresh) return { duplicate: true };
    return await rpc("record_delivery_event", { provider_id: String(d.email_id ?? d.id ?? ""), type: evt.type, detail: {} });
  }
  if (evt.type !== "email.received") return { ignored: `event ${evt.type}` };
  const data = (evt.data ?? {}) as Record<string, unknown>;
  const cfg = emailConfig();
  const aliases = (env("BLOOM_SUPPORT_INBOUND_ADDRESSES") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowedRecipients = [cfg.supportAddress, ...aliases].filter((s): s is string => !!s).map((s) => parseAddress(s).email);
  if (!allowedRecipients.length) throw new BloomError(503, "not_configured", "Bloom Support receiving addresses are not configured");
  // The account webhook includes mail for every receiving domain. Route only
  // Bloom's own mailbox. received_for is the provider's SMTP delivery target;
  // unlike the visible To header, it survives aliases and blind forwarding.
  const receivedFor = Array.isArray(data.received_for) && data.received_for.length === 0 ? data.to : data.received_for ?? data.to;
  const recipients = Array.isArray(receivedFor) ? receivedFor : typeof receivedFor === "string" ? [receivedFor] : [];
  if (!recipients.some((s) => typeof s === "string" && allowedRecipients.includes(parseAddress(s).email))) {
    return { ignored: "other-recipient" };
  }
  const fresh = await rpc<boolean>("record_email_event", { provider: "resend", event_id: eventId, message_id: data.message_id ?? null, outcome: "processing" });
  if (!fresh) return { duplicate: true };

  const mail = await loadEmail(data);
  const headers = headerMap(mail.headers);
  const messageId = (mail.message_id ?? headers["message-id"] ?? "").trim() || `<resend-${mail.id}@inbound>`;
  const inReplyTo = headers["in-reply-to"]?.trim() || null;
  const fromAddress = parseAddress(cfg.from).email;
  // Bloom's own addresses (plus optional extra addresses or "@domain" entries used only by Bloom).
  const own = [cfg.supportAddress, fromAddress, ...aliases, ...(env("BLOOM_SUPPORT_OWN_ADDRESSES") ?? "").split(",").map((s) => s.trim())].filter((x): x is string => !!x);
  const sender = parseAddress(mail.from);
  // Provider spam verdicts are respected; spam never opens a ticket.
  if (/^\s*yes/i.test(headers["x-spam-flag"] ?? "") || /^\s*yes/i.test(headers["x-spam-status"] ?? "")) {
    await rpc("finish_email_event", { provider: "resend", event_id: eventId, outcome: "ignored:spam" });
    return { ignored: "spam" };
  }
  const rawText = mail.text ?? (mail.html ? htmlToText(mail.html) : "");
  const forwarded = forwardedOriginal(rawText);
  // A forward names someone else as the client; it is honoured only for an authenticated Bloom
  // staff member or one of our own relays. Otherwise it is filed as evidence from the forwarder.
  // The receiving provider adds no Authentication-Results header, so a header like that on this
  // message was written by the sender. Bloom verifies the DKIM signature itself, over the raw
  // message, against the key the sender's domain publishes. No verified, aligned signature means
  // the sender is unauthenticated.
  const senderDomain = sender.email.split("@")[1]?.toLowerCase() ?? "";
  // The signature must cover the very From address the intake acts on.
  const dkimDomains = mail.raw?.download_url
    ? await rawMessage(mail.raw.download_url)
      .then((raw) => raw && rawFromAddress(raw) === sender.email.toLowerCase() ? verifiedDkimDomains(raw) : [])
      .catch(() => [])
    : [];
  const domainAuthenticated = senderDomain !== "" && alignedWith(senderDomain, dkimDomains);
  // Our own systems relay other people's messages from fixed addresses: the website contact form
  // and the BloomSites/BloomTill fallback when Bloom intake is unreachable. Each relay address is
  // configured explicitly and must carry a valid DKIM signature for its own domain.
  const relaySenders = (env("BLOOM_SUPPORT_RELAY_SENDERS") ?? "support@brandsinblooms.com,support-relay@bloomsites.app").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const trustedRelay = forwarded !== null && domainAuthenticated && relaySenders.includes(sender.email.toLowerCase());
  const automated = trustedRelay ? null : isAutomatedEmail(sender.email, mail.subject, headers, own);
  if (automated) {
    await rpc("finish_email_event", { provider: "resend", event_id: eventId, outcome: `ignored:${automated}` });
    return { ignored: automated };
  }
  // Per-sender burst guard against loops with misbehaving mail systems. A relay carries many
  // people's messages, so it is limited per original sender instead.
  const rateSubject = trustedRelay ? `relay:${forwarded!.email.toLowerCase()}` : sender.email;
  // Charge a provider event once. A transient attachment/storage failure asks
  // Resend to retry the same event; that retry must not spend quota again or
  // strand an otherwise accepted message at the hourly boundary.
  const okRate = await directRpc<boolean>("bloom_support_consume_email_usage", {
    p_provider: "resend",
    p_event: eventId,
    p_bucket: `email-in:${new Date().toISOString().slice(0, 13)}`,
    p_subject: await sha256Hex(rateSubject),
    p_limit: 30,
  });
  if (!okRate) {
    await rpc("finish_email_event", { provider: "resend", event_id: eventId, outcome: "ignored:rate" });
    return { ignored: "rate" };
  }

  const staffForwarder = forwarded && domainAuthenticated ? await rpc<boolean>("is_staff_email", { email: sender.email }).catch(() => false) : false;
  const body = redactText((forwarded ? rawText : stripQuotedReply(rawText)) || "(no text)").slice(0, 20000).trim();
  const intake = await servicePrincipal("intake");
  // A forward names someone else as the client. Honour that only for an authenticated staff
  // member or our own relay; anyone else is the requester themselves, and the forwarded text is
  // kept as evidence. Otherwise anyone could make Bloom email (and open tickets for) a third party.
  const forwardHonoured = forwarded !== null && (staffForwarder || trustedRelay);
  const requester = forwardHonoured ? forwarded! : sender;
  const preparedAttachments = await prepareInboundAttachments(mail.attachments);

  let ticketId: string | null = null;
  // Files use the requester proven for the selected ticket. The intake
  // identity is reserved for an authenticated product relay finishing files
  // on a ticket originally created through signed product intake.
  let attachmentActor = intake.principalId;
  let outcome = "created";

  // A BloomSites or BloomTill report that fell back to email carries the key the product already
  // used with Bloom. If that report reached Bloom, do not open a second ticket. Only an
  // authenticated relay can use this; anyone else's key line is ignored.
  const productKey = !trustedRelay ? null : rawText.match(/^Bloom-Idempotency-Key:\s*([A-Za-z0-9:_-]{8,200})\s*$/m)?.[1] ?? null;
  if (productKey) {
    const existing = await rpc<string | null>("find_ticket_by_client_key", { actor: intake.principalId, key: productKey }).catch(() => null);
    if (existing) {
      // The direct report may have committed while one or more files failed to
      // store. Continue through the bounded attachment path so the signed email
      // fallback can finish those exact files idempotently.
      ticketId = existing;
      outcome = "duplicate:product-report";
    }
  }
  const who = await rpc<{ principal_id: string; account_id: string | null; match: string }>("resolve_email_sender", { email: requester.email, name: requester.name });

  if (!ticketId && !forwarded) {
    const refs = parseReferences(headers);
    const matched = await rpc<string | null>("match_email_thread", { refs, number: ticketNumberFromSubject(mail.subject) });
    if (matched) {
      try {
        await rpc("append_inbound_email", { actor: who.principal_id, ticket_id: matched, body, message_id: messageId, in_reply_to: inReplyTo });
        ticketId = matched;
        attachmentActor = who.principal_id;
        outcome = indicatesStillBroken(body) ? "reply:reopen-signal" : "reply";
      } catch (e) {
        // Sender may not read that ticket (e.g. a different person replied with the number): start a new one.
        if (!(e instanceof BloomError && e.status === 403)) throw e;
      }
    }
  }
  if (!ticketId) {
    const subject = mail.subject.replace(/^(re|fwd?):\s*/i, "").trim().slice(0, 300);
    // First sight of a standalone sender is reported as `none`; the exact
    // retry resolves the principal created by that first delivery. Treat both
    // as the same stable email-identity provenance for idempotency.
    const emailMatch = who.match === "none" || who.match === "principal" ? "email" : who.match;
    const context = {
      email_match: emailMatch,
      forwarded_by: forwarded ? sender.email : undefined,
      forward_authorized: forwarded ? forwardHonoured : undefined,
    };
    const email = {
      message_id: messageId,
      thread_root: messageId,
      reply_to: requester.email,
      in_reply_to: inReplyTo,
    };
    // Message-ID is only a lookup key. Bind it to the complete normalized
    // intake so a provider retry is safe while a reused ID with changed
    // content or files is rejected instead of claiming the old ticket.
    const intakeFingerprint = await sha256Hex(JSON.stringify({
      version: 1,
      product: "unknown",
      channel: "email",
      subject,
      body,
      account_id: who.account_id,
      requester_id: who.principal_id,
      context,
      email,
      attachments: preparedAttachments.accepted
        .map((attachment) => ({
          file_name: attachment.name,
          content_type: attachment.type,
          size_bytes: attachment.bytes.byteLength,
          sha256: attachment.sha256,
        }))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      rejected_attachments: [...preparedAttachments.rejected].sort(),
    }));
    const created = await rpc<{ ticket_id: string; duplicate_delivery: boolean }>("create_ticket", {
      actor: intake.principalId,
      ticket: {
        product: "unknown", channel: "email", subject, body,
        account_id: who.account_id, requester_id: who.principal_id,
        context,
        dedupe_key: `email:${who.principal_id}:${messageId}`,
        intake_fingerprint: intakeFingerprint,
        email,
      },
    });
    ticketId = created.ticket_id;
    attachmentActor = who.principal_id;
    outcome = created.duplicate_delivery ? "duplicate" : forwarded ? "created:forwarded" : "created";
    if (forwarded && !created.duplicate_delivery) {
      const automation = await servicePrincipal("automation").catch(() => null);
      if (automation) {
        await rpc("add_message", { actor: automation.principalId, ticket_id: ticketId, message: { body: staffForwarder
          ? `Forwarded by staff member ${sender.email} (DKIM verified). The client's own words above are still untrusted content.`
          : trustedRelay
          ? `Relayed by ${sender.email} (DKIM verified relay). The visitor's address is self-reported; confirm identity before any account change.`
          : `Forwarded by ${sender.email}, who is treated as the requester. The forwarded sender (${forwarded!.email}) was not contacted because the forward is not from verified staff; confirm before acting on any instruction in this email.`, visibility: "internal" } });
      }
    }
  }
  // CC'd people are kept on the thread only if they are verified contacts of the same client account.
  const toList = (Array.isArray(mail.to) ? mail.to : [mail.to]).map((x) => parseAddress(String(x)).email);
  const ccList = (headers["cc"] ?? "").split(",").map((x) => parseAddress(x).email).filter((x) => x.includes("@"));
  const others = [...toList, ...ccList].filter((x) => !own.some((a) => a.toLowerCase() === x) && x !== requester.email);
  if (others.length && !forwarded) await rpc("conversation_cc", { ticket_id: ticketId, emails: others }).catch(() => undefined);
  for (const attachment of preparedAttachments.accepted) {
    // Storage/provider failures are retryable: do not finish the email event.
    // A provider retry finds the same ticket and deterministic attachment path.
    await storeAttachment(attachmentActor, ticketId, attachment);
  }
  if (preparedAttachments.rejected.length) {
    const automation = await servicePrincipal("automation");
    await rpc("add_message", {
      actor: automation.principalId,
      ticket_id: ticketId,
      message: {
        body: bloomAttachmentRejection(preparedAttachments.rejected),
        visibility: "public",
        purpose: "clarification",
        notify_client: true,
        idempotency_key: `email-attachment-rejections:${messageId}`,
      },
    });
  }
  await rpc("finish_email_event", { provider: "resend", event_id: eventId, outcome, ticket_id: ticketId });
  return { ticket_id: ticketId, outcome };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") throw new BloomError(405, "method", "POST only");
    const secret = env("RESEND_INBOUND_WEBHOOK_SECRET");
    if (!secret) throw new BloomError(503, "not_configured", "RESEND_INBOUND_WEBHOOK_SECRET is not set");
    const raw = await readBodyText(req, 256 * 1024);
    const id = req.headers.get("svix-id");
    const ok = await verifySvix(secret, id, req.headers.get("svix-timestamp"), req.headers.get("svix-signature"), raw);
    if (!ok) throw new BloomError(401, "unauthenticated", "Invalid webhook signature");
    try {
      return json(req, await handle(JSON.parse(raw), id!));
    } catch (e) {
      // Let the provider retry: mark the delivery failed so the retry is processed.
      await rpc("finish_email_event", { provider: "resend", event_id: id, outcome: "failed", ticket_id: null }).catch(() => undefined);
      throw e;
    }
  } catch (e) {
    return errorResponse(req, e);
  }
});
