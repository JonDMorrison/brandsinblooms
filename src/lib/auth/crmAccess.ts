export const CRM_ROLES = [
  "owner_admin",
  "marketing",
  "store_manager",
  "staff",
] as const;

export const CRM_PERMISSIONS = [
  "access.manage",
  "customers.read",
  "customers.write",
  "campaigns.read",
  "campaigns.write",
  "campaigns.send",
  "segments.manage",
  "automations.manage",
  "loyalty.read",
  "loyalty.write",
  "reports.read",
  "integrations.manage",
  "content.design",
] as const;

export type CrmRole = (typeof CRM_ROLES)[number];
export type CrmPermission = (typeof CRM_PERMISSIONS)[number];

export const CRM_ROLE_LABELS: Record<CrmRole, string> = {
  owner_admin: "Owner / Admin",
  marketing: "Marketing",
  store_manager: "Store Manager",
  staff: "Staff",
};

export const CRM_ROLE_DESCRIPTIONS: Record<CrmRole, string> = {
  owner_admin: "Full company, billing, location, and team access.",
  marketing: "Company-wide campaigns, segments, customers, and reporting.",
  store_manager: "Campaign and customer access for assigned stores only.",
  staff: "Customer and loyalty lookup for assigned stores only.",
};

export interface CrmAccess {
  tenantId: string | null;
  role: CrmRole | null;
  locationIds: string[];
  permissions: CrmPermission[];
}

const ROLE_SET = new Set<string>(CRM_ROLES);
const PERMISSION_SET = new Set<string>(CRM_PERMISSIONS);

export const isLocationScopedCrmRole = (role: string) =>
  role === "store_manager" || role === "staff";

export const normalizeCrmRole = (role: string): CrmRole => {
  if (role === "owner" || role === "admin") return "owner_admin";
  if (role === "team") return "marketing";
  return ROLE_SET.has(role) ? (role as CrmRole) : "staff";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeCrmAccess(value: unknown): CrmAccess {
  if (!isRecord(value)) {
    return { tenantId: null, role: null, locationIds: [], permissions: [] };
  }

  const role =
    typeof value.role === "string" && ROLE_SET.has(value.role)
      ? (value.role as CrmRole)
      : null;
  const locationIds = Array.isArray(value.locationIds)
    ? Array.from(
        new Set(
          value.locationIds.filter(
            (item): item is string => typeof item === "string" && Boolean(item),
          ),
        ),
      )
    : [];
  const permissions = Array.isArray(value.permissions)
    ? Array.from(
        new Set(
          value.permissions.filter(
            (item): item is CrmPermission =>
              typeof item === "string" && PERMISSION_SET.has(item),
          ),
        ),
      )
    : [];

  return {
    tenantId: typeof value.tenantId === "string" ? value.tenantId : null,
    role,
    locationIds,
    permissions,
  };
}
