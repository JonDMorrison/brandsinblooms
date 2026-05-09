import { supabase } from "@/integrations/supabase/client";

export const IMPERSONATION_ACTIVE_STORAGE_KEY =
  "bloomsuite_impersonation_active";
export const IMPERSONATION_TARGET_EMAIL_STORAGE_KEY =
  "bloomsuite_impersonation_target_email";
export const IMPERSONATION_STARTED_AT_STORAGE_KEY =
  "bloomsuite_impersonation_started_at";
export const ADMIN_SESSION_BACKUP_STORAGE_KEY =
  "bloomsuite_admin_session_backup";

export interface UseImpersonationReturn {
  isImpersonating: boolean;
  targetEmail: string | null;
  startedAt: string | null;
  endImpersonation: () => void;
}

const getSessionStorageValue = (key: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(key);
};

const clearImpersonationState = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(IMPERSONATION_ACTIVE_STORAGE_KEY);
  window.sessionStorage.removeItem(IMPERSONATION_TARGET_EMAIL_STORAGE_KEY);
  window.sessionStorage.removeItem(IMPERSONATION_STARTED_AT_STORAGE_KEY);
};

export const useImpersonation = (): UseImpersonationReturn => {
  const isImpersonating =
    getSessionStorageValue(IMPERSONATION_ACTIVE_STORAGE_KEY) === "true";
  const targetEmail = getSessionStorageValue(
    IMPERSONATION_TARGET_EMAIL_STORAGE_KEY,
  );
  const startedAt = getSessionStorageValue(
    IMPERSONATION_STARTED_AT_STORAGE_KEY,
  );

  const endImpersonation = () => {
    clearImpersonationState();

    void (async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error("Failed to sign out impersonated session:", error);
        }
      } finally {
        if (typeof window === "undefined") {
          return;
        }

        window.close();
        window.setTimeout(() => {
          if (!window.closed) {
            window.location.href = "/auth";
          }
        }, 100);
      }
    })();
  };

  return {
    isImpersonating,
    targetEmail,
    startedAt,
    endImpersonation,
  };
};
