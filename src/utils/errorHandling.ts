import { toast } from "sonner";

type ErrorShape = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
  stack?: unknown;
  constructor?: { name?: string };
};

const toErrorShape = (error: unknown): ErrorShape =>
  error && typeof error === "object" ? (error as ErrorShape) : {};

const stringifyErrorValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  return typeof value === "string" ? value : String(value);
};

const getErrorMessage = (error: unknown) => {
  const message = stringifyErrorValue(toErrorShape(error).message);

  return message || stringifyErrorValue(error);
};

const getErrorCode = (error: unknown) => {
  const shape = toErrorShape(error);

  return stringifyErrorValue(shape.code || shape.status);
};

const reportCriticalError = (
  error: unknown,
  context: string,
  appError: AppError,
) => {
  const telemetryEnabled =
    Boolean(import.meta.env.VITE_UPTRACE_DSN) &&
    String(import.meta.env.VITE_DISABLE_TELEMETRY || "").toLowerCase() !==
      "true";

  if (!telemetryEnabled) {
    return;
  }

  import("./uptrace")
    .then(({ captureException }) => {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(getErrorMessage(error) || "Unknown error");

      captureException(normalizedError, {
        context,
        errorCode: appError.code,
        isNetworkError: appError.isNetworkError,
      });
    })
    .catch((reportingError) => {
      console.error(
        "[errorHandling] Failed to load telemetry:",
        reportingError,
      );
    });
};

export interface AppError {
  message: string;
  code?: string;
  isNetworkError?: boolean;
}

export const isNetworkError = (error: unknown): boolean => {
  const message = getErrorMessage(error);

  return (
    !navigator.onLine ||
    message.includes("Failed to fetch") ||
    message.includes("Network Error") ||
    message.includes("ERR_INTERNET_DISCONNECTED")
  );
};

export const handleError = (error: unknown, context: string): AppError => {
  const shape = toErrorShape(error);

  // Better error logging for debugging
  console.error(`[${context}] Raw error object:`, error);
  console.error(`[${context}] Error type:`, typeof error);
  console.error(`[${context}] Error constructor:`, shape.constructor?.name);

  const appError: AppError = {
    message: getErrorMessage(error) || "An unexpected error occurred",
    code: getErrorCode(error) || "UNKNOWN",
    isNetworkError: isNetworkError(error),
  };

  // Log critical errors to console
  if (
    appError.code === "UNAUTHORIZED" ||
    appError.code === "PAYMENT_REQUIRED" ||
    appError.message.includes("OpenAI API key not configured") ||
    (appError.message.includes("Content generation failed") &&
      context.includes("critical"))
  ) {
    console.error(`[CRITICAL ERROR] ${context}:`, {
      errorCode: appError.code,
      errorMessage: appError.message,
      isNetworkError: appError.isNetworkError,
      originalError: error,
    });
  }

  // Send critical errors to Uptrace
  if (
    appError.code === "UNAUTHORIZED" ||
    appError.code === "PAYMENT_REQUIRED" ||
    appError.message.includes("OpenAI API key not configured") ||
    (appError.message.includes("Content generation failed") &&
      context.includes("critical"))
  ) {
    reportCriticalError(error, context, appError);
  }

  // Only show toasts for critical errors that require user action
  if (appError.message.includes("OpenAI API key not configured")) {
    toast.error("AI service unavailable. Please contact support.");
  } else if (
    appError.code === "UNAUTHORIZED" ||
    appError.message.includes("Authentication")
  ) {
    toast.error("Please sign in again to continue.");
  } else if (
    appError.code === "PAYMENT_REQUIRED" ||
    appError.message.includes("subscription")
  ) {
    toast.error("Subscription required. Please check your billing.");
  } else if (
    appError.message.includes("Content generation failed") &&
    context.includes("critical")
  ) {
    toast.error("Content generation failed. Please try again.");
  }
  // Silently handle: network errors, API configuration issues, validation errors, non-critical failures

  return appError;
};

export const logError = (error: unknown, context: string) => {
  console.error(`[${context}] Error:`, error);

  // Additional detailed logging
  if (error && typeof error === "object") {
    const shape = toErrorShape(error);

    console.error(`[${context}] Error details:`, {
      message: shape.message,
      code: shape.code,
      details: shape.details,
      hint: shape.hint,
      stack: shape.stack,
    });
  }
};

/**
 * Maps raw Supabase/auth error messages to user-friendly messages.
 * Never exposes infrastructure-level error details to the user.
 */
export const getAuthErrorMessage = (error: unknown): string => {
  const raw: string = getErrorMessage(error).toLowerCase();
  const code: string = getErrorCode(error).toLowerCase();

  // Network / connectivity
  if (
    isNetworkError(error) ||
    raw.includes("failed to fetch") ||
    raw.includes("network")
  ) {
    return "Unable to connect. Please check your internet connection.";
  }

  // Invalid credentials
  if (
    raw.includes("invalid login credentials") ||
    raw.includes("invalid credentials")
  ) {
    return "The email or password you entered is incorrect.";
  }

  // Email not confirmed
  if (
    raw.includes("email not confirmed") ||
    raw.includes("email_not_confirmed") ||
    code === "email_not_confirmed"
  ) {
    return "Please verify your email address before signing in. Check your inbox for a confirmation link.";
  }

  // User not found
  if (raw.includes("user not found") || raw.includes("no user found")) {
    return "No account found with this email address. Please check your email or create a new account.";
  }

  // Account already exists
  if (
    raw.includes("user already registered") ||
    raw.includes("already been registered") ||
    raw.includes("already exists")
  ) {
    return "An account with this email address already exists. Please sign in instead.";
  }

  // Weak / invalid password
  if (
    raw.includes("password should be at least") ||
    raw.includes("weak_password") ||
    code === "weak_password"
  ) {
    return "Your password is too weak. Please choose a stronger password with at least 8 characters.";
  }

  // Invalid email format
  if (
    raw.includes("invalid email") ||
    raw.includes("email_address_invalid") ||
    code === "email_address_invalid"
  ) {
    return "Please enter a valid email address.";
  }

  // Token expired or invalid
  if (
    raw.includes("token has expired") ||
    raw.includes("token is invalid") ||
    raw.includes("invalid token") ||
    raw.includes("jwt expired") ||
    raw.includes("refresh_token_not_found") ||
    code === "otp_expired"
  ) {
    return "This link has expired or is no longer valid. Please request a new one.";
  }

  // Rate limiting
  if (
    raw.includes("rate limit") ||
    raw.includes("too many requests") ||
    raw.includes("over_email_send_rate_limit") ||
    code === "over_email_send_rate_limit"
  ) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  // Signups disabled
  if (
    raw.includes("signup_disabled") ||
    raw.includes("signups not allowed") ||
    code === "signup_disabled"
  ) {
    return "New account registrations are temporarily unavailable. Please try again later.";
  }

  // Session expired
  if (
    raw.includes("session expired") ||
    raw.includes("invalid refresh token")
  ) {
    return "Your session has expired. Please sign in again.";
  }

  // Generic fallback — never expose the raw error text
  return "Something went wrong. Please try again or contact support if the problem persists.";
};
