export interface PlanFeatures {
  max_sites: number;
  max_products: number;
  custom_domain: boolean;
  remove_branding: boolean;
  priority_support: boolean;
}

export interface PlanQuotaDefaults {
  contacts_limit: number;
  email_quota: number;
  sms_quota: number;
  max_connections: number;
}

interface PlanMetadata {
  displayName: string;
  maxProducts: number;
  maxSites: number;
  customDomain: boolean;
  removeBranding: boolean;
  prioritySupport: boolean;
  contactsLimit: number;
  emailQuota: number;
  smsQuota: number;
  maxConnections: number;
}

const PLAN_METADATA: Record<string, PlanMetadata> = {
  free_trial: {
    displayName: "Free Trial",
    maxProducts: 1000,
    maxSites: 1,
    customDomain: false,
    removeBranding: false,
    prioritySupport: false,
    contactsLimit: 5000,
    emailQuota: 1000,
    smsQuota: 250,
    maxConnections: 1,
  },
  seed: {
    displayName: "Seed Plan",
    maxProducts: -1,
    maxSites: 3,
    customDomain: false,
    removeBranding: false,
    prioritySupport: false,
    contactsLimit: -1,
    emailQuota: 10000,
    smsQuota: 1000,
    maxConnections: 3,
  },
  sprout: {
    displayName: "Sprout Plan",
    maxProducts: -1,
    maxSites: 10,
    customDomain: true,
    removeBranding: false,
    prioritySupport: false,
    contactsLimit: -1,
    emailQuota: 20000,
    smsQuota: 2000,
    maxConnections: 10,
  },
  bloom: {
    displayName: "Bloom Plan",
    maxProducts: -1,
    maxSites: 25,
    customDomain: true,
    removeBranding: true,
    prioritySupport: false,
    contactsLimit: -1,
    emailQuota: 100000,
    smsQuota: 5000,
    maxConnections: 25,
  },
  thrive: {
    displayName: "Thrive Plan",
    maxProducts: -1,
    maxSites: -1,
    customDomain: true,
    removeBranding: true,
    prioritySupport: true,
    contactsLimit: -1,
    emailQuota: -1,
    smsQuota: 50000,
    maxConnections: -1,
  },
  starter: {
    displayName: "Starter Plan",
    maxProducts: 2500,
    maxSites: 3,
    customDomain: false,
    removeBranding: false,
    prioritySupport: false,
    contactsLimit: 5000,
    emailQuota: 5000,
    smsQuota: 500,
    maxConnections: 3,
  },
  professional: {
    displayName: "Professional Plan",
    maxProducts: 10000,
    maxSites: 10,
    customDomain: true,
    removeBranding: true,
    prioritySupport: false,
    contactsLimit: 25000,
    emailQuota: 25000,
    smsQuota: 2500,
    maxConnections: 10,
  },
  enterprise: {
    displayName: "Enterprise Plan",
    maxProducts: 50000,
    maxSites: -1,
    customDomain: true,
    removeBranding: true,
    prioritySupport: true,
    contactsLimit: 100000,
    emailQuota: 100000,
    smsQuota: 10000,
    maxConnections: -1,
  },
  expired: {
    displayName: "Expired",
    maxProducts: 0,
    maxSites: 0,
    customDomain: false,
    removeBranding: false,
    prioritySupport: false,
    contactsLimit: 0,
    emailQuota: 0,
    smsQuota: 0,
    maxConnections: 0,
  },
};

function toTitleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function normalizePlanKey(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function getPlanMetadata(plan: string | null | undefined): PlanMetadata | null {
  const normalized = normalizePlanKey(plan);
  return normalized ? (PLAN_METADATA[normalized] ?? null) : null;
}

export function isPaidPlan(plan: string | null | undefined): boolean {
  const normalized = normalizePlanKey(plan);
  return (
    normalized !== null &&
    normalized !== "free_trial" &&
    normalized !== "expired"
  );
}

export function getPlanDisplayName(
  plan: string | null | undefined,
): string | null {
  const normalized = normalizePlanKey(plan);
  if (!normalized) {
    return null;
  }

  return getPlanMetadata(normalized)?.displayName ?? toTitleCase(normalized);
}

export function getPlanQuotaDefaults(
  plan: string | null | undefined,
): PlanQuotaDefaults {
  const metadata = getPlanMetadata(plan);

  return {
    contacts_limit: metadata?.contactsLimit ?? 0,
    email_quota: metadata?.emailQuota ?? 0,
    sms_quota: metadata?.smsQuota ?? 0,
    max_connections: metadata?.maxConnections ?? 0,
  };
}

export function resolvePlanFeatures(params: {
  plan: string | null | undefined;
  maxSites?: number | null;
  maxProducts?: number | null;
}): PlanFeatures {
  const metadata = getPlanMetadata(params.plan);

  return {
    max_sites:
      typeof params.maxSites === "number"
        ? params.maxSites
        : (metadata?.maxSites ?? 0),
    max_products:
      typeof params.maxProducts === "number"
        ? params.maxProducts
        : (metadata?.maxProducts ?? 0),
    custom_domain: metadata?.customDomain ?? false,
    remove_branding: metadata?.removeBranding ?? false,
    priority_support: metadata?.prioritySupport ?? false,
  };
}
