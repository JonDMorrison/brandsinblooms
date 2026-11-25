/**
 * Shared reading of email-domain-verify replies for the Settings and Domains
 * screens, so both say the same plain thing about the same result.
 */

export type VerifyFeedbackTone = "success" | "info" | "warning" | "error";

export interface VerifyFeedback {
  tone: VerifyFeedbackTone;
  message: string;
  verified: boolean;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
}

interface VerifyReply {
  ok?: boolean;
  status?: string;
  message?: string;
  readiness?: { status?: string; message?: string; subMessage?: string | null };
  provider?: { dmarc_verified?: boolean };
}

/** Body of a non-2xx functions.invoke error. `context` is the fetch Response. */
export async function readFunctionErrorBody(
  error: unknown,
): Promise<{ status: number | null; body: Record<string, unknown> | null }> {
  const context = (error as { context?: unknown })?.context;
  const status =
    context && typeof (context as Response).status === "number"
      ? (context as Response).status
      : null;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).clone().json();
      return { status, body: body && typeof body === "object" ? body : null };
    } catch {
      return { status, body: null };
    }
  }
  return { status, body: null };
}

export function feedbackFromVerifyError(
  status: number | null,
  body: Record<string, unknown> | null,
  fallback: string,
): VerifyFeedback {
  if (status === 429 || body?.error === "rate_limited") {
    const retryAfterSeconds = Number(body?.retry_after_seconds ?? 30) || 30;
    return {
      tone: "info",
      verified: false,
      rateLimited: true,
      retryAfterSeconds,
      message: `We just checked this domain. Try again in ${retryAfterSeconds} seconds.`,
    };
  }
  const message =
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.error === "string" && body.error) ||
    fallback;
  return { tone: "error", verified: false, message };
}

export function feedbackFromVerifyReply(reply: VerifyReply | null | undefined): VerifyFeedback {
  const readiness = reply?.readiness;
  const readinessStatus = String(readiness?.status ?? "").toUpperCase();
  if (reply?.ok || readinessStatus === "CONNECTED_READY") {
    return {
      tone: "success",
      verified: true,
      message: "Domain verified. You can send campaigns from it.",
    };
  }
  const detail = [readiness?.message, readiness?.subMessage]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  if (readinessStatus === "ACTION_REQUIRED_AUTHENTICATION") {
    return {
      tone: "warning",
      verified: false,
      message:
        reply?.provider?.dmarc_verified === false
          ? "Sending records are in place. Add the DMARC record to unlock campaigns."
          : detail || "Almost there. Some authentication checks are still pending.",
    };
  }
  if (readinessStatus === "ACTION_REQUIRED_DNS_CONFLICT") {
    return { tone: "error", verified: false, message: detail || "A conflicting DNS record is blocking setup." };
  }
  return {
    tone: "warning",
    verified: false,
    message:
      detail ||
      reply?.message ||
      "DNS records are not visible yet. Changes can take up to a few hours. We keep checking for you.",
  };
}
