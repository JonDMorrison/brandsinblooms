import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useIsSuperAdmin = () => {
  return useQuery({
    queryKey: ['is-super-admin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 useIsSuperAdmin - User:', user?.email);
      
      if (!user?.email) {
        console.log('❌ useIsSuperAdmin - No user email');
        return false;
      }

      const { data, error } = await supabase
        .from('app_admin_emails')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      console.log('🔍 useIsSuperAdmin - Query result:', { data, error, isSuperAdmin: !!data });
      
      if (error) {
        console.error('❌ useIsSuperAdmin - Error:', error);
      }

      return !!data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
