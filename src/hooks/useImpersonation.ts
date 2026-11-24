import {
  endImpersonationTab,
  isImpersonationTab,
} from "@/integrations/supabase/client";
import {
  IMPERSONATION_ACTIVE_STORAGE_KEY,
  IMPERSONATION_START_PATH,
  IMPERSONATION_STARTED_AT_STORAGE_KEY,
  IMPERSONATION_TARGET_EMAIL_STORAGE_KEY,
  IMPERSONATION_TARGET_TENANT_STORAGE_KEY,
} from "@/integrations/supabase/tabAuthSession";

export {
  IMPERSONATION_ACTIVE_STORAGE_KEY,
  IMPERSONATION_STARTED_AT_STORAGE_KEY,
  IMPERSONATION_TARGET_EMAIL_STORAGE_KEY,
  IMPERSONATION_TARGET_TENANT_STORAGE_KEY,
};

export interface UseImpersonationReturn {
  isImpersonating: boolean;
  targetEmail: string | null;
  targetTenantId: string | null;
  startedAt: string | null;
  endImpersonation: () => void;
  openCustomerInNewTab: () => void;
}

const getSessionStorageValue = (key: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(key);
};

/**
 * URL of the admin route that starts a fresh impersonation of the same
 * customer. A copied link or a plain new tab cannot carry the impersonated
 * session (it lives only in the impersonating tab), so a new tab asks the
 * server for its own session as the admin instead.
 */
export const buildImpersonationStartUrl = (
  origin: string,
  targetEmail: string,
  targetTenantId: string | null,
): string => {
  const params = new URLSearchParams({ target_email: targetEmail });
  if (targetTenantId) {
    params.set("target_tenant_id", targetTenantId);
  }
  return `${origin}${IMPERSONATION_START_PATH}?${params.toString()}`;
};

export const useImpersonation = (): UseImpersonationReturn => {
  const isImpersonating =
    isImpersonationTab &&
    getSessionStorageValue(IMPERSONATION_ACTIVE_STORAGE_KEY) === "true";
  const targetEmail = getSessionStorageValue(
    IMPERSONATION_TARGET_EMAIL_STORAGE_KEY,
  );
  const targetTenantId = getSessionStorageValue(
    IMPERSONATION_TARGET_TENANT_STORAGE_KEY,
  );
  const startedAt = getSessionStorageValue(
    IMPERSONATION_STARTED_AT_STORAGE_KEY,
  );

  const endImpersonation = () => {
    void endImpersonationTab();
  };

  const openCustomerInNewTab = () => {
    if (typeof window === "undefined" || !targetEmail) {
      return;
    }

    window.open(
      buildImpersonationStartUrl(
        window.location.origin,
        targetEmail,
        targetTenantId,
      ),
      "_blank",
      "noopener",
    );
  };

  return {
    isImpersonating,
    targetEmail,
    targetTenantId,
    startedAt,
    endImpersonation,
    openCustomerInNewTab,
  };
};
