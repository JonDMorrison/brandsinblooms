import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface AdminContextType {
  isMasterAdmin: boolean;
  isLoading: boolean;
  activeTenantId: string | null;
  setActiveTenantId: (tenantId: string | null) => void;
  availableTenants: any[];
  refreshTenants: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [availableTenants, setAvailableTenants] = useState<any[]>([]);

  // Check if user is master admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setIsMasterAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_master_admin', { _user_id: user.id });
        
        if (error) {
          console.error('Error checking admin status:', error);
          setIsMasterAdmin(false);
        } else {
          setIsMasterAdmin(data || false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsMasterAdmin(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAdminStatus();
  }, [user]);

  // Load available tenants for master admins
  useEffect(() => {
    async function loadTenants() {
      if (!isMasterAdmin) {
        setAvailableTenants([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name, company_name, created_at')
          .order('company_name');

        if (error) throw error;
        setAvailableTenants(data || []);
      } catch (error) {
        console.error('Error loading tenants:', error);
      }
    }

    loadTenants();
  }, [isMasterAdmin]);

  // Save/restore active tenant context
  useEffect(() => {
    async function saveContext() {
      if (!user || !isMasterAdmin) return;

      try {
        if (activeTenantId) {
          await supabase
            .from('admin_session_context')
            .upsert({
              admin_user_id: user.id,
              active_tenant_id: activeTenantId,
              updated_at: new Date().toISOString()
            });
        }
      } catch (error) {
        console.error('Error saving admin context:', error);
      }
    }

    saveContext();
  }, [activeTenantId, user, isMasterAdmin]);

  const refreshTenants = async () => {
    if (!isMasterAdmin) return;

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, company_name, created_at')
        .order('company_name');

      if (error) throw error;
      setAvailableTenants(data || []);
    } catch (error) {
      console.error('Error refreshing tenants:', error);
    }
  };

  return (
    <AdminContext.Provider
      value={{
        isMasterAdmin,
        isLoading,
        activeTenantId,
        setActiveTenantId,
        availableTenants,
        refreshTenants
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};