import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { getUserAssignedTenantId } from "@/utils/getUserAssignedTenantId";

interface Tenant {
  id: string;
  name: string;
  slug?: string;
  settings: any;
  is_active: boolean;
  default_from_email_domain_id?: string | null;
  email_under_review?: boolean;
  email_under_review_at?: string | null;
  email_under_review_reason?: string | null;
  email_under_review_details?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export const useTenant = () => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { isMasterAdmin, activeTenantId, hasHydratedTenantContext } =
    useAdmin();

  const fetchTenant = useCallback(async () => {
    if (!user) {
      setTenant(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (isMasterAdmin && !hasHydratedTenantContext) {
      setLoading(true);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      let effectiveTenantId: string | null = null;

      if (isMasterAdmin) {
        effectiveTenantId = activeTenantId;
      }

      if (!effectiveTenantId) {
        effectiveTenantId = await getUserAssignedTenantId(user.id);
      }

      if (effectiveTenantId) {
        // Fetch the tenant details
        const { data: tenantData, error: tenantError } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", effectiveTenantId)
          .maybeSingle();

        if (tenantError) throw tenantError;
        setTenant(tenantData as unknown as Tenant);
      } else {
        setTenant(null);
        setError(
          isMasterAdmin
            ? "Select a tenant in Master Admin mode or assign a tenant to your user account to continue."
            : "You are not assigned to a tenant. Please contact support or create an organization to continue.",
        );
      }
    } catch (error) {
      console.error("Error fetching tenant:", error);
      setTenant(null);
      setError("Unable to load organization information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, hasHydratedTenantContext, isMasterAdmin, user]);

  useEffect(() => {
    void fetchTenant();
  }, [fetchTenant]);

  return {
    tenant,
    loading,
    error,
    requiresTenantSelection:
      isMasterAdmin &&
      hasHydratedTenantContext &&
      !activeTenantId &&
      !tenant?.id,
    refetch: fetchTenant,
  };
};
