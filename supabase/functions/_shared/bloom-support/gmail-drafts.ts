/**
 * Legacy Gmail draft adapter. Bloom's worker now uses the durable Reply approvals
 * queue for every held reply, regardless of Gmail configuration. This prevents
 * invisible Gmail-only drafts and two independent approval/send paths.
 *
 * The explicit adapter is retained for legacy callers. It is not an automatic
 * mirror: a safe mirror needs delivery reconciliation and shared idempotency.
 * Existing Gmail drafts are not deleted, sent or changed by this migration.
 */
import { env, BloomError } from "./runtime.ts";

export interface GmailDraftInput {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string[];
  idempotencyKey?: string;
}
export type GmailDraftResult =
  | { status: "created"; draftId: string; threadId: string | null }
  | { status: "not_configured"; reason: string }
  | { status: "failed"; reason: string };

async function getAccessToken(): Promise<string> {
  const clientId = env("GMAIL_CLIENT_ID");
  const clientSecret = env("GMAIL_CLIENT_SECRET");
  const refreshToken = env("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new BloomError(503, "not_configured", "Gmail OAuth credentials not configured");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new BloomError(502, "gmail_auth", `Gmail token refresh failed: HTTP ${res.status}`);
  const body = await res.json() as { access_token?: string };
  if (typeof body.access_token !== "string") throw new BloomError(502, "gmail_auth", "Gmail token response missing access_token");
  return body.access_token;
}
function encodeMessage(input: GmailDraftInput, from: string): string {
  // Header values cannot introduce another recipient or MIME header.
  const header = (s: string) => s.replace(/[\r\n]/g, " ");
  const headers: string[] = [`From: ${header(from)}`, `To: ${header(input.to)}`, `Subject: ${header(input.subject)}`, "MIME-Version: 1.0"];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${header(input.inReplyTo)}`);
  if (input.references?.length) headers.push(`References: ${header(input.references.join(" "))}`);
  if (input.idempotencyKey) headers.push(`X-Bloom-Key: ${header(input.idempotencyKey)}`);
  let bodyPart: string;
  if (input.htmlBody) {
    const boundary = `bloom_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    bodyPart = [`--${boundary}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", input.textBody, "", `--${boundary}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", input.htmlBody, "", `--${boundary}--`].join("\r\n");
  } else {
    headers.push("Content-Type: text/plain; charset=utf-8");
    bodyPart = input.textBody;
  }
  const raw = headers.join("\r\n") + "\r\n\r\n" + bodyPart;
  const bytes = new TextEncoder().encode(raw);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** Explicit legacy adapter only. This method does not claim provider idempotency. */
export async function createGmailDraft(input: GmailDraftInput): Promise<GmailDraftResult> {
  const from = env("GMAIL_FROM");
  if (!from || !env("GMAIL_CLIENT_ID") || !env("GMAIL_CLIENT_SECRET") || !env("GMAIL_REFRESH_TOKEN")) return { status: "not_configured", reason: "Gmail credentials not configured" };
  let accessToken: string;
  try { accessToken = await getAccessToken(); }
  catch (e) {
    if (e instanceof BloomError && e.code === "not_configured") return { status: "not_configured", reason: e.message };
    return { status: "failed", reason: "Gmail authorization failed; the reply must remain held" };
  }
  let res: Response;
  try {
    res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { raw: encodeMessage(input, from) } }), signal: AbortSignal.timeout(10_000),
    });
  } catch { return { status: "failed", reason: "Gmail draft outcome is unknown; reconcile before retrying" }; }
  if (!res.ok) { await res.body?.cancel(); return { status: "failed", reason: `Gmail API HTTP ${res.status}` }; }
  const data = await res.json() as { id?: string; message?: { threadId?: string } };
  if (typeof data.id !== "string") return { status: "failed", reason: "Gmail API returned no draft ID" };
  return { status: "created", draftId: data.id, threadId: data.message?.threadId ?? null };
}
/** Keep all automatic holds in the one durable, audited Reply approvals queue. */
export function gmailDraftQueueAvailable(): boolean { return false; }

export function shouldQueueAsDraft(opts: {
  ticketStatus: string;
  executor: string;
  nextAction: string | null;
  forceDraft?: boolean;
}): boolean {
  // Human-owned automation is already suppressed by the outbound ledger.
  if (opts.executor === "person") return false;
  if (opts.forceDraft) return true;
  if (opts.ticketStatus === "needs_owner") return true;
  return /\b(refund|legal|billing|chargeback|fraud|dispute|complaint)\b/i.test(opts.nextAction ?? "");
}
