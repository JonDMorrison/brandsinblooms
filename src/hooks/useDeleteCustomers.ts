import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeleteCustomersParams {
  keepEmail: string;
  tenantId: string;
}

export const useDeleteCustomers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ keepEmail, tenantId }: DeleteCustomersParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('admin-delete-customers', {
        body: { keepEmail, tenantId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      toast({
        title: "Customers Deleted",
        description: `${data.deletedCount} customers deleted successfully. Kept ${data.message.split('kept ')[1]}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
