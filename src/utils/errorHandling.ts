import { toast } from 'sonner';
import { captureException as uptraceException, captureMessage } from './uptrace'

export interface AppError {
  message: string;
  code?: string;
  isNetworkError?: boolean;
}

export const isNetworkError = (error: any): boolean => {
  return !navigator.onLine || 
         error?.message?.includes('Failed to fetch') ||
         error?.message?.includes('Network Error') ||
         error?.message?.includes('ERR_INTERNET_DISCONNECTED');
};

export const handleError = (error: any, context: string): AppError => {
  // Better error logging for debugging
  console.error(`[${context}] Raw error object:`, error);
  console.error(`[${context}] Error type:`, typeof error);
  console.error(`[${context}] Error constructor:`, error?.constructor?.name);
  
  const appError: AppError = {
    message: error?.message || error?.toString() || 'An unexpected error occurred',
    code: error?.code || error?.status || 'UNKNOWN',
    isNetworkError: isNetworkError(error)
  };

  // Log critical errors to console
  if (appError.code === 'UNAUTHORIZED' || 
      appError.code === 'PAYMENT_REQUIRED' ||
      appError.message.includes('OpenAI API key not configured') ||
      (appError.message.includes('Content generation failed') && context.includes('critical'))) {
    console.error(`[CRITICAL ERROR] ${context}:`, {
      errorCode: appError.code,
      errorMessage: appError.message,
      isNetworkError: appError.isNetworkError,
      originalError: error
    });
  }

  // Send critical errors to Uptrace
  if (appError.code === 'UNAUTHORIZED' || 
      appError.code === 'PAYMENT_REQUIRED' ||
      appError.message.includes('OpenAI API key not configured') ||
      (appError.message.includes('Content generation failed') && context.includes('critical'))) {
    uptraceException(error, { context, errorCode: appError.code, isNetworkError: appError.isNetworkError });
  }

  // Only show toasts for critical errors that require user action
  if (appError.message.includes('OpenAI API key not configured')) {
    toast.error('AI service unavailable. Please contact support.');
  } else if (appError.code === 'UNAUTHORIZED' || appError.message.includes('Authentication')) {
    toast.error('Please sign in again to continue.');
  } else if (appError.code === 'PAYMENT_REQUIRED' || appError.message.includes('subscription')) {
    toast.error('Subscription required. Please check your billing.');
  } else if (appError.message.includes('Content generation failed') && context.includes('critical')) {
    toast.error('Content generation failed. Please try again.');
  }
  // Silently handle: network errors, API configuration issues, validation errors, non-critical failures

  return appError;
};

export const logError = (error: any, context: string) => {
  console.error(`[${context}] Error:`, error);
  
  // Additional detailed logging
  if (error && typeof error === 'object') {
    console.error(`[${context}] Error details:`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });
  }
};

/**
 * Maps raw Supabase/auth error messages to user-friendly messages.
 * Never exposes infrastructure-level error details to the user.
 */
export const getAuthErrorMessage = (error: any): string => {
  const raw: string = (error?.message || error?.toString() || '').toLowerCase();
  const code: string = (error?.code || error?.status || '').toLowerCase();

  // Network / connectivity
  if (isNetworkError(error) || raw.includes('failed to fetch') || raw.includes('network')) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  // Invalid credentials
  if (raw.includes('invalid login credentials') || raw.includes('invalid credentials')) {
    return 'The email or password you entered is incorrect. Please try again.';
  }

  // Email not confirmed
  if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed') || code === 'email_not_confirmed') {
    return 'Please verify your email address before signing in. Check your inbox for a confirmation link.';
  }

  // User not found
  if (raw.includes('user not found') || raw.includes('no user found')) {
    return 'No account found with this email address. Please check your email or create a new account.';
  }

  // Account already exists
  if (raw.includes('user already registered') || raw.includes('already been registered') || raw.includes('already exists')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }

  // Weak / invalid password
  if (raw.includes('password should be at least') || raw.includes('weak_password') || code === 'weak_password') {
    return 'Your password is too weak. Please choose a stronger password with at least 8 characters.';
  }

  // Invalid email format
  if (raw.includes('invalid email') || raw.includes('email_address_invalid') || code === 'email_address_invalid') {
    return 'Please enter a valid email address.';
  }

  // Token expired or invalid
  if (
    raw.includes('token has expired') ||
    raw.includes('token is invalid') ||
    raw.includes('invalid token') ||
    raw.includes('jwt expired') ||
    raw.includes('refresh_token_not_found') ||
    code === 'otp_expired'
  ) {
    return 'This link has expired or is no longer valid. Please request a new one.';
  }

  // Rate limiting
  if (
    raw.includes('rate limit') ||
    raw.includes('too many requests') ||
    raw.includes('over_email_send_rate_limit') ||
    code === 'over_email_send_rate_limit'
  ) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }

  // Signups disabled
  if (raw.includes('signup_disabled') || raw.includes('signups not allowed') || code === 'signup_disabled') {
    return 'New account registrations are temporarily unavailable. Please try again later.';
  }

  // Session expired
  if (raw.includes('session expired') || raw.includes('invalid refresh token')) {
    return 'Your session has expired. Please sign in again.';
  }

  // Generic fallback — never expose the raw error text
  return 'Something went wrong. Please try again or contact support if the problem persists.';
};
