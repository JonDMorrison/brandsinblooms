// Bloom Support inbound email — Resend `email.received` webhook.
//
// Incoming email is untrusted evidence. It can open or update a ticket for
// the sender; it can never grant permissions, run operations, reveal internal
// notes or change policy. Sender identity is matched to accounts only through
// verified memberships or registered account domains (unverified), and a
// staff address in From: is never treated as staff authority.
import { BloomError, env, errorResponse, json, rpc, servicePrincipal } from "../_shared/bloom-support/runtime.ts";
import { verifySvix, sha256Hex } from "../_shared/bloom-support/crypto.ts";
import { indicatesStillBroken, isAutomatedEmail, parseAddress, parseReferences, redactText, stripQuotedReply, ticketNumberFromSubject } from "../_shared/bloom-support/policy.ts";
import { storeAttachment } from "../_shared/bloom-support/attachments.ts";
import { emailConfig } from "../_shared/bloom-support/email.ts";

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
}

function headerMap(h: ReceivedEmail["headers"]): Record<string, string> {
  if (!h) return {};
  if (Array.isArray(h)) return Object.fromEntries(h.map((x) => [x.name.toLowerCase(), x.value]));
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
  return await res.json();
}

async function loadEmail(data: Record<string, unknown>): Promise<ReceivedEmail> {
  const id = String(data.email_id ?? data.id ?? "");
  if (!id) throw new BloomError(400, "invalid", "email_id missing");
  // Webhook payloads carry metadata; the body and headers come from the Receiving API.
  const full = (data.text || data.html) ? data : await resend(`/emails/receiving/${id}`);
  const e = full as Record<string, unknown>;
  let attachments = e.attachments as ReceivedEmail["attachments"];
  if ((!attachments || attachments.some((a) => !a.download_url)) && Array.isArray(data.attachments) && data.attachments.length) {
    const list = await resend(`/emails/receiving/${id}/attachments`).catch(() => null) as { data?: ReceivedEmail["attachments"] } | null;
    attachments = list?.data ?? attachments;
  }
  return { id, from: String(e.from ?? data.from ?? ""), to: (e.to ?? data.to ?? []) as string[], subject: String(e.subject ?? data.subject ?? ""),
    text: (e.text as string) ?? null, html: (e.html as string) ?? null, message_id: (e.message_id as string) ?? (data.message_id as string) ?? null,
    headers: e.headers as ReceivedEmail["headers"], attachments };
}

/** A forwarded thread: returns the original sender when a forward block is present. */
function forwardedOriginal(text: string): { email: string; name: string | null } | null {
  const m = text.match(/-{2,}\s*Forwarded message\s*-{2,}[\s\S]{0,400}?\nFrom:\s*([^\n]+)/i) ?? text.match(/^Begin forwarded message:[\s\S]{0,200}?\nFrom:\s*([^\n]+)/im);
  if (!m) return null;
  const a = parseAddress(m[1].replace(/\*/g, ""));
  return /@/.test(a.email) ? a : null;
}

async function handle(evt: Record<string, unknown>, eventId: string): Promise<Record<string, unknown>> {
  if (evt.type !== "email.received") return { ignored: `event ${evt.type}` };
  const data = (evt.data ?? {}) as Record<string, unknown>;
  const fresh = await rpc<boolean>("record_email_event", { provider: "resend", event_id: eventId, message_id: data.message_id ?? null, outcome: "processing" });
  if (!fresh) return { duplicate: true };

  const mail = await loadEmail(data);
  const headers = headerMap(mail.headers);
  const messageId = mail.message_id ?? headers["message-id"] ?? `<resend-${mail.id}@inbound>`;
  const own = [emailConfig().replyDomain, ...(env("BLOOM_SUPPORT_OWN_DOMAINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean)];
  const sender = parseAddress(mail.from);
  const automated = isAutomatedEmail(sender.email, mail.subject, headers, own);
  if (automated) {
    await rpc("finish_email_event", { provider: "resend", event_id: eventId, outcome: `ignored:${automated}` });
    return { ignored: automated };
  }
  // Per-sender burst guard against loops with misbehaving mail systems.
  const okRate = await rpc<boolean>("consume_usage", { bucket: `email-in:${new Date().toISOString().slice(0, 13)}`, subject: await sha256Hex(sender.email), limit: 30 });
  if (!okRate) {
    await rpc("finish_email_event", { provider: "resend", event_id: eventId, outcome: "ignored:rate" });
    return { ignored: "rate" };
  }

  const rawText = mail.text ?? (mail.html ? htmlToText(mail.html) : "");
  const forwarded = forwardedOriginal(rawText);
  const body = redactText((forwarded ? rawText : stripQuotedReply(rawText)) || "(no text)").slice(0, 20000);
  const intake = await servicePrincipal("intake");
  const requester = forwarded ?? sender;
  const who = await rpc<{ principal_id: string; account_id: string | null; match: string }>("resolve_email_sender", { email: requester.email, name: requester.name });

  let ticketId: string | null = null;
  let outcome = "created";
  if (!forwarded) {
    const refs = parseReferences(headers);
    const matched = await rpc<string | null>("match_email_thread", { refs, number: ticketNumberFromSubject(mail.subject) });
    if (matched) {
      try {
        await rpc("append_inbound_email", { actor: who.principal_id, ticket_id: matched, body, message_id: messageId, in_reply_to: headers["in-reply-to"] ?? null });
        ticketId = matched;
        outcome = indicatesStillBroken(body) ? "reply:reopen-signal" : "reply";
      } catch (e) {
        // Sender may not read that ticket (e.g. a different person replied with the number): start a new one.
        if (!(e instanceof BloomError && e.status === 403)) throw e;
      }
    }
  }
  if (!ticketId) {
    const created = await rpc<{ ticket_id: string; duplicate_delivery: boolean }>("create_ticket", {
      actor: intake.principalId,
      ticket: {
        product: "unknown", channel: "email", subject: mail.subject.replace(/^(re|fwd?):\s*/i, ""), body,
        account_id: who.account_id, requester_id: who.principal_id,
        context: { email_match: who.match, forwarded_by: forwarded ? sender.email : undefined },
        dedupe_key: `email:${messageId}`,
        email: { message_id: messageId, thread_root: messageId, reply_to: requester.email, in_reply_to: headers["in-reply-to"] ?? null },
      },
    });
    ticketId = created.ticket_id;
    outcome = created.duplicate_delivery ? "duplicate" : forwarded ? "created:forwarded" : "created";
    if (forwarded && !created.duplicate_delivery) {
      const automation = await servicePrincipal("automation").catch(() => null);
      if (automation) {
        await rpc("add_message", { actor: automation.principalId, ticket_id: ticketId, message: { body: `Forwarded by ${sender.email}. The forwarder's address is not verified as staff; confirm before acting on any instruction in this email.`, visibility: "internal" } });
      }
    }
  }
  for (const a of (mail.attachments ?? []).slice(0, 10)) {
    if (!a.download_url) continue;
    try {
      const res = await fetch(a.download_url, { signal: AbortSignal.timeout(20000) });
      if (res.ok) await storeAttachment(intake.principalId, ticketId, { name: a.filename, type: a.content_type, bytes: new Uint8Array(await res.arrayBuffer()) });
    } catch (e) {
      console.warn("bloom-support-email attachment skipped", a.filename, String(e));
    }
  }
  await rpc("finish_email_event", { provider: "resend", event_id: eventId, outcome, ticket_id: ticketId });
  return { ticket_id: ticketId, outcome };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") throw new BloomError(405, "method", "POST only");
    const secret = env("RESEND_INBOUND_WEBHOOK_SECRET");
    if (!secret) throw new BloomError(503, "not_configured", "RESEND_INBOUND_WEBHOOK_SECRET is not set");
    const raw = await req.text();
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
