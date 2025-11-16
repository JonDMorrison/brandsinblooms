import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TicketStatus } from '@/types/helpdesk';

interface UpdateTicketStatusData {
  ticketId: string;
  status: TicketStatus;
}

export const useUpdateTicketStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateTicketStatusData) => {
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .update({ status: data.status })
        .eq('id', data.ticketId)
        .select()
        .single();

      if (error) throw error;
      return ticket;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast({
        title: 'Status Updated',
        description: 'Ticket status has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update ticket status',
        variant: 'destructive',
      });
    },
  });
};
