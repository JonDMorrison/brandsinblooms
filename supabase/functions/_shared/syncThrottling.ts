// Smart sync throttling utilities

/**
 * Get minimum sync interval based on customer count
 * Larger datasets sync less frequently to reduce API load
 */
export function getAdaptiveSyncInterval(customerCount: number): number {
  if (customerCount < 1000) {
    return 15 * 60 * 1000; // 15 minutes for small datasets
  } else if (customerCount < 10000) {
    return 30 * 60 * 1000; // 30 minutes for medium datasets
  } else if (customerCount < 50000) {
    return 60 * 60 * 1000; // 1 hour for large datasets
  } else {
    return 120 * 60 * 1000; // 2 hours for very large datasets
  }
}

/**
 * Get optimal batch size based on provider and dataset size
 */
export function getOptimalBatchSize(provider: string, customerCount: number): number {
  const baseSizes: Record<string, number> = {
    square: 100,
    clover: 100,
    lightspeed: 100,
  };
  
  const base = baseSizes[provider] || 100;
  
  // Use larger batches for larger datasets to reduce API calls
  if (customerCount > 50000) {
    return Math.min(base * 2.5, 250); // Cap at 250 per API limits
  } else if (customerCount > 10000) {
    return Math.min(base * 2, 200);
  }
  
  return base;
}

/**
 * Check if sync should be throttled based on last sync time
 */
export function shouldThrottleSync(
  lastSyncAt: string | null, 
  customerCount: number
): { shouldThrottle: boolean; nextAllowedAt: Date | null } {
  if (!lastSyncAt) {
    return { shouldThrottle: false, nextAllowedAt: null };
  }
  
  const minInterval = getAdaptiveSyncInterval(customerCount);
  const lastSync = new Date(lastSyncAt).getTime();
  const now = Date.now();
  const nextAllowed = lastSync + minInterval;
  
  if (now < nextAllowed) {
    return { 
      shouldThrottle: true, 
      nextAllowedAt: new Date(nextAllowed) 
    };
  }
  
  return { shouldThrottle: false, nextAllowedAt: null };
}

/**
 * Circuit breaker state management
 * After 3 consecutive failures, pause syncs for increasing durations
 */
export interface CircuitBreakerState {
  consecutiveFailures: number;
  lastFailureAt: string | null;
  circuitOpenUntil: string | null;
}

export function checkCircuitBreaker(state: CircuitBreakerState): { 
  isOpen: boolean; 
  reopenAt: Date | null;
  shouldReset: boolean;
} {
  // If circuit is open, check if it should reopen
  if (state.circuitOpenUntil) {
    const reopenTime = new Date(state.circuitOpenUntil);
    if (new Date() < reopenTime) {
      return { isOpen: true, reopenAt: reopenTime, shouldReset: false };
    }
    // Circuit can be closed, should attempt reset
    return { isOpen: false, reopenAt: null, shouldReset: true };
  }
  
  return { isOpen: false, reopenAt: null, shouldReset: false };
}

export function calculateCircuitOpenDuration(consecutiveFailures: number): number {
  // Exponential backoff: 5min, 15min, 1hr, 4hr, 24hr
  const durations = [
    0,                    // 0-2 failures: no pause
    0,
    0,
    5 * 60 * 1000,        // 3 failures: 5 minutes
    15 * 60 * 1000,       // 4 failures: 15 minutes
    60 * 60 * 1000,       // 5 failures: 1 hour
    4 * 60 * 60 * 1000,   // 6 failures: 4 hours
    24 * 60 * 60 * 1000,  // 7+ failures: 24 hours
  ];
  
  const index = Math.min(consecutiveFailures, durations.length - 1);
  return durations[index];
}

export function getNextCircuitOpenUntil(consecutiveFailures: number): string | null {
  const duration = calculateCircuitOpenDuration(consecutiveFailures);
  if (duration === 0) return null;
  return new Date(Date.now() + duration).toISOString();
}
