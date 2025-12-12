/**
 * SMS Error Policy
 * 
 * Classifies Twilio errors into retryable vs permanent categories.
 * This determines whether a message should be retried or dead-lettered.
 */

export type SmsFailureType = 'transient' | 'permanent' | 'compliance' | 'unknown';

export interface ClassifiedError {
  failureType: SmsFailureType;
  retryable: boolean;
  code: string | null;
  message: string;
}

// Permanent error codes - do NOT retry these
const PERMANENT_ERROR_CODES = new Set([
  '21211', // Invalid 'To' phone number
  '21214', // 'To' phone number cannot receive SMS
  '21217', // Phone number does not appear to be valid
  '21408', // Permission to send SMS has not been enabled
  '21610', // Message cannot be sent to the 'To' number (opted out)
  '21612', // The 'To' phone number is not a valid mobile number
  '21614', // 'To' number is not a valid mobile number
  '21617', // The message body exceeds the 1600 character limit
  '21211', // Invalid phone format
  '30003', // Unreachable destination handset
  '30004', // Message blocked
  '30005', // Unknown destination handset
  '30006', // Landline or unreachable carrier
  '30007', // Carrier violation
  '30008', // Unknown error from carrier
  '30022', // Message filtered by carrier
]);

// Compliance-related error codes - permanent, requires user action
const COMPLIANCE_ERROR_CODES = new Set([
  '21610', // Opted out
  '30034', // A2P 10DLC Campaign unregistered
  '30035', // Number not enabled for messaging
  '63006', // STOP received
  '63007', // Opt out
]);

// Transient error codes - safe to retry
const TRANSIENT_ERROR_CODES = new Set([
  '20429', // Rate limit exceeded
  '30001', // Queue overflow
  '30002', // Account suspended (could be temporary)
  '30010', // Message delivery - unknown error (can retry)
  '31000', // Temporary failure
  '54001', // Service temporarily unavailable
  '54002', // Twilio server error
]);

// Error message patterns that indicate transient issues
const TRANSIENT_PATTERNS = [
  /timeout/i,
  /rate limit/i,
  /too many requests/i,
  /temporarily unavailable/i,
  /try again/i,
  /service unavailable/i,
  /network error/i,
  /connection failed/i,
  /econnreset/i,
  /socket hang up/i,
  /5\d{2} error/i, // 5xx errors
];

// Error message patterns that indicate permanent issues
const PERMANENT_PATTERNS = [
  /invalid.*phone/i,
  /not a valid mobile/i,
  /opted out/i,
  /unsubscribed/i,
  /blacklisted/i,
  /cannot receive/i,
  /unreachable/i,
  /landline/i,
  /permission denied/i,
  /not enabled for messaging/i,
];

/**
 * Extract error code from Twilio error response
 */
function extractErrorCode(err: unknown): string | null {
  if (!err) return null;
  
  // Check for Twilio-style error code
  if (typeof err === 'object' && err !== null) {
    const errObj = err as Record<string, unknown>;
    if (errObj.code) return String(errObj.code);
    if (errObj.error_code) return String(errObj.error_code);
    if (errObj.errorCode) return String(errObj.errorCode);
    
    // Check nested message/error
    if (errObj.message && typeof errObj.message === 'string') {
      const codeMatch = errObj.message.match(/(\d{5})/);
      if (codeMatch) return codeMatch[1];
    }
  }
  
  // Check string error
  if (typeof err === 'string') {
    const codeMatch = err.match(/(\d{5})/);
    if (codeMatch) return codeMatch[1];
  }
  
  return null;
}

/**
 * Extract error message from various error formats
 */
function extractErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  
  if (typeof err === 'string') return err;
  
  if (err instanceof Error) return err.message;
  
  if (typeof err === 'object' && err !== null) {
    const errObj = err as Record<string, unknown>;
    if (errObj.message && typeof errObj.message === 'string') return errObj.message;
    if (errObj.error && typeof errObj.error === 'string') return errObj.error;
    if (errObj.error_message && typeof errObj.error_message === 'string') return errObj.error_message;
    return JSON.stringify(err);
  }
  
  return String(err);
}

/**
 * Classify a Twilio error to determine if it's retryable
 */
export function classifyTwilioError(err: unknown): ClassifiedError {
  const code = extractErrorCode(err);
  const message = extractErrorMessage(err);
  
  // Check for compliance errors first
  if (code && COMPLIANCE_ERROR_CODES.has(code)) {
    return {
      failureType: 'compliance',
      retryable: false,
      code,
      message,
    };
  }
  
  // Check for known permanent errors
  if (code && PERMANENT_ERROR_CODES.has(code)) {
    return {
      failureType: 'permanent',
      retryable: false,
      code,
      message,
    };
  }
  
  // Check for known transient errors
  if (code && TRANSIENT_ERROR_CODES.has(code)) {
    return {
      failureType: 'transient',
      retryable: true,
      code,
      message,
    };
  }
  
  // Check message patterns for transient issues
  for (const pattern of TRANSIENT_PATTERNS) {
    if (pattern.test(message)) {
      return {
        failureType: 'transient',
        retryable: true,
        code,
        message,
      };
    }
  }
  
  // Check message patterns for permanent issues
  for (const pattern of PERMANENT_PATTERNS) {
    if (pattern.test(message)) {
      return {
        failureType: 'permanent',
        retryable: false,
        code,
        message,
      };
    }
  }
  
  // HTTP status codes
  if (message.includes('429') || message.toLowerCase().includes('rate')) {
    return {
      failureType: 'transient',
      retryable: true,
      code,
      message,
    };
  }
  
  // Default to unknown + not retryable (conservative)
  return {
    failureType: 'unknown',
    retryable: false,
    code,
    message,
  };
}

/**
 * Calculate backoff delay for retry attempts
 * Uses exponential backoff with a cap
 */
export function calculateRetryDelay(attempt: number, baseDelayMs: number = 2000): number {
  // Exponential backoff: 2s, 4s, 8s, 16s... capped at 60s
  const delay = baseDelayMs * Math.pow(2, attempt - 1);
  return Math.min(delay, 60000);
}
