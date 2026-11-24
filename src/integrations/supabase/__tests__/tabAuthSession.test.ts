import { beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_TAB_TENANT_STORAGE_KEY,
  ADMIN_TENANT_HEADER,
  readTabAdminTenant,
  setRequestAdminTenant,
  withAdminTenantHeader,
  writeTabAdminTenant,
} from "../adminTenantScope";
import {
  IMPERSONATION_ACTIVE_STORAGE_KEY,
  IMPERSONATION_CALLBACK_PATH,
  IMPERSONATION_START_PATH,
  IMPERSONATION_TAB_ID_STORAGE_KEY,
  buildImpersonationStorageKey,
  clearImpersonationTabState,
  resolveTabAuthConfig,
} from "../tabAuthSession";

const SUPABASE_URL = "https://udldmkqwnxhdeztyqcau.supabase.co";

function resolve(pathname: string, ids: string[] = ["tab-1", "tab-2"]) {
  return resolveTabAuthConfig({
    pathname,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    supabaseUrl: SUPABASE_URL,
    createTabId: () => ids.shift() ?? "tab-x",
  });
}

describe("per-tab Supabase auth storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps normal tabs on the shared localStorage session with the default key", () => {
    const config = resolve("/dashboard");
    expect(config.mode).toBe("admin");
    expect(config.storage).toBe(window.localStorage);
    expect(config.storageKey).toBeUndefined();
  });

  it("gives the impersonation callback its own sessionStorage slot with a distinct key", () => {
    const config = resolve(IMPERSONATION_CALLBACK_PATH);
    expect(config.mode).toBe("impersonation");
    expect(config.storage).toBe(window.sessionStorage);
    expect(config.storageKey).toBe(
      "sb-udldmkqwnxhdeztyqcau-impersonation-tab-1-auth-token",
    );
    // supabase-js names its BroadcastChannel after the storage key, so the
    // impersonated session never reaches the admin's default channel.
    expect(config.storageKey).not.toBe("sb-udldmkqwnxhdeztyqcau-auth-token");
    expect(window.sessionStorage.getItem(IMPERSONATION_TAB_ID_STORAGE_KEY)).toBe(
      "tab-1",
    );
  });

  it("keeps an impersonating tab in impersonation mode after it navigates", () => {
    resolve(IMPERSONATION_CALLBACK_PATH);
    const config = resolve("/dashboard");
    expect(config.mode).toBe("impersonation");
    expect(config.storageKey).toBe(
      buildImpersonationStorageKey(SUPABASE_URL, "tab-1"),
    );
  });

  it("starts every callback with a fresh slot instead of one copied from the opener", () => {
    resolve(IMPERSONATION_CALLBACK_PATH);
    const copied = buildImpersonationStorageKey(SUPABASE_URL, "tab-1");
    window.sessionStorage.setItem(copied, "{\"access_token\":\"customer-a\"}");

    const config = resolve(IMPERSONATION_CALLBACK_PATH, ["tab-9"]);
    expect(config.storageKey).toBe(
      buildImpersonationStorageKey(SUPABASE_URL, "tab-9"),
    );
    expect(window.sessionStorage.getItem(copied)).toBeNull();
  });

  it("runs the start route as the admin even when sessionStorage was copied from an impersonating tab", () => {
    resolve(IMPERSONATION_CALLBACK_PATH);
    window.sessionStorage.setItem(IMPERSONATION_ACTIVE_STORAGE_KEY, "true");

    const config = resolve(IMPERSONATION_START_PATH);
    expect(config.mode).toBe("admin");
    expect(config.storage).toBe(window.localStorage);
    expect(window.sessionStorage.getItem(IMPERSONATION_TAB_ID_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(IMPERSONATION_ACTIVE_STORAGE_KEY)).toBeNull();
  });

  it("ending impersonation clears only this tab's slot and never the admin session", () => {
    window.localStorage.setItem("sb-udldmkqwnxhdeztyqcau-auth-token", "admin");
    resolve(IMPERSONATION_CALLBACK_PATH);
    const key = buildImpersonationStorageKey(SUPABASE_URL, "tab-1");
    window.sessionStorage.setItem(key, "customer");
    window.sessionStorage.setItem(IMPERSONATION_ACTIVE_STORAGE_KEY, "true");

    clearImpersonationTabState(window.sessionStorage);

    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(window.sessionStorage.getItem(IMPERSONATION_ACTIVE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem("sb-udldmkqwnxhdeztyqcau-auth-token")).toBe(
      "admin",
    );
    expect(resolve("/admin/tenants").mode).toBe("admin");
  });
});

describe("per-tab admin company header", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setRequestAdminTenant(undefined);
  });

  const restUrl = `${SUPABASE_URL}/rest/v1/crm_customers?select=*`;

  it("sends no header until the tab's admin context is known", () => {
    expect(withAdminTenantHeader(restUrl, { headers: { apikey: "k" } })).toEqual({
      headers: { apikey: "k" },
    });
  });

  it("adds the tab's company to PostgREST requests only", () => {
    setRequestAdminTenant("tenant-a");
    const rest = withAdminTenantHeader(restUrl, { headers: { apikey: "k" } });
    const headers = new Headers(rest?.headers);
    expect(headers.get(ADMIN_TENANT_HEADER)).toBe("tenant-a");
    expect(headers.get("apikey")).toBe("k");

    // Edge functions answer preflights with a fixed allow-list.
    const fn = withAdminTenantHeader(`${SUPABASE_URL}/functions/v1/bloom-assist`, {});
    expect(new Headers(fn?.headers).has(ADMIN_TENANT_HEADER)).toBe(false);
  });

  it("states an explicit empty selection instead of falling back to the shared row", () => {
    setRequestAdminTenant(null);
    const headers = new Headers(withAdminTenantHeader(restUrl, {})?.headers);
    expect(headers.get(ADMIN_TENANT_HEADER)).toBe("none");
  });

  it("stores the selection per tab and per admin", () => {
    writeTabAdminTenant("admin-1", "tenant-a");
    expect(readTabAdminTenant("admin-1")).toBe("tenant-a");
    expect(readTabAdminTenant("admin-2")).toBeUndefined();
    writeTabAdminTenant("admin-1", null);
    expect(readTabAdminTenant("admin-1")).toBeNull();
    expect(window.sessionStorage.getItem(ADMIN_TAB_TENANT_STORAGE_KEY)).toContain(
      "admin-1",
    );
    expect(window.localStorage.getItem(ADMIN_TAB_TENANT_STORAGE_KEY)).toBeNull();
  });
});
