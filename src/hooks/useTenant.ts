
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Tenant {
  id: string;
  name: string;
  slug?: string;
  settings: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useTenant = () => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchTenant = async () => {
      if (!user) {
        setTenant(null);
        setLoading(false);
        return;
      }

      try {
        // First get the user's tenant_id
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
.maybeSingle();

        if (userError) throw userError;

        if (userData?.tenant_id) {
          // Fetch the tenant details
          const { data: tenantData, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', userData.tenant_id)
            .maybeSingle();

          if (tenantError) throw tenantError;
          setTenant(tenantData);
        } else {
          setTenant(null);
        }
      } catch (error) {
        console.error('Error fetching tenant:', error);
        setTenant(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [user]);

  return {
    tenant,
    loading
  };
};
