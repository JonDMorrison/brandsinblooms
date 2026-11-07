// Bloom Support — outbound email through the existing Resend account.
import { directRpc, env, rpc } from "./runtime.ts";
import { randomToken, sha256Hex } from "./crypto.ts";
import { threadingHeaders } from "./support-emails.ts";

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
    // When set, client email is delivered only to these addresses (test mode).
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
  /** Designed HTML alternative (support-emails.ts). Stored in the ledger so a retry resends it unchanged. */
  html?: string | null;
  /** Stable per-ticket thread root (ticketThreadRoot). The first email of a ticket uses it as its Message-ID. */
  threadRoot?: string | null;
  /** Other queued Bloom messages this email also delivers (coalesced). */
  coveredMessageIds?: string[];
  inReplyTo?: string | null;
  references?: string[];
  idempotencyKey: string;
  /** Verified contacts of the same account who were on the client's own email. */
  cc?: string[];
  /** True when Bloom (not a person) decided to send; suppressed after human takeover. */
  bloomInitiated: boolean;
  /** True only when a person authored the outbound message. Automated notices and replies leave this unset. */
  humanAuthored?: boolean;
  /** Client-bound (vs. staff notification). Client mail obeys the client_email_enabled switch. */
  toClient: boolean;
}

export interface SendResult {
  id: string;
  status: "sent" | "failed" | "suppressed" | "not_configured" | "queued" | "uncertain";
  duplicate: boolean;
  /** True only when the same provider request is safe to try again. */
  retryable: boolean;
  reason?: string;
}

/** Resend 429/5xx responses and transport ambiguity are the only retryable failures. */
export function retryableProviderStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Supports newly tagged failures and safe legacy 429/5xx ledger rows. */
export function retryableLedgerFailure(status: string, error: string | null | undefined): boolean {
  if (status === "queued" || status === "uncertain" || status === "not_configured") return true;
  return status === "failed" && /^(?:retryable )?resend (?:429|5\d\d):/i.test(error ?? "");
}

/** Only expose controlled delivery reasons, never a raw provider/database error. */
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
  // RFC 3834 says manually submitted messages should not carry Auto-Submitted;
  // Bloom's automatic replies keep the marker so other responders do not loop.
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
  // A previous attempt the provider never accepted (unknown outcome, rejected, or not yet configured)
  // is retried with the SAME provider idempotency key and Message-ID: Resend deduplicates within
  // 24 hours, so the client does not get two copies. Sent and suppressed entries are never resent.
  const retry = queued.duplicate && retryableLedgerFailure(queued.status, queued.error) && !queued.provider_id;
  if (queued.status === "suppressed") {
    return { id: queued.id, status: "suppressed", duplicate: queued.duplicate, retryable: false, reason: safeSuppressionReason(queued.error) };
  }
  if (queued.duplicate && !retry) return { id: queued.id, status: queued.status as SendResult["status"], duplicate: true, retryable: false };
  // A retry sends exactly what the first attempt recorded. Rebuilding the email (for example with a
  // fresh tracking link) would change the payload under the same idempotency key, which the provider
  // rejects, so the stored ledger copy is authoritative.
  if (retry) {
    req = { ...req, to: queued.to_email, subject: queued.subject, text: queued.body, html: queued.html ?? null, inReplyTo: queued.in_reply_to, cc: queued.cc ?? [] };
  }

  if (req.toClient) {
    const enabled = await rpc<boolean>("setting", { key: "client_email_enabled" });
    if (enabled !== true) {
      await rpc("mark_outbound_email", { id: queued.id, status: "suppressed", error: "client_email_enabled is off" });
      return { id: queued.id, status: "suppressed", duplicate: false, retryable: false, reason: "client_email_enabled is off" };
    }
    // A test-mode primary recipient must never carry a real customer on CC.
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

  // A shipment may be rolled back after its email is rendered. Re-check its
  // immutable generation immediately before provider dispatch; ordinary mail
  // passes through unchanged. The database keeps an in-flight outcome
  // uncertain so a concurrent rollback never invents proof that it was unsent.
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
    // Timeout or connection loss: the provider may or may not have accepted it.
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
