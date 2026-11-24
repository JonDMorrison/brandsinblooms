/**
 * Per-tab auth session selection for admin impersonation.
 *
 * Normal tabs keep the Supabase session in localStorage under the default
 * `sb-<ref>-auth-token` key, shared by every tab of the origin. A tab that
 * starts an impersonation (it lands on the impersonation callback route) is
 * switched to `sessionStorage` with its own storage key, so the customer
 * session never leaves that tab:
 *
 * - sessionStorage is not shared with other tabs, so nothing is written where
 *   the admin tabs read their session.
 * - supabase-js names its cross-tab BroadcastChannel after the storage key, so
 *   a per-tab key also keeps SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT events of
 *   the impersonated session away from admin tabs and other impersonation tabs.
 *
 * The decision is made once, when the Supabase client module loads.
 */

export const IMPERSONATION_TAB_ID_STORAGE_KEY = "bloomsuite_impersonation_tab_id";
export const IMPERSONATION_ACTIVE_STORAGE_KEY = "bloomsuite_impersonation_active";
export const IMPERSONATION_TARGET_EMAIL_STORAGE_KEY =
  "bloomsuite_impersonation_target_email";
export const IMPERSONATION_TARGET_TENANT_STORAGE_KEY =
  "bloomsuite_impersonation_target_tenant_id";
export const IMPERSONATION_STARTED_AT_STORAGE_KEY =
  "bloomsuite_impersonation_started_at";

/** Route that redeems an impersonation magic link inside the new tab. */
export const IMPERSONATION_CALLBACK_PATH = "/admin/impersonate/callback";
/** Route that asks the server for a fresh impersonation as the admin. */
export const IMPERSONATION_START_PATH = "/admin/impersonate/start";
/** Where a tab goes after it stops impersonating. */
export const IMPERSONATION_EXIT_PATH = "/admin/tenants";

const IMPERSONATION_TAB_KEYS = [
  IMPERSONATION_TAB_ID_STORAGE_KEY,
  IMPERSONATION_ACTIVE_STORAGE_KEY,
  IMPERSONATION_TARGET_EMAIL_STORAGE_KEY,
  IMPERSONATION_TARGET_TENANT_STORAGE_KEY,
  IMPERSONATION_STARTED_AT_STORAGE_KEY,
] as const;

export type TabAuthMode = "admin" | "impersonation";

export interface TabAuthConfig {
  mode: TabAuthMode;
  storage: Storage;
  /** Undefined keeps supabase-js' default `sb-<ref>-auth-token` key. */
  storageKey: string | undefined;
}

export interface ResolveTabAuthConfigInput {
  pathname: string;
  localStorage: Storage;
  sessionStorage: Storage;
  supabaseUrl: string;
  createTabId: () => string;
}

export function getSupabaseProjectRef(supabaseUrl: string): string {
  return new URL(supabaseUrl).hostname.split(".")[0];
}

export function buildImpersonationStorageKey(
  supabaseUrl: string,
  tabId: string,
): string {
  // Keeps the `sb-<ref>` prefix and `-auth-token` suffix so the existing auth
  // cleanup helpers still recognise it.
  return `sb-${getSupabaseProjectRef(supabaseUrl)}-impersonation-${tabId}-auth-token`;
}

export function clearImpersonationTabState(storage: Storage): void {
  const tabId = storage.getItem(IMPERSONATION_TAB_ID_STORAGE_KEY);
  IMPERSONATION_TAB_KEYS.forEach((key) => storage.removeItem(key));
  if (tabId) {
    Object.keys(storage)
      .filter((key) => key.includes(`-impersonation-${tabId}-`))
      .forEach((key) => storage.removeItem(key));
  }
}

export function resolveTabAuthConfig({
  pathname,
  localStorage,
  sessionStorage,
  supabaseUrl,
  createTabId,
}: ResolveTabAuthConfigInput): TabAuthConfig {
  const adminConfig: TabAuthConfig = {
    mode: "admin",
    storage: localStorage,
    storageKey: undefined,
  };

  // The start route always runs as the signed-in admin: it may have been
  // opened from an impersonating tab whose sessionStorage the browser copied.
  if (pathname === IMPERSONATION_START_PATH) {
    clearImpersonationTabState(sessionStorage);
    return adminConfig;
  }

  // Every callback visit redeems a new link, so it gets a new, empty session
  // slot rather than reusing one copied from the opener tab.
  if (pathname === IMPERSONATION_CALLBACK_PATH) {
    clearImpersonationTabState(sessionStorage);
    const tabId = createTabId();
    sessionStorage.setItem(IMPERSONATION_TAB_ID_STORAGE_KEY, tabId);
    return {
      mode: "impersonation",
      storage: sessionStorage,
      storageKey: buildImpersonationStorageKey(supabaseUrl, tabId),
    };
  }

  const tabId = sessionStorage.getItem(IMPERSONATION_TAB_ID_STORAGE_KEY);
  if (tabId) {
    return {
      mode: "impersonation",
      storage: sessionStorage,
      storageKey: buildImpersonationStorageKey(supabaseUrl, tabId),
    };
  }

  return adminConfig;
}

export function createTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}
