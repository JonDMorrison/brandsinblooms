import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export const useHasSupportRole = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['has-support-role', user?.id, tenant?.id],
    queryFn: async () => {
      if (!user || !tenant?.id) return false;

      // Use type assertion for new table until types regenerate
      const { data } = await (supabase as any)
        .from('user_support_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      return !!data;
    },
    enabled: !!user && !!tenant?.id,
  });
};
