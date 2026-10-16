import * as React from "react";
const scenario =
  new URLSearchParams(window.location.search).get("scenario") ?? "owner";
const fullAccess = scenario === "owner";
let selectedCompany: string | null =
  scenario === "master-no-company" ? null : "example-company";
const listeners = new Set<() => void>();
export function useAuth() {
  return {
    user: {
      id: "example-user",
      email: "example@sample.invalid",
      user_metadata: { full_name: "Example User" },
    },
  };
}
export function useOnboardingStatus() {
  return { isCompleted: true, hasEverCompleted: true, isLoading: false };
}
export function useAdmin() {
  const active = React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selectedCompany,
  );
  return {
    isMasterAdmin: scenario === "master-no-company",
    isLoading: false,
    activeTenantId: active,
    hasHydratedTenantContext: true,
    availableTenants: [
      { id: "example-company", name: "Example Garden Centre" },
    ],
    setActiveTenantId: async (value: string) => {
      selectedCompany = value;
      listeners.forEach((listener) => listener());
    },
    refreshTenants: async () => undefined,
  };
}
export function useTenant() {
  return { tenant: { id: "example-company" }, loading: false };
}
export function useUserRole() {
  const admin = useAdmin();
  const granted =
    fullAccess || (scenario === "master-no-company" && !!admin.activeTenantId);
  const permissions = granted
    ? ["customers.read", "campaigns.write", "reports.read"]
    : scenario === "reports-only"
      ? ["reports.read"]
      : [];
  return {
    hasPermission: (key: string) => permissions.includes(key),
    isLoading: scenario === "loading",
    isError: scenario === "error",
    refetch: async () => undefined,
  };
}
