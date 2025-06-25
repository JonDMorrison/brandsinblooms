
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
        console.log('useTenant: Fetching tenant for user:', user.id);
        
        // First check if user has a company profile with tenant info
        const { data: profileData, error: profileError } = await supabase
          .from('company_profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('useTenant: Error fetching profile:', profileError);
          setLoading(false);
          return;
        }

        if (!profileData?.tenant_id) {
          console.log('useTenant: User not assigned to a tenant yet');
          setLoading(false);
          return;
        }

        // Then fetch the tenant details
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profileData.tenant_id)
          .single();

        if (tenantError) {
          console.error('useTenant: Error fetching tenant:', tenantError);
          setTenant(null);
        } else {
          console.log('useTenant: Successfully fetched tenant:', tenantData.name);
          setTenant(tenantData);
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
