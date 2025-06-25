
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
        console.log('useTenant: Checking company profile for user:', user.id);
        
        // Check if user has a company profile (simplified tenant check)
        const { data: profileData, error: profileError } = await supabase
          .from('company_profiles')
          .select('id, company_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('useTenant: Error fetching profile:', profileError);
          setLoading(false);
          return;
        }

        if (!profileData) {
          console.log('useTenant: User has no company profile yet');
          setTenant(null);
        } else {
          // For now, create a virtual tenant from the user's profile
          // This maintains compatibility while we don't have a true multi-tenant setup
          console.log('useTenant: User has company profile, creating virtual tenant');
          setTenant({
            id: user.id, // Use user ID as tenant ID for single-tenant mode
            name: profileData.company_name || 'My Company',
            slug: null,
            settings: {},
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
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
