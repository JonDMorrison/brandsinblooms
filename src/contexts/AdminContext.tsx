import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface AdminContextType {
  isMasterAdmin: boolean;
  isLoading: boolean;
  activeTenantId: string | null;
  hasHydratedTenantContext: boolean;
  setActiveTenantId: (tenantId: string | null) => Promise<void>;
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
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [hasHydratedTenantContext, setHasHydratedTenantContext] =
    useState(false);
  const [hydratedAdminUserId, setHydratedAdminUserId] = useState<string | null>(
    null,
  );
  const [availableTenants, setAvailableTenants] = useState<any[]>([]);
  const contextWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const contextWriteVersionRef = useRef(0);

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

  // Hydrate the persisted master-admin tenant context before exposing it as
  // usable. Do not mark the context hydrated while the admin-status lookup is
  // still pending: isMasterAdmin starts false, and treating that initial value
  // as authoritative creates a render where tenant-scoped access appears ready
  // before the persisted master-admin tenant has been loaded.
  useEffect(() => {
    let cancelled = false;

    async function loadActiveTenantContext() {
      if (isLoading) {
        setActiveTenantIdState(null);
        setHydratedAdminUserId(null);
        setHasHydratedTenantContext(false);
        return;
      }

      if (!user || !isMasterAdmin) {
        setActiveTenantIdState(null);
        setHydratedAdminUserId(null);
        setHasHydratedTenantContext(true);
        return;
      }

      setHasHydratedTenantContext(false);
      setHydratedAdminUserId(null);

      try {
        const { data, error } = await supabase
          .from("admin_session_context")
          .select("active_tenant_id")
          .eq("admin_user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setActiveTenantIdState(data?.active_tenant_id ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading admin context:", error);
          setActiveTenantIdState(null);
        }
      } finally {
        if (!cancelled) {
          setHydratedAdminUserId(user.id);
          setHasHydratedTenantContext(true);
        }
      }
    }

    loadActiveTenantContext();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isMasterAdmin, user]);

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

  // Persist a tenant switch on the server before exposing that tenant as the
  // active client context. The CRM access RPC derives a master admin's tenant
  // from admin_session_context, so publishing client state first could make the
  // UI request access for the new tenant while the server still points at the
  // old one. Writes are serialized so rapid switches cannot complete out of
  // order, and access remains gated until the latest switch is durable.
  const setActiveTenantId = useCallback(
    async (tenantId: string | null) => {
      if (!user || !isMasterAdmin || hydratedAdminUserId !== user.id) {
        return;
      }

      const writeVersion = ++contextWriteVersionRef.current;
      setHasHydratedTenantContext(false);

      const write = contextWriteQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const { error } = await supabase.from("admin_session_context").upsert(
            {
              admin_user_id: user.id,
              active_tenant_id: tenantId,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "admin_user_id",
            },
          );

          if (error) {
            throw error;
          }

          setActiveTenantIdState(tenantId);
        });

      contextWriteQueueRef.current = write.catch(() => undefined);

      try {
        await write;
      } catch (error) {
        console.error("Error saving admin context:", error);
      } finally {
        if (
          contextWriteVersionRef.current === writeVersion &&
          hydratedAdminUserId === user.id
        ) {
          setHasHydratedTenantContext(true);
        }
      }
    },
    [hydratedAdminUserId, isMasterAdmin, user],
  );

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
