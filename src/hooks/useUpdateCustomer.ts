import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UpdateCustomerData {
  first_name?: string | null;
  last_name?: string | null;
  email?: string;
  phone?: string | null;
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
}

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ customerId, data }: { customerId: string; data: UpdateCustomerData }) => {
      const { error } = await supabase
        .from('crm_customers')
        .update(data)
        .eq('id', customerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-dashboard'] });
      toast({
        title: "Customer updated",
        description: "Customer details have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
