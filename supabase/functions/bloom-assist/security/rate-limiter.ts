import type { JsonObject, PersistenceClient } from "../types.ts";
import { logSecurityAuditEvent } from "./audit.ts";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number | null;
};

type WindowCounter = {
  count: number;
  windowStart: number;
};

const ONE_HOUR_MS = 60 * 60 * 1000;
const USER_HOURLY_LIMIT = 60;
const TENANT_HOURLY_LIMIT = 500;
const MAX_CONCURRENT_REQUESTS_PER_USER = 2;
const PERSISTENT_CHECK_THRESHOLD = 0.9;
const DEFAULT_RETRY_AFTER_SECONDS = 300;

const userCounters = new Map<string, WindowCounter>();
const tenantCounters = new Map<string, WindowCounter>();
const activeRequestCounts = new Map<string, number>();

function nowMs(): number {
  return Date.now();
}

function getWindowCounter(
  store: Map<string, WindowCounter>,
  key: string,
  now: number,
): WindowCounter {
  const existing = store.get(key);
  if (existing && now - existing.windowStart < ONE_HOUR_MS) {
    return existing;
  }

  const next = { count: 0, windowStart: now };
  store.set(key, next);
  return next;
}

function secondsUntilWindowReset(counter: WindowCounter, now: number): number {
  const remainingMs = Math.max(
    1_000,
    ONE_HOUR_MS - (now - counter.windowStart),
  );
  return Math.ceil(remainingMs / 1_000);
}

function isNearLimit(count: number, limit: number): boolean {
  return count >= Math.floor(limit * PERSISTENT_CHECK_THRESHOLD);
}

async function countPromptEvents(
  serviceClient: PersistenceClient,
  filters: { tenantId: string; userId?: string },
): Promise<number> {
  const since = new Date(nowMs() - ONE_HOUR_MS).toISOString();
  let query = serviceClient
    .from("bloom_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", filters.tenantId)
    .eq("event_type", "prompt")
    .gte("created_at", since);

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to check Bloom rate limit: ${error.message}`);
  }

  return count ?? 0;
}

async function logRateLimit(
  serviceClient: PersistenceClient,
  tenantId: string,
  userId: string,
  eventData: JsonObject,
): Promise<void> {
  try {
    await logSecurityAuditEvent(
      serviceClient,
      tenantId,
      userId,
      "rate_limit",
      eventData,
    );
  } catch (error) {
    console.error("[bloom-assist] Failed to log rate limit audit event", error);
  }
}

function reserveConcurrentRequest(userId: string): boolean {
  const activeCount = activeRequestCounts.get(userId) ?? 0;
  if (activeCount >= MAX_CONCURRENT_REQUESTS_PER_USER) {
    return false;
  }

  activeRequestCounts.set(userId, activeCount + 1);
  return true;
}

export function releaseRateLimitSlot(userId: string): void {
  const activeCount = activeRequestCounts.get(userId) ?? 0;
  if (activeCount <= 1) {
    activeRequestCounts.delete(userId);
    return;
  }

  activeRequestCounts.set(userId, activeCount - 1);
}

export async function checkRateLimit(
  tenantId: string,
  userId: string,
  serviceClient: PersistenceClient,
): Promise<RateLimitResult> {
  const now = nowMs();
  const userCounter = getWindowCounter(userCounters, userId, now);
  const tenantCounter = getWindowCounter(tenantCounters, tenantId, now);
  const activeCount = activeRequestCounts.get(userId) ?? 0;

  if (activeCount >= MAX_CONCURRENT_REQUESTS_PER_USER) {
    await logRateLimit(serviceClient, tenantId, userId, {
      limit_type: "concurrent_user_requests",
      current_count: activeCount,
      limit_value: MAX_CONCURRENT_REQUESTS_PER_USER,
    });
    return { allowed: false, retryAfterSeconds: 30 };
  }

  if (userCounter.count >= USER_HOURLY_LIMIT) {
    await logRateLimit(serviceClient, tenantId, userId, {
      limit_type: "user_hourly_messages",
      current_count: userCounter.count,
      limit_value: USER_HOURLY_LIMIT,
    });
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilWindowReset(userCounter, now),
    };
  }

  if (tenantCounter.count >= TENANT_HOURLY_LIMIT) {
    await logRateLimit(serviceClient, tenantId, userId, {
      limit_type: "tenant_hourly_messages",
      current_count: tenantCounter.count,
      limit_value: TENANT_HOURLY_LIMIT,
    });
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilWindowReset(tenantCounter, now),
    };
  }

  if (isNearLimit(userCounter.count + 1, USER_HOURLY_LIMIT)) {
    const persistentUserCount = await countPromptEvents(serviceClient, {
      tenantId,
      userId,
    });
    if (persistentUserCount >= USER_HOURLY_LIMIT) {
      await logRateLimit(serviceClient, tenantId, userId, {
        limit_type: "user_hourly_messages",
        current_count: persistentUserCount,
        limit_value: USER_HOURLY_LIMIT,
        enforcement_source: "audit_log",
      });
      return { allowed: false, retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS };
    }
  }

  if (isNearLimit(tenantCounter.count + 1, TENANT_HOURLY_LIMIT)) {
    const persistentTenantCount = await countPromptEvents(serviceClient, {
      tenantId,
    });
    if (persistentTenantCount >= TENANT_HOURLY_LIMIT) {
      await logRateLimit(serviceClient, tenantId, userId, {
        limit_type: "tenant_hourly_messages",
        current_count: persistentTenantCount,
        limit_value: TENANT_HOURLY_LIMIT,
        enforcement_source: "audit_log",
      });
      return { allowed: false, retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS };
    }
  }

  if (!reserveConcurrentRequest(userId)) {
    await logRateLimit(serviceClient, tenantId, userId, {
      limit_type: "concurrent_user_requests",
      current_count:
        activeRequestCounts.get(userId) ?? MAX_CONCURRENT_REQUESTS_PER_USER,
      limit_value: MAX_CONCURRENT_REQUESTS_PER_USER,
    });
    return { allowed: false, retryAfterSeconds: 30 };
  }

  userCounter.count += 1;
  tenantCounter.count += 1;

  return { allowed: true, retryAfterSeconds: null };
}
