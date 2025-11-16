import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useIsSuperAdmin = () => {
  return useQuery({
    queryKey: ['is-super-admin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('🔍 Admin Check - User email:', user?.email);
      
      if (!user?.email) {
        console.log('❌ Admin Check - No user email found');
        return false;
      }

      const { data, error } = await supabase
        .from('app_admin_emails')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      console.log('🔍 Admin Check - Database result:', { found: !!data, error: error?.message });

      if (error) {
        console.error('❌ Admin Check - Database error:', error);
        return false;
      }

      const isAdmin = !!data;
      console.log('✅ Admin Check - Final result:', isAdmin);
      return isAdmin;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry failed admin checks
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
};
