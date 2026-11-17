// Bloom Support — outbound email through the existing Resend account.
import { directRpc, env, rpc } from "./runtime.ts";
import { randomToken, sha256Hex } from "./crypto.ts";
import { threadingHeaders } from "./support-emails.ts";
import { prepareApprovedEmail } from "./approval-delivery.ts";

export interface EmailConfig {
  configured: boolean;
  missing: string[];
  from: string;
  /** Verified dedicated sending/inbound identity (deliverability domain). */
  sendingAddress: string | null;
  /** Address clients see, use and reply to. */
  publicAddress: string;
  replyDomain: string;
  publicBaseUrl: string;
  allowlist: string[];
}

export function emailConfig(): EmailConfig {
  const missing: string[] = [];
  if (!env("RESEND_API_KEY")) missing.push("RESEND_API_KEY");
  const sendingAddress = env("BLOOM_SUPPORT_INBOX") ?? null;
  if (!sendingAddress) missing.push("BLOOM_SUPPORT_INBOX");
  const publicAddress = env("BLOOM_SUPPORT_PUBLIC_INBOX") ?? "bloom@bloomsuite.app";
  const from = env("BLOOM_SUPPORT_FROM") ?? (sendingAddress ? `Bloom Support <${sendingAddress}>` : "Bloom Support <support@bloomsuite.app>");
  return {
    configured: missing.length === 0,
    missing,
    from,
    sendingAddress,
    publicAddress,
    replyDomain: (sendingAddress?.split("@")[1]) ?? "bloomsuite.app",
    publicBaseUrl: env("BLOOM_SUPPORT_PUBLIC_URL") ?? "https://bloomsuite.app",
    allowlist: (env("BLOOM_SUPPORT_EMAIL_ALLOWLIST") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  };
}

export function newMessageId(domain: string): string {
  return `<bloom.${Date.now().toString(36)}.${randomToken(9)}@${domain}>`;
}

export interface SendRequest {
  ticketId: string | null;
  messageId?: string | null;
  purpose: "acknowledgement" | "clarification" | "progress" | "resolution" | "reply" | "escalation" | "feature_decision" | "notification";
  to: string;
  subject: string;
  text: string;
  /** Designed HTML alternative, stored in the ledger for unchanged retries. */
  html?: string | null;
  threadRoot?: string | null;
  coveredMessageIds?: string[];
  inReplyTo?: string | null;
  references?: string[];
  idempotencyKey: string;
  /** Verified same-account contacts from the client's own message. */
  cc?: string[];
  bloomInitiated: boolean;
  /** True only when a person authored the message, not merely approved AI text. */
  humanAuthored?: boolean;
  toClient: boolean;
}

export interface SendResult {
  id: string;
  status: "sent" | "failed" | "suppressed" | "not_configured" | "queued" | "uncertain";
  duplicate: boolean;
  retryable: boolean;
  reason?: string;
}

export function retryableProviderStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
export function retryableLedgerFailure(status: string, error: string | null | undefined): boolean {
  if (status === "queued" || status === "uncertain" || status === "not_configured") return true;
  return status === "failed" && /^(?:retryable )?resend (?:429|5\d\d):/i.test(error ?? "");
}
export function safeSuppressionReason(value: unknown): string {
  switch (value) {
    case "recipient bounced or complained":
    case "ticket under human control":
    case "client_email_enabled is off":
    case "recipient or CC not in BLOOM_SUPPORT_EMAIL_ALLOWLIST":
      return value;
    default:
      return "delivery suppressed";
  }
}

export function supportEmailHeaders(input: {
  messageId: string;
  humanAuthored?: boolean;
  threadRoot?: string | null;
  inReplyTo?: string | null;
  references?: string[];
}): Record<string, string> {
  const headers: Record<string, string> = { "Message-ID": input.messageId, "X-Bloom-Support": "1" };
  if (!input.humanAuthored) headers["Auto-Submitted"] = "auto-replied";
  if (input.threadRoot) {
    Object.assign(headers, threadingHeaders(input.messageId, {
      root: input.threadRoot,
      inReplyTo: input.inReplyTo,
      references: input.references,
    }));
  } else if (input.inReplyTo) {
    headers["In-Reply-To"] = input.inReplyTo;
    headers.References = [...new Set([...(input.references ?? []), input.inReplyTo])].join(" ");
  }
  return headers;
}

export async function sendSupportEmail(req: SendRequest): Promise<SendResult> {
  // Validate the actual approval again at the delivery boundary. Use exactly the
  // reviewed primary recipient, subject and body; never add new CC or content.
  req = await prepareApprovedEmail(req);
  const cfg = emailConfig();
  const rfcId = newMessageId(cfg.replyDomain);
  const queued = await rpc<{
    id: string; status: string; duplicate: boolean; rfc_message_id: string; provider_id: string | null;
    to_email: string; subject: string; body: string; html?: string | null; in_reply_to: string | null; cc: string[] | null; error?: string | null;
  }>("queue_outbound_email", {
    email: {
      ticket_id: req.ticketId, message_id: req.messageId ?? null, purpose: req.purpose, to: req.to, subject: req.subject, body: req.text,
      html: req.html ?? null, thread_root: req.threadRoot?.startsWith("<bloom-ticket.") ? req.threadRoot : null, covered_message_ids: req.coveredMessageIds ?? [],
      rfc_message_id: rfcId, in_reply_to: req.inReplyTo ?? null, idempotency_key: req.idempotencyKey, bloom_initiated: req.bloomInitiated,
      cc: req.cc ?? [],
    },
  });
  // Sent/suppressed requests are never resent. Ambiguous transport failures
  // retain the same provider key and Message-ID for safe provider deduplication.
  const retry = queued.duplicate && retryableLedgerFailure(queued.status, queued.error) && !queued.provider_id;
  if (queued.status === "suppressed") {
    return { id: queued.id, status: "suppressed", duplicate: queued.duplicate, retryable: false, reason: safeSuppressionReason(queued.error) };
  }
  if (queued.duplicate && !retry) return { id: queued.id, status: queued.status as SendResult["status"], duplicate: true, retryable: false };
  if (retry) {
    req = { ...req, to: queued.to_email, subject: queued.subject, text: queued.body, html: queued.html ?? null, inReplyTo: queued.in_reply_to, cc: queued.cc ?? [] };
  }

  if (req.toClient) {
    const enabled = await rpc<boolean>("setting", { key: "client_email_enabled" });
    if (enabled !== true) {
      await rpc("mark_outbound_email", { id: queued.id, status: "suppressed", error: "client_email_enabled is off" });
      return { id: queued.id, status: "suppressed", duplicate: false, retryable: false, reason: "client_email_enabled is off" };
    }
    const recipients = [req.to, ...(req.cc ?? [])].map((address) => address.trim().toLowerCase());
    if (cfg.allowlist.length && recipients.some((address) => !cfg.allowlist.includes(address))) {
      await rpc("mark_outbound_email", { id: queued.id, status: "suppressed", error: "recipient or CC not in BLOOM_SUPPORT_EMAIL_ALLOWLIST" });
      return {
        id: queued.id,
        status: "suppressed",
        duplicate: false,
        retryable: false,
        reason: safeSuppressionReason("recipient or CC not in BLOOM_SUPPORT_EMAIL_ALLOWLIST"),
      };
    }
  }
  if (!cfg.configured) {
    await rpc("mark_outbound_email", { id: queued.id, status: "not_configured", error: `missing ${cfg.missing.join(", ")}` });
    return { id: queued.id, status: "not_configured", duplicate: false, retryable: true, reason: `missing ${cfg.missing.join(", ")}` };
  }

  // Recheck immutable feature-shipment eligibility immediately before dispatch.
  const shipmentDispatchAllowed = await directRpc<boolean>(
    "bloom_support_claim_feature_shipment_email",
    { p_email: queued.id },
  );
  if (!shipmentDispatchAllowed) {
    return { id: queued.id, status: "suppressed", duplicate: queued.duplicate, retryable: false, reason: "delivery suppressed" };
  }
  const messageId = queued.rfc_message_id ?? rfcId;
  const headers = supportEmailHeaders({
    messageId,
    humanAuthored: req.humanAuthored,
    threadRoot: req.threadRoot,
    inReplyTo: req.inReplyTo,
    references: req.references,
  });
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json", "Idempotency-Key": await sha256Hex(req.idempotencyKey) },
      body: JSON.stringify({
        from: cfg.from,
        to: [req.to],
        cc: req.cc?.length ? [...new Set(req.cc.map((c) => c.toLowerCase()))].filter((c) => c !== req.to.toLowerCase()).slice(0, 10) : undefined,
        reply_to: cfg.publicAddress,
        subject: req.subject,
        text: req.text,
        html: req.html ?? undefined,
        headers,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const retryable = retryableProviderStatus(res.status);
      await rpc("mark_outbound_email", { id: queued.id, status: "failed", error: `${retryable ? "retryable" : "terminal"} resend ${res.status}: ${JSON.stringify(body).slice(0, 300)}` });
      return { id: queued.id, status: "failed", duplicate: false, retryable, reason: `resend ${res.status}` };
    }
    await rpc("mark_outbound_email", { id: queued.id, status: "sent", provider_id: body?.id ?? null });
    return { id: queued.id, status: "sent", duplicate: false, retryable: false };
  } catch (e) {
    await rpc("mark_outbound_email", { id: queued.id, status: "uncertain", error: `outcome unknown: ${String(e).slice(0, 250)}` });
    return { id: queued.id, status: "uncertain", duplicate: false, retryable: true, reason: "provider outcome unknown; will retry with the same idempotency key" };
  }
}

export function subjectFor(number: number, subject: string): string {
  const clean = subject.replace(/^(re|fwd?):\s*/i, "").replace(/\[Bloom #\d+\]\s*/i, "").slice(0, 150);
  return `[Bloom #${number}] ${clean}`;
}

export async function trackingLink(ticketId: string): Promise<string> {
  const token = randomToken(24);
  await rpc("issue_tracking_token", { ticket_id: ticketId, hash: await sha256Hex(token) });
  return `${emailConfig().publicBaseUrl}/support/track/${token}`;
}
