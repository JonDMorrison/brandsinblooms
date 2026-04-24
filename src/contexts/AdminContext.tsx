import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface AdminContextType {
  isMasterAdmin: boolean;
  isLoading: boolean;
  activeTenantId: string | null;
  hasHydratedTenantContext: boolean;
  setActiveTenantId: (tenantId: string | null) => void;
  availableTenants: any[];
  refreshTenants: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [hasHydratedTenantContext, setHasHydratedTenantContext] =
    useState(false);
  const [availableTenants, setAvailableTenants] = useState<any[]>([]);

  // Check if user is master admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!user?.email) {
        setIsMasterAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("app_admin_emails")
          .select("email")
          .eq("email", user.email)
          .maybeSingle();

        if (error) {
          console.error("Error checking admin status:", error);
          setIsMasterAdmin(false);
        } else {
          setIsMasterAdmin(!!data);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsMasterAdmin(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAdminStatus();
  }, [user]);

  // Load available tenants for master admins
  useEffect(() => {
    async function loadActiveTenantContext() {
      if (!user || !isMasterAdmin) {
        setActiveTenantId(null);
        setHasHydratedTenantContext(true);
        return;
      }

      try {
        setHasHydratedTenantContext(false);

        const { data, error } = await supabase
          .from("admin_session_context")
          .select("active_tenant_id")
          .eq("admin_user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        setActiveTenantId(data?.active_tenant_id ?? null);
      } catch (error) {
        console.error("Error loading admin context:", error);
        setActiveTenantId(null);
      } finally {
        setHasHydratedTenantContext(true);
      }
    }

    loadActiveTenantContext();
  }, [isMasterAdmin, user]);

  useEffect(() => {
    async function loadTenants() {
      if (!isMasterAdmin) {
        setAvailableTenants([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("id, name, created_at")
          .order("name");

        if (error) throw error;
        setAvailableTenants(data || []);
      } catch (error) {
        console.error("Error loading tenants:", error);
      }
    }

    loadTenants();
  }, [isMasterAdmin]);

  // Save/restore active tenant context
  useEffect(() => {
    async function saveContext() {
      if (!user || !isMasterAdmin || !hasHydratedTenantContext) return;

      try {
        const { error } = await supabase.from("admin_session_context").upsert(
          {
            admin_user_id: user.id,
            active_tenant_id: activeTenantId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "admin_user_id",
          },
        );

        if (error) {
          throw error;
        }
      } catch (error) {
        console.error("Error saving admin context:", error);
      }
    }

    saveContext();
  }, [activeTenantId, hasHydratedTenantContext, user, isMasterAdmin]);

  const refreshTenants = async () => {
    if (!isMasterAdmin) return;

    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, created_at")
        .order("name");

      if (error) throw error;
      setAvailableTenants(data || []);
    } catch (error) {
      console.error("Error refreshing tenants:", error);
    }
  };

  return (
    <AdminContext.Provider
      value={{
        isMasterAdmin,
        isLoading,
        activeTenantId,
        hasHydratedTenantContext,
        setActiveTenantId,
        availableTenants,
        refreshTenants,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
};
