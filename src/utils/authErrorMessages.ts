export type AuthContext =
  | "signIn"
  | "signUp"
  | "passwordReset"
  | "passwordUpdate"
  | "verifyOtp"
  | "oauth";

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_banned"
  | "over_request_rate_limit"
  | "over_email_send_rate_limit"
  | "weak_password"
  | "same_password"
  | "signup_disabled"
  | "user_already_registered"
  | "captcha_failed"
  | "validation_failed"
  | "provider_disabled"
  | "network_error"
  | "unknown";

export interface AuthErrorResult {
  message: string;
  code: AuthErrorCode;
  retryable: boolean;
  suggestRetryAfterSeconds?: number;
}

interface ParsedError {
  code?: string;
  status?: number;
  message: string;
  bannedUntil?: string;
}

const parseError = (error: unknown): ParsedError => {
  if (!error || typeof error !== "object") {
    return { message: typeof error === "string" ? error : "" };
  }

  const candidate = error as Record<string, unknown>;
  const code =
    typeof candidate.code === "string" ? candidate.code : undefined;
  const status =
    typeof candidate.status === "number"
      ? candidate.status
      : typeof candidate.statusCode === "number"
        ? candidate.statusCode
        : undefined;
  const message =
    typeof candidate.message === "string"
      ? candidate.message
      : error instanceof Error
        ? error.message
        : "";
  const bannedUntil =
    typeof candidate.banned_until === "string"
      ? candidate.banned_until
      : undefined;

  return { code, status, message, bannedUntil };
};

const NETWORK_PATTERN = /network|fetch|timeout|connection/i;

const isPasswordContext = (context: AuthContext) =>
  context === "signUp" || context === "passwordUpdate";

export function getAuthErrorMessage(
  error: unknown,
  context: AuthContext,
): AuthErrorResult {
  const { code, status, message, bannedUntil } = parseError(error);

  if (NETWORK_PATTERN.test(message)) {
    return {
      code: "network_error",
      message:
        "Unable to connect. Check your internet connection and try again.",
      retryable: true,
    };
  }

  if (
    code === "over_request_rate_limit" ||
    status === 429 ||
    /too many requests/i.test(message)
  ) {
    return {
      code: "over_request_rate_limit",
      message: "Too many attempts. Please wait a few minutes and try again.",
      retryable: false,
      suggestRetryAfterSeconds: 300,
    };
  }

  if (
    code === "over_email_send_rate_limit" ||
    /email rate limit/i.test(message)
  ) {
    return {
      code: "over_email_send_rate_limit",
      message:
        "Too many emails sent recently. Please wait 5 minutes before requesting another.",
      retryable: false,
      suggestRetryAfterSeconds: 300,
    };
  }

  if (
    code === "user_banned" ||
    bannedUntil ||
    /banned_until|user banned|account.*(suspended|banned)/i.test(message)
  ) {
    return {
      code: "user_banned",
      message:
        "This account has been suspended. Contact support at support@brandsinblooms.com.",
      retryable: false,
    };
  }

  if (
    code === "email_not_confirmed" ||
    (status === 422 && /email not confirmed/i.test(message)) ||
    /email not confirmed/i.test(message)
  ) {
    return {
      code: "email_not_confirmed",
      message:
        "Please confirm your email before signing in. Check your inbox for the confirmation link — including spam.",
      retryable: true,
    };
  }

  if (code === "captcha_failed" || /captcha/i.test(message)) {
    return {
      code: "captcha_failed",
      message: "Verification failed. Refresh the page and try again.",
      retryable: true,
    };
  }

  if (
    isPasswordContext(context) &&
    (code === "weak_password" ||
      /weak.?password|password.*(too weak|at least \d|\d+ characters)/i.test(
        message,
      ))
  ) {
    return {
      code: "weak_password",
      message:
        "Password is too weak. Use at least 8 characters with a mix of letters and numbers.",
      retryable: true,
    };
  }

  if (
    context === "passwordUpdate" &&
    (code === "same_password" ||
      /same.?password|new password.*different/i.test(message))
  ) {
    return {
      code: "same_password",
      message: "New password must be different from your current password.",
      retryable: true,
    };
  }

  if (
    context === "signUp" &&
    (code === "signup_disabled" || /signups?.*disabled/i.test(message))
  ) {
    return {
      code: "signup_disabled",
      message: "New signups are temporarily disabled. Contact support.",
      retryable: false,
    };
  }

  if (
    context === "signUp" &&
    (code === "user_already_exists" ||
      code === "email_exists" ||
      code === "user_already_registered" ||
      /user already registered|already exists/i.test(message))
  ) {
    return {
      code: "user_already_registered",
      message:
        "An account with this email already exists. Try signing in instead.",
      retryable: true,
    };
  }

  if (
    context === "signIn" &&
    (code === "invalid_credentials" ||
      /invalid login credentials/i.test(message))
  ) {
    return {
      code: "invalid_credentials",
      message:
        "Email or password is incorrect. If you originally signed up with Google, use the Sign in with Google button instead.",
      retryable: true,
    };
  }

  if (code === "validation_failed" || /validation/i.test(message)) {
    return {
      code: "validation_failed",
      message: "Please check your input and try again.",
      retryable: true,
    };
  }

  if (code === "provider_disabled" || /provider.*disabled/i.test(message)) {
    return {
      code: "provider_disabled",
      message: "This sign-in method is not available right now.",
      retryable: false,
    };
  }

  return {
    code: "unknown",
    message:
      "Something went wrong. Please try again. If this persists, contact support.",
    retryable: true,
  };
}
