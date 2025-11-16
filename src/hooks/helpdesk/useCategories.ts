import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupportCategory } from '@/types/helpdesk';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export const useCategories = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['support-categories', tenant?.id],
    queryFn: async () => {
      if (!user || !tenant?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('support_categories')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as SupportCategory[];
    },
    enabled: !!user && !!tenant?.id,
  });
};
