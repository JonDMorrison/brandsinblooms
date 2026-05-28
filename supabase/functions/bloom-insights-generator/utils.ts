import type { GeneratedInsight } from "./types.ts";

export const DEFAULT_INSIGHT_EXPIRY_DAYS = 7;
export const REVENUE_INSIGHT_EXPIRY_DAYS = 2;

export function buildExpiresAt(days: number, now = new Date()) {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

export function buildInsightDedupKey(
  insightType: string,
  entityId: string | null,
) {
  return `${insightType}:${entityId ?? "none"}`;
}

export function toFiniteNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return count === 1 ? singular : plural;
}

export function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentValue(value: number) {
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(normalized) >= 10 ? 0 : 1,
  }).format(normalized);
}

export function customerDisplayName(customer: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}) {
  const fullName = [customer.first_name?.trim(), customer.last_name?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  return fullName || customer.email?.trim() || "Customer";
}

export function summarizePreviewItems(items: string[], moreLabel: string) {
  if (items.length === 0) {
    return null;
  }

  const preview = items.slice(0, 3).join(", ");
  const remainingCount = Math.max(0, items.length - 3);
  if (remainingCount === 0) {
    return preview;
  }

  return `${preview}, and ${remainingCount} more ${pluralize(remainingCount, moreLabel)}`;
}

export function toInsightInsert(tenantId: string, insight: GeneratedInsight) {
  return {
    tenant_id: tenantId,
    insight_type: insight.insightType,
    title: insight.title,
    description: insight.description,
    action_prompt: insight.actionPrompt,
    entity_type: insight.entityType,
    entity_id: insight.entityId,
    severity: insight.severity,
    expires_at: insight.expiresAt,
  };
}
