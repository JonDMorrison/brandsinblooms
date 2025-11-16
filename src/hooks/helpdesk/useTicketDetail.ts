import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupportTicket } from '@/types/helpdesk';
import { useAuth } from '@/contexts/AuthContext';

export const useTicketDetail = (ticketId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          category:support_categories(name, color, icon)
        `)
        .eq('id', ticketId)
        .single();

      if (error) throw error;
      return data as SupportTicket;
    },
    enabled: !!user && !!ticketId,
  });
};
