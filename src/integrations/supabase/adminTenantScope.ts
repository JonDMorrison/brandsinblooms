/**
 * The company a master admin is working in, per browser tab.
 *
 * public.admin_session_context holds one row per admin, so it cannot tell two
 * tabs apart. Each tab therefore keeps its own selection in sessionStorage and
 * sends it on every PostgREST request as the `x-bloom-admin-tenant` header.
 * public.admin_active_tenant_id() honours the header only for master admins
 * (who could already point their context row at any company) and falls back to
 * the context row when the header is absent.
 *
 * The header is added to REST requests only: edge functions answer CORS
 * preflights with a fixed header allow-list and would reject it.
 */

export const ADMIN_TENANT_HEADER = "x-bloom-admin-tenant";
/** Header value meaning "this tab has no company selected". */
export const ADMIN_TENANT_HEADER_NONE = "none";
export const ADMIN_TAB_TENANT_STORAGE_KEY = "bloomsuite_admin_tab_tenant";

interface StoredTabTenant {
  adminUserId: string;
  tenantId: string | null;
}

// undefined: send no header (not a master admin, or not hydrated yet).
let requestAdminTenant: string | null | undefined;

export function setRequestAdminTenant(tenantId: string | null | undefined) {
  requestAdminTenant = tenantId;
}

export function getAdminTenantHeaderValue(): string | undefined {
  if (requestAdminTenant === undefined) return undefined;
  return requestAdminTenant ?? ADMIN_TENANT_HEADER_NONE;
}

function getTabStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Returns `undefined` when this tab has not chosen a company for this admin. */
export function readTabAdminTenant(
  adminUserId: string,
): string | null | undefined {
  const raw = getTabStorage()?.getItem(ADMIN_TAB_TENANT_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTabTenant>;
    if (parsed.adminUserId !== adminUserId) return undefined;
    return typeof parsed.tenantId === "string" ? parsed.tenantId : null;
  } catch {
    return undefined;
  }
}

export function writeTabAdminTenant(
  adminUserId: string,
  tenantId: string | null,
) {
  const value: StoredTabTenant = { adminUserId, tenantId };
  try {
    getTabStorage()?.setItem(ADMIN_TAB_TENANT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the in-memory header still
    // scopes this tab until it reloads.
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Adds the tab's admin company header to PostgREST requests. */
export function withAdminTenantHeader(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): RequestInit | undefined {
  const value = getAdminTenantHeaderValue();
  if (value === undefined || !requestUrl(input).includes("/rest/v1/")) {
    return init;
  }
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  headers.set(ADMIN_TENANT_HEADER, value);
  return { ...init, headers };
}
