// Bloom Support — outbound email through the existing Resend account.
import { env, rpc } from "./runtime.ts";
import { randomToken, sha256Hex } from "./crypto.ts";

export interface EmailConfig {
  configured: boolean;
  missing: string[];
  from: string;
  supportAddress: string | null;
  replyDomain: string;
  publicBaseUrl: string;
  allowlist: string[];
}

export function emailConfig(): EmailConfig {
  const missing: string[] = [];
  if (!env("RESEND_API_KEY")) missing.push("RESEND_API_KEY");
  const supportAddress = env("BLOOM_SUPPORT_INBOX") ?? null;
  if (!supportAddress) missing.push("BLOOM_SUPPORT_INBOX");
  const from = env("BLOOM_SUPPORT_FROM") ?? (supportAddress ? `Bloom Support <${supportAddress}>` : "Bloom Support <support@bloomsuite.app>");
  return {
    configured: missing.length === 0,
    missing,
    from,
    supportAddress,
    replyDomain: (supportAddress?.split("@")[1]) ?? "bloomsuite.app",
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
  inReplyTo?: string | null;
  references?: string[];
  idempotencyKey: string;
  /** True when Bloom (not a person) decided to send; suppressed after human takeover. */
  bloomInitiated: boolean;
  /** Client-bound (vs. staff notification). Client mail obeys the client_email_enabled switch. */
  toClient: boolean;
}

export interface SendResult {
  id: string;
  status: "sent" | "failed" | "suppressed" | "not_configured" | "queued";
  duplicate: boolean;
  reason?: string;
}

export async function sendSupportEmail(req: SendRequest): Promise<SendResult> {
  const cfg = emailConfig();
  const rfcId = newMessageId(cfg.replyDomain);
  const queued = await rpc<{ id: string; status: string; duplicate: boolean; rfc_message_id: string }>("queue_outbound_email", {
    email: {
      ticket_id: req.ticketId, message_id: req.messageId ?? null, purpose: req.purpose, to: req.to, subject: req.subject, body: req.text,
      rfc_message_id: rfcId, in_reply_to: req.inReplyTo ?? null, idempotency_key: req.idempotencyKey, bloom_initiated: req.bloomInitiated,
    },
  });
  if (queued.duplicate) return { id: queued.id, status: queued.status as SendResult["status"], duplicate: true };
  if (queued.status === "suppressed") return { id: queued.id, status: "suppressed", duplicate: false, reason: "ticket under human control" };

  if (req.toClient) {
    const enabled = await rpc<boolean>("setting", { key: "client_email_enabled" });
    if (enabled !== true) {
      await rpc("mark_outbound_email", { id: queued.id, status: "suppressed", error: "client_email_enabled is off" });
      return { id: queued.id, status: "suppressed", duplicate: false, reason: "client_email_enabled is off" };
    }
    if (cfg.allowlist.length && !cfg.allowlist.includes(req.to.toLowerCase())) {
      await rpc("mark_outbound_email", { id: queued.id, status: "suppressed", error: "recipient not in BLOOM_SUPPORT_EMAIL_ALLOWLIST" });
      return { id: queued.id, status: "suppressed", duplicate: false, reason: "recipient not in test allowlist" };
    }
  }
  if (!cfg.configured) {
    await rpc("mark_outbound_email", { id: queued.id, status: "not_configured", error: `missing ${cfg.missing.join(", ")}` });
    return { id: queued.id, status: "not_configured", duplicate: false, reason: `missing ${cfg.missing.join(", ")}` };
  }

  const headers: Record<string, string> = { "Message-ID": rfcId, "X-Bloom-Support": "1", "Auto-Submitted": "auto-replied" };
  if (req.inReplyTo) {
    headers["In-Reply-To"] = req.inReplyTo;
    headers["References"] = [...new Set([...(req.references ?? []), req.inReplyTo])].join(" ");
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json", "Idempotency-Key": await sha256Hex(req.idempotencyKey) },
      body: JSON.stringify({
        from: cfg.from,
        to: [req.to],
        reply_to: cfg.supportAddress ?? undefined,
        subject: req.subject,
        text: req.text,
        headers,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      await rpc("mark_outbound_email", { id: queued.id, status: "failed", error: `resend ${res.status}: ${JSON.stringify(body).slice(0, 300)}` });
      return { id: queued.id, status: "failed", duplicate: false, reason: `resend ${res.status}` };
    }
    await rpc("mark_outbound_email", { id: queued.id, status: "sent", provider_id: body?.id ?? null });
    return { id: queued.id, status: "sent", duplicate: false };
  } catch (e) {
    await rpc("mark_outbound_email", { id: queued.id, status: "failed", error: String(e).slice(0, 300) });
    return { id: queued.id, status: "failed", duplicate: false, reason: String(e) };
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
