import type { BloomCacheStats } from "./types.ts";
import type { ToolResult } from "./tools/types.ts";

type CacheEntry = {
  result: ToolResult;
  timestamp: number;
};

const toolCache = new Map<string, CacheEntry>();
const cacheAuditScopes = new Map<string, BloomCacheStats>();

const TOOL_TTLS_SECONDS: Record<string, number> = {
  get_dashboard_summary: 60,
  query_customers: 120,
  query_products: 120,
  query_campaigns: 60,
  query_segments: 120,
  get_email_health: 300,
  get_revenue_analytics: 120,
  get_integration_status: 300,
  get_customer_insights: 1800,
  get_customer_detail: 60,
  get_customer_timeline: 60,
};

const ENTITY_CACHE_TOOLS: Record<string, readonly string[]> = {
  campaign: ["query_campaigns", "get_campaign_analytics"],
  customer: [
    "query_customers",
    "get_customer_detail",
    "get_customer_timeline",
    "get_customer_insights",
  ],
  product: ["query_products", "get_product_detail"],
  segment: ["query_segments", "get_segment_members", "compute_audience_size"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = sortedValue(value[key]);
      return sorted;
    }, {});
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortedValue(value));
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function cacheKey(tenantId: string, toolName: string, params: unknown): string {
  return `${tenantId}:${toolName}:${hashString(stableStringify(params))}`;
}

function parseToolNameFromCacheKey(key: string): string | null {
  const parts = key.split(":");
  return parts.length >= 3 ? parts[1] : null;
}

function normalizeEntityType(entityType: string): string {
  return entityType.trim().toLowerCase().replace(/s$/, "");
}

function createEmptyCacheStats(): BloomCacheStats {
  return {
    hits: 0,
    misses: 0,
    invalidations: 0,
  };
}

function ensureCacheAuditScope(scopeId: string | undefined) {
  if (!scopeId) {
    return null;
  }

  const existing = cacheAuditScopes.get(scopeId);
  if (existing) {
    return existing;
  }

  const created = createEmptyCacheStats();
  cacheAuditScopes.set(scopeId, created);
  return created;
}

function incrementCacheStat(
  scopeId: string | undefined,
  key: keyof BloomCacheStats,
) {
  const scope = ensureCacheAuditScope(scopeId);
  if (!scope) {
    return;
  }

  scope[key] += 1;
}

export function startCacheAuditScope(scopeId: string): void {
  cacheAuditScopes.set(scopeId, createEmptyCacheStats());
}

export function readCacheAuditScope(scopeId: string): BloomCacheStats {
  const current = cacheAuditScopes.get(scopeId);
  return current ? { ...current } : createEmptyCacheStats();
}

export function finishCacheAuditScope(scopeId: string): BloomCacheStats {
  const current = readCacheAuditScope(scopeId);
  cacheAuditScopes.delete(scopeId);
  return current;
}

export function getCacheTTL(toolName: string): number {
  return TOOL_TTLS_SECONDS[toolName] ?? 0;
}

export function cacheGet(
  tenantId: string,
  toolName: string,
  params: unknown,
  auditScopeId?: string,
): ToolResult | null {
  const ttlSeconds = getCacheTTL(toolName);
  if (ttlSeconds <= 0) {
    return null;
  }

  const key = cacheKey(tenantId, toolName, params);
  const entry = toolCache.get(key);
  if (!entry) {
    incrementCacheStat(auditScopeId, "misses");
    return null;
  }

  if (Date.now() - entry.timestamp >= ttlSeconds * 1000) {
    toolCache.delete(key);
    incrementCacheStat(auditScopeId, "misses");
    return null;
  }

  incrementCacheStat(auditScopeId, "hits");
  return entry.result;
}

export function cacheSet(
  tenantId: string,
  toolName: string,
  params: unknown,
  result: ToolResult,
): void {
  if (!result.success || result.confirmation_required === true) {
    return;
  }

  if (getCacheTTL(toolName) <= 0) {
    return;
  }

  toolCache.set(cacheKey(tenantId, toolName, params), {
    result,
    timestamp: Date.now(),
  });
}

export function cacheInvalidate(
  tenantId: string,
  entityType: string,
  auditScopeId?: string,
): void {
  incrementCacheStat(auditScopeId, "invalidations");
  const normalizedEntityType = normalizeEntityType(entityType);
  const explicitToolNames = new Set(
    ENTITY_CACHE_TOOLS[normalizedEntityType] ?? [],
  );
  const tenantPrefix = `${tenantId}:`;

  for (const key of toolCache.keys()) {
    if (!key.startsWith(tenantPrefix)) {
      continue;
    }

    const toolName = parseToolNameFromCacheKey(key);
    if (!toolName) {
      continue;
    }

    if (
      explicitToolNames.has(toolName) ||
      toolName.includes(normalizedEntityType)
    ) {
      toolCache.delete(key);
    }
  }
}
