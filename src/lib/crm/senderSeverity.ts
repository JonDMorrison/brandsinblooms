import type { EmailDomain } from "@/hooks/useEmailDomains";

export type SenderSeverity = "ready" | "warning" | "blocked";

export type SenderBlockedReason =
  | "PAUSED"
  | "FAILED"
  | "NO_SENDER"
  | "DOMAIN_NOT_REGISTERED";

export type SenderWarningReason =
  | "PENDING_VERIFICATION"
  | "FREE_MAIL"
  | "GENERIC_NAME";

export type SenderClassification =
  | { status: "ready" }
  | { status: "warning"; reason: SenderWarningReason; message: string }
  | { status: "blocked"; reason: SenderBlockedReason; message: string };

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
  "proton.me",
]);

const GENERIC_SENDER_NAMES = new Set(["your business"]);

const MESSAGES: {
  warning: Record<SenderWarningReason, string>;
  blocked: Record<SenderBlockedReason, string>;
} = {
  warning: {
    PENDING_VERIFICATION:
      "Your sending domain is verified at our system but DNS verification is still propagating. Sending may have higher bounce rates until DNS confirms. You can wait or proceed.",
    FREE_MAIL:
      "Sending from gmail.com / yahoo.com / etc. hurts deliverability. Consider configuring a branded sending domain.",
    GENERIC_NAME:
      "Your sender display name is 'Your Business'. Update it in Settings → Sender/Domain so recipients recognize you.",
  },
  blocked: {
    PAUSED:
      "Your sending domain is paused due to past deliverability issues. Sending will fail. Contact support to review your reputation status before sending.",
    FAILED:
      "DNS verification failed for your sending domain. Sending will likely fail. Check your DNS records in Settings → Sender/Domain.",
    NO_SENDER:
      "No sender configured. Set up your sending domain in Settings → Sender/Domain.",
    DOMAIN_NOT_REGISTERED:
      "The sender email's domain is not registered in your account. Add it in Settings → Sender/Domain before sending.",
  },
};

export interface ClassifySenderInput {
  senderEmail: string;
  senderName: string;
  emailDomains: EmailDomain[];
  campaignType: "email" | "sms";
}

const extractDomain = (email: string): string | null => {
  if (!email.includes("@")) return null;
  const domain = email.split("@").pop()?.toLowerCase();
  return domain || null;
};

// SMS does not gate on email-domain configuration. Returning ready
// here keeps SMS campaigns from being blocked by an unrelated email
// sender state — matches the existing preflight behavior that says
// "SMS campaigns still use your saved sender settings."
const classifySms = (): SenderClassification => ({ status: "ready" });

export function classifySender({
  senderEmail,
  senderName,
  emailDomains,
  campaignType,
}: ClassifySenderInput): SenderClassification {
  if (campaignType === "sms") {
    return classifySms();
  }

  const trimmedEmail = senderEmail.trim().toLowerCase();
  if (!trimmedEmail) {
    return {
      status: "blocked",
      reason: "NO_SENDER",
      message: MESSAGES.blocked.NO_SENDER,
    };
  }

  const senderDomain = extractDomain(trimmedEmail);
  if (!senderDomain) {
    // Email without a "@" should already have been caught by basic
    // input validation, but treat it as no sender for safety.
    return {
      status: "blocked",
      reason: "NO_SENDER",
      message: MESSAGES.blocked.NO_SENDER,
    };
  }

  // Free-mail (gmail/yahoo/etc.) is a deliverability warning rather
  // than a hard block — the send will still go out, but reputation
  // and inbox placement suffer. Surface before the registry check
  // because such addresses will never be in email_domains anyway.
  if (FREE_MAIL_DOMAINS.has(senderDomain)) {
    return {
      status: "warning",
      reason: "FREE_MAIL",
      message: MESSAGES.warning.FREE_MAIL,
    };
  }

  // Find the email_domains row matching the sender's domain or its
  // explicit default_from_email. Status from that row drives severity.
  const matchingDomain = emailDomains.find((domain) => {
    const domainName = domain.domain.toLowerCase();
    const defaultEmail = domain.default_from_email?.toLowerCase() ?? "";
    return domainName === senderDomain || defaultEmail === trimmedEmail;
  });

  if (!matchingDomain) {
    return {
      status: "blocked",
      reason: "DOMAIN_NOT_REGISTERED",
      message: MESSAGES.blocked.DOMAIN_NOT_REGISTERED,
    };
  }

  switch (matchingDomain.status) {
    case "paused":
    case "blocked":
      return {
        status: "blocked",
        reason: "PAUSED",
        message: MESSAGES.blocked.PAUSED,
      };
    case "failed":
    case "error":
      return {
        status: "blocked",
        reason: "FAILED",
        message: MESSAGES.blocked.FAILED,
      };
    case "pending":
    case "pending_dns":
    case "verifying":
    case "warming_up":
      return {
        status: "warning",
        reason: "PENDING_VERIFICATION",
        message: MESSAGES.warning.PENDING_VERIFICATION,
      };
    case "active":
      // Domain is properly verified. Last check: generic display
      // name? That's an attention-worthy nit — the send works but
      // recipients see "Your Business" in the inbox.
      if (
        senderName.trim() &&
        GENERIC_SENDER_NAMES.has(senderName.trim().toLowerCase())
      ) {
        return {
          status: "warning",
          reason: "GENERIC_NAME",
          message: MESSAGES.warning.GENERIC_NAME,
        };
      }
      return { status: "ready" };
    default: {
      // Exhaustiveness guard — if a new status enum value is added to
      // EmailDomain.status without updating this switch, fail closed
      // (block the send) rather than silently letting it through.
      const _exhaustive: never = matchingDomain.status;
      void _exhaustive;
      return {
        status: "blocked",
        reason: "FAILED",
        message: MESSAGES.blocked.FAILED,
      };
    }
  }
}
