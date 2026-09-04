import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { useUserRole } from "@/hooks/useUserRole";
import type { CrmPermission } from "@/lib/auth/crmAccess";

interface CRMAccessGateProps {
  children: React.ReactNode;
  requiredPermission: CrmPermission;
  redirectTo?: string;
}

export const CRMAccessGate = ({
  children,
  requiredPermission,
  redirectTo = "/dashboard",
}: CRMAccessGateProps) => {
  const location = useLocation();
  const { role, hasPermission, isLoading, isError } = useUserRole();

  if (isLoading) {
    return (
      <div
        className="flex min-h-[240px] items-center justify-center"
        role="status"
        aria-label="Checking workspace access"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isAllowed =
    !isError &&
    role !== null &&
    hasPermission(requiredPermission);

  if (!isAllowed) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ accessDeniedFrom: location.pathname }}
      />
    );
  }

  return <>{children}</>;
};
