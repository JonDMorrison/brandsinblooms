import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useIsSuperAdmin = () => {
  return useQuery({
    queryKey: ['is-super-admin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return false;

      const { data } = await supabase
        .from('app_admin_emails')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      return !!data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
