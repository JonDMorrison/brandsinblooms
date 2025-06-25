
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Tenant {
  id: string;
  name: string;
  slug: string | null;
  settings: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useTenant = () => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!user) {
        console.log('useTenant: No user, setting loading to false');
        setLoading(false);
        return;
      }

      try {
        console.log('useTenant: Checking for real tenant for user:', user.id);
        
        // First check if user is assigned to a real tenant
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .maybeSingle();

        if (userError) {
          console.error('useTenant: Error fetching user tenant:', userError);
        }

        if (userData?.tenant_id) {
          // User has a real tenant, fetch it
          const { data: tenantData, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', userData.tenant_id)
            .single();

          if (tenantError) {
            console.error('useTenant: Error fetching tenant:', tenantError);
            setTenant(null);
          } else {
            console.log('useTenant: Found real tenant:', tenantData.name);
            setTenant(tenantData);
          }
        } else {
          // No real tenant found - operate in single-user mode
          console.log('useTenant: No real tenant found, operating in single-user mode');
          setTenant(null);
        }
      } catch (error) {
        console.error('useTenant: Error in fetchTenant:', error);
        setTenant(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [user]);

  return { tenant, loading };
};
