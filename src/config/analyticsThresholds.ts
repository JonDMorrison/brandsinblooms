/**
 * Analytics Health Thresholds Configuration
 * 
 * Centralized thresholds for email/SMS analytics health monitoring.
 * Used by the health page and alert systems.
 */

export interface ThresholdConfig {
  green: number;
  yellow: number;
  red: number;
  unit: string;
  description: string;
  action: string;
}

export const ANALYTICS_THRESHOLDS = {
  ingestLag: {
    green: 2,
    yellow: 10,
    red: 10,
    unit: 'minutes',
    description: 'Time since last event was ingested',
    action: 'Check webhook delivery and edge function logs',
  },
  
  complaintRate: {
    green: 0.1,
    yellow: 0.3,
    red: 0.3,
    unit: '%',
    description: 'Percentage of recipients marking as spam (30d)',
    action: 'Review list hygiene and sending practices',
  },
  
  bounceRate: {
    green: 2,
    yellow: 5,
    red: 5,
    unit: '%',
    description: 'Hard bounce rate over last 30 days',
    action: 'Clean email list and verify addresses',
  },
  
  webhook5xxRate: {
    green: 1,
    yellow: 5,
    red: 5,
    unit: '%',
    description: 'Webhook error rate in last 5 minutes',
    action: 'Check edge function logs and database connectivity',
  },
  
  parityDelta: {
    green: 0.1,
    yellow: 1,
    red: 1,
    unit: '%',
    description: 'Metrics drift between cached and computed values',
    action: 'Run backfill from provider and recompute metrics',
  },
  
  clickBurst: {
    green: 500,
    yellow: 1000,
    red: 1000,
    unit: 'clicks/min',
    description: 'Click rate per campaign per minute',
    action: 'Investigate for click fraud or bot traffic',
  },
} as const;

/**
 * Determine status based on value and thresholds
 */
export function getHealthStatus(
  value: number,
  thresholds: ThresholdConfig,
  higherIsBetter: boolean = false
): 'green' | 'yellow' | 'red' {
  if (higherIsBetter) {
    if (value >= thresholds.green) return 'green';
    if (value >= thresholds.yellow) return 'yellow';
    return 'red';
  } else {
    if (value <= thresholds.green) return 'green';
    if (value <= thresholds.yellow) return 'yellow';
    return 'red';
  }
}

/**
 * Check if sending should be blocked due to poor list health
 */
export function shouldBlockSend(bounceRate: number, complaintRate: number): {
  blocked: boolean;
  reason: string | null;
} {
  if (complaintRate > ANALYTICS_THRESHOLDS.complaintRate.red) {
    return {
      blocked: true,
      reason: `Complaint rate (${complaintRate.toFixed(3)}%) exceeds threshold (${ANALYTICS_THRESHOLDS.complaintRate.red}%)`,
    };
  }
  
  if (bounceRate > ANALYTICS_THRESHOLDS.bounceRate.red) {
    return {
      blocked: true,
      reason: `Bounce rate (${bounceRate.toFixed(2)}%) exceeds threshold (${ANALYTICS_THRESHOLDS.bounceRate.red}%)`,
    };
  }
  
  return { blocked: false, reason: null };
}

/**
 * Format threshold for display
 */
export function formatThreshold(value: number, unit: string): string {
  if (unit === '%') {
    return `${value}%`;
  }
  return `${value} ${unit}`;
}

export type ThresholdKey = keyof typeof ANALYTICS_THRESHOLDS;
