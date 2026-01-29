import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLogger';

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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ customerId, data }: { customerId: string; data: UpdateCustomerData }) => {
      const { data: result, error } = await supabase
        .from('crm_customers')
        .update(data)
        .eq('id', customerId)
        .select('*, tenant_id')
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async (result, variables) => {
      await logActivity({
        tenantId: result.tenant_id,
        customerId: result.id,
        actorType: 'user',
        actorId: user?.id ?? null,
        source: 'ui',
        activityType: 'customer.updated',
        status: 'success',
        title: 'Customer updated',
        description: {
          parts: [
            {
              type: 'text',
              text: `${result.first_name ?? ''} ${result.last_name ?? ''}`.trim() || result.email || 'Customer',
            },
          ],
        },
        metadata: {
          updated_fields: Object.keys(variables.data || {}),
          customer_name:
            `${result.first_name ?? ''} ${result.last_name ?? ''}`.trim() ||
            result.email ||
            'Customer',
          customer_first_name: result.first_name ?? null,
          customer_last_name: result.last_name ?? null,
        },
        relatedEntities: {
          customer_id: result.id,
        },
      });

      // Invalidate customer queries
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['customer-360', variables.customerId] });

      // Trigger real-time segment evaluation for this customer
      try {
        const { data: evalResult, error: evalError } = await supabase.functions.invoke('evaluate-customer-segments', {
          body: {
            customer_id: variables.customerId,
            tenant_id: result.tenant_id
          }
        });

        if (evalError) {
          console.error('[useUpdateCustomer] Segment evaluation error:', evalError);
        } else if (evalResult) {
          console.log('[useUpdateCustomer] Segment evaluation result:', evalResult);

          // Invalidate segment queries to refresh UI
          queryClient.invalidateQueries({ queryKey: ['segments'] });
          queryClient.invalidateQueries({ queryKey: ['crm_segments'] });
          queryClient.invalidateQueries({ queryKey: ['crm-segments'] });
          queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
          queryClient.invalidateQueries({ queryKey: ['dynamic-segments'] });

          // Show enhanced toast with segment changes
          const joinedCount = evalResult.segments_joined?.length || 0;
          const leftCount = evalResult.segments_left?.length || 0;

          let description = "Customer details have been saved successfully.";
          if (joinedCount > 0 && leftCount > 0) {
            description = `Added to ${joinedCount} segment(s), removed from ${leftCount} segment(s).`;
          } else if (joinedCount > 0) {
            description = `Added to ${joinedCount} segment(s): ${evalResult.segments_joined.join(', ')}`;
          } else if (leftCount > 0) {
            description = `Removed from ${leftCount} segment(s): ${evalResult.segments_left.join(', ')}`;
          }

          toast({
            title: "Customer updated",
            description,
          });
          return;
        }
      } catch (err) {
        console.error('[useUpdateCustomer] Failed to evaluate segments:', err);
      }

      // Default toast if segment evaluation didn't provide feedback
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
