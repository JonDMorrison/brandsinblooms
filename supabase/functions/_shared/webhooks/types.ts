/**
 * POS Integration Shared Types
 * 
 * All POS adapters MUST use these interfaces for consistency.
 */

/**
 * Result of webhook subscription attempt
 */
export interface EnsureWebhooksResult {
  /** Whether the operation completed without errors */
  success: boolean;
  /** Whether webhook subscription was verified via POS API */
  verified: boolean;
  /** POS-issued subscription ID (if created/found) */
  subscription_id: string | null;
  /** Error message (if any) */
  error: string | null;
  /** What action was taken */
  action: 'created' | 'updated' | 'verified' | 'failed' | 'skipped';
  /** Event types subscribed (if available) */
  event_types?: string[];
}

/**
 * POS Connection webhook state columns
 * These columns MUST exist in all {pos}_connections tables
 */
export interface WebhookStateColumns {
  webhooks_subscribed: boolean | null;
  webhook_subscription_id: string | null;
  webhooks_last_checked_at: string | null;
  webhook_last_error: string | null;
  last_webhook_received_at: string | null;
  webhook_retry_count: number | null;
  webhook_next_retry_at: string | null;
}

/**
 * Standard retry configuration
 */
export const WEBHOOK_RETRY_CONFIG = {
  MAX_RETRIES: 10,
  /** Retry delays in minutes (exponential backoff) */
  RETRY_DELAYS_MINUTES: [5, 15, 45, 120, 360, 1440], // 5m, 15m, 45m, 2h, 6h, 24h
};

/**
 * Calculate next retry timestamp based on retry count
 */
export function calculateNextRetry(retryCount: number): Date {
  const delays = WEBHOOK_RETRY_CONFIG.RETRY_DELAYS_MINUTES;
  const index = Math.min(retryCount, delays.length - 1);
  const delayMinutes = delays[index];
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

/**
 * Check if a connection should be retried
 */
export function shouldRetry(
  webhooksSubscribed: boolean | null,
  retryCount: number | null,
  nextRetryAt: string | null
): boolean {
  // Already subscribed
  if (webhooksSubscribed === true) return false;
  
  // Max retries exceeded
  if ((retryCount || 0) >= WEBHOOK_RETRY_CONFIG.MAX_RETRIES) return false;
  
  // Not due yet
  if (nextRetryAt && new Date(nextRetryAt) > new Date()) return false;
  
  return true;
}

/**
 * POS Provider identifiers
 */
export type POSProvider = 'square' | 'clover' | 'lightspeed' | 'shopify';

/**
 * Standard webhook events that trigger automations
 */
export const AUTOMATION_TRIGGER_EVENTS = [
  'payment.completed',
  'first_purchase',
  'review_request',
  'loyalty_join',
  'refund.created',
  'order.ready_for_pickup',
  'order.shipped',
] as const;

export type AutomationTriggerEvent = typeof AUTOMATION_TRIGGER_EVENTS[number];

/**
 * Standard logging format for webhook handlers
 */
export function logSignatureOK(
  provider: POSProvider,
  eventId: string,
  eventType: string,
  merchantId: string
): void {
  console.log(`✅ SIGNATURE_OK | provider: ${provider} | event_id: ${eventId} | type: ${eventType} | merchant: ${merchantId}`);
}

export function logSignatureFailed(provider: POSProvider, reason?: string): void {
  console.error(`❌ SIGNATURE_FAILED | provider: ${provider}${reason ? ` | reason: ${reason}` : ''}`);
}
