
import { useState, useEffect, useRef } from 'react';
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

// Cache to prevent redundant API calls
const tenantCache = new Map<string, { tenant: Tenant | null; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useTenant = () => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Prevent multiple fetches for the same user
      if (fetchedRef.current) {
        return;
      }

      // Check cache first
      const cached = tenantCache.get(user.id);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setTenant(cached.tenant);
        setLoading(false);
        fetchedRef.current = true;
        return;
      }

      try {
        
        // First check if user is assigned to a real tenant
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .maybeSingle();

        if (userError) {
          console.error('useTenant: Error fetching user tenant:', userError);
        }

        let finalTenant: Tenant | null = null;

        if (userData?.tenant_id) {
          // User has a real tenant, fetch it
          const { data: tenantData, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', userData.tenant_id)
            .single();

          if (tenantError) {
            console.error('useTenant: Error fetching tenant:', tenantError);
          } else {
            finalTenant = tenantData;
          }
        }

        // Cache the result
        tenantCache.set(user.id, { 
          tenant: finalTenant, 
          timestamp: Date.now() 
        });
        
        setTenant(finalTenant);
      } catch (error) {
        console.error('useTenant: Error in fetchTenant:', error);
        setTenant(null);
      } finally {
        setLoading(false);
        fetchedRef.current = true;
      }
    };

    // Reset fetch flag when user changes
    fetchedRef.current = false;
    fetchTenant();
  }, [user?.id]); // Only depend on user.id to prevent unnecessary re-fetches

  return { tenant, loading };
};
