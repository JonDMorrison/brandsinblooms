/**
 * Gmail draft queue for Bloom Support.
 *
 * When Bloom prepares a reply that needs staff review before sending — for
 * example a sensitive refund discussion, a legal notice, or a message on a
 * ticket that has been manually escalated — it creates a Gmail draft instead
 * of auto-sending. A staff member reviews, edits if needed, and sends from
 * Gmail. The draft ID is stored with the ticket so we can track its status.
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID       — Google OAuth2 client ID
 *   GMAIL_CLIENT_SECRET   — Google OAuth2 client secret
 *   GMAIL_REFRESH_TOKEN   — Offline refresh token for the staff Gmail account
 *   GMAIL_FROM            — The "from" address (e.g. support@bloomsuite.app)
 *
 * When any env var is missing, createGmailDraft returns { status: "not_configured" }
 * and the caller falls back to the normal in-product message display.
 */
import { env, BloomError } from "./runtime.ts";

export interface GmailDraftInput {
  to: string;
  subject: string;
  /** Plain-text body for the draft. */
  textBody: string;
  /** Optional HTML body. If omitted, the text body is used as-is. */
  htmlBody?: string;
  /** In-Reply-To header to thread the draft into an existing email conversation. */
  inReplyTo?: string;
  /** References header chain. */
  references?: string[];
  /** Client-visible idempotency key — stored as an X-Bloom-Key header to detect duplicates. */
  idempotencyKey?: string;
}

export type GmailDraftResult =
  | { status: "created"; draftId: string; threadId: string | null }
  | { status: "not_configured"; reason: string }
  | { status: "failed"; reason: string };

/** Exchange a refresh token for a short-lived access token. */
async function getAccessToken(): Promise<string> {
  const clientId = env("GMAIL_CLIENT_ID");
  const clientSecret = env("GMAIL_CLIENT_SECRET");
  const refreshToken = env("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new BloomError(503, "not_configured", "Gmail OAuth credentials not configured");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new BloomError(502, "gmail_auth", `Gmail token refresh failed: HTTP ${res.status}`);
  const body = await res.json() as { access_token?: string };
  if (typeof body.access_token !== "string") throw new BloomError(502, "gmail_auth", "Gmail token response missing access_token");
  return body.access_token;
}

/** Encode a draft message as RFC 2822, base64url-encoded for the Gmail API. */
function encodeMessage(input: GmailDraftInput, from: string): string {
  const headers: string[] = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject.replace(/[\r\n]/g, " ")}`,
    `MIME-Version: 1.0`,
  ];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references?.length) headers.push(`References: ${input.references.join(" ")}`);
  if (input.idempotencyKey) headers.push(`X-Bloom-Key: ${input.idempotencyKey}`);

  let bodyPart: string;
  if (input.htmlBody) {
    const boundary = `bloom_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    bodyPart = [
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      input.textBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      input.htmlBody,
      ``,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    headers.push(`Content-Type: text/plain; charset=utf-8`);
    bodyPart = input.textBody;
  }

  const raw = headers.join("\r\n") + "\r\n\r\n" + bodyPart;
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Creates a Gmail draft for staff review. The draft appears in the connected
 * Gmail account's Drafts folder and is NOT sent automatically.
 *
 * Returns not_configured when env vars are missing; the caller should
 * fall back to showing the message in-product only.
 */
export async function createGmailDraft(input: GmailDraftInput): Promise<GmailDraftResult> {
  const from = env("GMAIL_FROM");
  if (!from || !env("GMAIL_CLIENT_ID") || !env("GMAIL_CLIENT_SECRET") || !env("GMAIL_REFRESH_TOKEN")) {
    return { status: "not_configured", reason: "Gmail credentials not configured" };
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    if (e instanceof BloomError && e.code === "not_configured") {
      return { status: "not_configured", reason: e.message };
    }
    return { status: "failed", reason: `token refresh: ${e instanceof Error ? e.message : String(e)}` };
  }

  const raw = encodeMessage(input, from);
  let res: Response;
  try {
    res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { raw } }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return { status: "failed", reason: `network: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { status: "failed", reason: `Gmail API HTTP ${res.status}: ${body.slice(0, 200)}` };
  }

  const data = await res.json() as { id?: string; message?: { threadId?: string } };
  if (typeof data.id !== "string") {
    return { status: "failed", reason: "Gmail API returned no draft ID" };
  }

  return { status: "created", draftId: data.id, threadId: data.message?.threadId ?? null };
}

/**
 * Returns true when the Gmail draft queue is configured and available.
 * Use this to decide whether to route a sensitive reply to a draft vs. displaying in-product.
 */
export function gmailDraftQueueAvailable(): boolean {
  return !!(env("GMAIL_FROM") && env("GMAIL_CLIENT_ID") && env("GMAIL_CLIENT_SECRET") && env("GMAIL_REFRESH_TOKEN"));
}

/**
 * Determines whether a pending reply should be held for staff review in Gmail.
 * Rules (conservative by design):
 *   - Explicit escalation tickets (executor = "person") always go to in-product; staff owns communication
 *   - Tickets flagged as "sensitive" in settings get a draft
 *   - Tickets with refund/legal/billing keywords in next_action get a draft
 */
export function shouldQueueAsDraft(opts: {
  ticketStatus: string;
  executor: string;
  nextAction: string | null;
  forceDraft?: boolean;
}): boolean {
  if (opts.executor === "person") return false;
  if (opts.forceDraft) return true;
  if (opts.ticketStatus === "needs_owner") return true;
  const na = (opts.nextAction ?? "").toLowerCase();
  return /\b(refund|legal|billing|chargeback|fraud|dispute|complaint)\b/.test(na);
}
