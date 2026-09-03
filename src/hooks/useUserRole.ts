import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeCrmAccess,
  type CrmPermission,
  type CrmRole,
} from "@/lib/auth/crmAccess";

export type UserRole = "admin" | "editor" | "member" | "viewer";

const LEGACY_ROLE_LEVEL: Record<CrmRole, number> = {
  staff: 0,
  store_manager: 1,
  marketing: 2,
  owner_admin: 3,
};

const REQUIRED_LEGACY_LEVEL: Record<UserRole, number> = {
  viewer: 0,
  member: 1,
  editor: 2,
  admin: 3,
};

export const useUserRole = () => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["current-crm-access", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_crm_access");
      if (error) throw error;
      return normalizeCrmAccess(data);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const access = useMemo(
    () =>
      query.data ?? {
        tenantId: null,
        role: null,
        locationIds: [],
        permissions: [],
      },
    [query.data],
  );

  const hasPermission = useCallback(
    (permission: CrmPermission) => access.permissions.includes(permission),
    [access.permissions],
  );

  const hasRole = useCallback(
    (requiredRole: UserRole) =>
      access.role !== null &&
      LEGACY_ROLE_LEVEL[access.role] >= REQUIRED_LEGACY_LEVEL[requiredRole],
    [access.role],
  );

  return {
    ...access,
    hasPermission,
    hasRole,
    canEditImages: hasPermission("content.design"),
    canUseCanva: hasPermission("content.design"),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};
