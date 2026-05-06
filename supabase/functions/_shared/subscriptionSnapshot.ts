import {
  getPlanDisplayName,
  isPaidPlan,
  normalizePlanKey,
  resolvePlanFeatures,
  type PlanFeatures,
} from "./planFeatures.ts";

export type OAuthSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "expired";

export interface SubscriptionRecordShape {
  plan?: string | null;
  tier?: string | null;
  status?: string | null;
  billing_interval?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  trial_end?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  deleted_at?: string | null;
  max_connections?: number | null;
}

export interface PlanDefinitionShape {
  max_products?: number | null;
}

export interface SubscriptionSnapshot {
  plan: string;
  plan_display_name: string;
  status: OAuthSubscriptionStatus;
  is_active: boolean;
  can_access_premium: boolean;
  billing_interval: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  feature_limits: PlanFeatures;
}

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normalizeTimestamp(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (isDateOnlyString(value)) {
    return `${value}T00:00:00.000Z`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizePersistedStatus(
  value: string | null | undefined,
): OAuthSubscriptionStatus | null {
  switch (value?.trim().toLowerCase()) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "expired":
      return value.trim().toLowerCase() as OAuthSubscriptionStatus;
    default:
      return null;
  }
}

export function getEffectivePlan(
  subscription: SubscriptionRecordShape | null | undefined,
): string | null {
  return (
    normalizePlanKey(subscription?.tier) ?? normalizePlanKey(subscription?.plan)
  );
}

export function deriveSubscriptionStatus(
  subscription: SubscriptionRecordShape | null,
  now: Date,
): OAuthSubscriptionStatus {
  if (!subscription) {
    return "expired";
  }

  const persisted = normalizePersistedStatus(subscription.status);
  if (persisted) {
    return persisted;
  }

  const plan = getEffectivePlan(subscription);
  if (!plan) {
    return "expired";
  }

  if (subscription.deleted_at) {
    return "canceled";
  }

  const trialEnd = normalizeTimestamp(
    subscription.trial_end ??
      (plan === "free_trial" ? subscription.end_date : null),
  );
  const currentPeriodEnd = normalizeTimestamp(
    subscription.current_period_end ?? subscription.end_date,
  );

  if (plan === "free_trial") {
    if (
      trialEnd &&
      !Number.isNaN(new Date(trialEnd).getTime()) &&
      new Date(trialEnd).getTime() <= now.getTime()
    ) {
      return "expired";
    }

    return "trialing";
  }

  if (plan === "expired") {
    return "expired";
  }

  if (
    currentPeriodEnd &&
    !Number.isNaN(new Date(currentPeriodEnd).getTime()) &&
    new Date(currentPeriodEnd).getTime() <= now.getTime()
  ) {
    return "expired";
  }

  return "active";
}

export function buildSubscriptionSnapshot(
  subscription: SubscriptionRecordShape | null,
  planDefinition: PlanDefinitionShape | null,
  now: Date,
): SubscriptionSnapshot | null {
  if (!subscription) {
    return null;
  }

  const plan = getEffectivePlan(subscription);
  if (!plan) {
    return null;
  }

  const status = deriveSubscriptionStatus(subscription, now);
  const isActive = status === "active" || status === "trialing";

  return {
    plan,
    plan_display_name: getPlanDisplayName(plan) ?? plan,
    status,
    is_active: isActive,
    can_access_premium: isActive && isPaidPlan(plan),
    billing_interval: subscription.billing_interval ?? null,
    current_period_start: normalizeTimestamp(
      subscription.current_period_start ?? subscription.start_date,
    ),
    current_period_end: normalizeTimestamp(
      subscription.current_period_end ?? subscription.end_date,
    ),
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    trial_end: normalizeTimestamp(
      subscription.trial_end ??
        (plan === "free_trial" ? subscription.end_date : null),
    ),
    feature_limits: resolvePlanFeatures({
      plan,
      maxSites:
        typeof subscription.max_connections === "number"
          ? subscription.max_connections
          : null,
      maxProducts:
        typeof planDefinition?.max_products === "number"
          ? planDefinition.max_products
          : null,
    }),
  };
}

export function buildSubscriptionWebhookPayload(params: {
  userId: string;
  tenantId: string | null;
  subscription: SubscriptionRecordShape | null;
  planDefinition: PlanDefinitionShape | null;
  now: Date;
}): Record<string, unknown> {
  const snapshot = buildSubscriptionSnapshot(
    params.subscription,
    params.planDefinition,
    params.now,
  );

  if (!snapshot) {
    return {
      user_id: params.userId,
      tenant_id: params.tenantId,
      subscription: null,
      timestamp: params.now.toISOString(),
    };
  }

  return {
    user_id: params.userId,
    tenant_id: params.tenantId,
    plan: snapshot.plan,
    plan_display_name: snapshot.plan_display_name,
    status: snapshot.status,
    is_active: snapshot.is_active,
    can_access_premium: snapshot.can_access_premium,
    billing_interval: snapshot.billing_interval,
    current_period_start: snapshot.current_period_start,
    current_period_end: snapshot.current_period_end,
    cancel_at_period_end: snapshot.cancel_at_period_end,
    trial_end: snapshot.trial_end,
    feature_limits: snapshot.feature_limits,
    timestamp: params.now.toISOString(),
  };
}
