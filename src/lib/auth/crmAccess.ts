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

export interface CrmAccess {
  tenantId: string | null;
  role: CrmRole | null;
  locationIds: string[];
  permissions: CrmPermission[];
}

const ROLE_SET = new Set<string>(CRM_ROLES);
const PERMISSION_SET = new Set<string>(CRM_PERMISSIONS);

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
