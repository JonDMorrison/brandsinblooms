import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

interface CreateTicketData {
  subject: string;
  description: string;
  priority: string;
  category_id?: string;
  attachments?: File[];
}

export const useCreateTicket = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();

  return useMutation({
    mutationFn: async (ticketData: CreateTicketData) => {
      if (!user || !tenant?.id) throw new Error('Not authenticated');

      // Generate ticket number
      const { data: ticketNumberData, error: ticketNumberError } = await supabase
        .rpc('generate_ticket_number', { p_tenant_id: tenant.id });

      if (ticketNumberError) throw ticketNumberError;

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert([{
          tenant_id: tenant.id,
          user_id: user.id,
          ticket_number: ticketNumberData,
          subject: ticketData.subject,
          description: ticketData.description,
          priority: ticketData.priority as any,
          category_id: ticketData.category_id,
          status: 'open' as any,
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Upload attachments if any
      if (ticketData.attachments?.length) {
        for (const file of ticketData.attachments) {
          const filePath = `${user.id}/${ticket.id}/${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('support-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Create attachment record
          await supabase.from('support_attachments').insert({
            ticket_id: ticket.id,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
          });
        }
      }

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast({
        title: 'Ticket Created',
        description: 'Your support ticket has been created successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Create ticket error:', error);
      
      let errorMessage = 'Failed to create ticket';
      
      // Provide more specific error messages
      if (error.message?.includes('relation "support_tickets" does not exist')) {
        errorMessage = 'Help desk system is not set up. Please contact your administrator.';
      } else if (error.message?.includes('generate_ticket_number')) {
        errorMessage = 'Ticket numbering system is not configured. Please contact support.';
      } else if (error.message?.includes('storage')) {
        errorMessage = 'File storage is not configured. Please try without attachments.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
};
