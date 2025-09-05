import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  persona?: string; // Legacy field - will be phased out
  persona_id?: string; // New unified persona reference
  tags?: string[];
  total_spent?: number;
  last_purchase_date?: string;
  sms_opt_in?: boolean;
  created_at: string;
  updated_at: string;
}

interface UseCustomersOptions {
  search?: string;
}

export const useCustomers = (options: UseCustomersOptions = {}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['customers', options.search],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userRecord?.tenant_id) throw new Error('You are not assigned to a tenant. Please contact support or create an organization to continue.');

      let query = supabase
        .from('crm_customers')
        .select('*')
        .eq('tenant_id', userRecord.tenant_id)
        .order('created_at', { ascending: false });

      if (options.search) {
        query = query.or(`email.ilike.%${options.search}%,first_name.ilike.%${options.search}%,last_name.ilike.%${options.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Customer[];
    },
  });

  const invalidateCustomers = () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  return {
    ...query,
    invalidateCustomers,
  };
};