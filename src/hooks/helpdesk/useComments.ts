import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupportComment } from '@/types/helpdesk';
import { useAuth } from '@/contexts/AuthContext';

export const useComments = (ticketId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['support-comments', ticketId],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('support_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as SupportComment[];
    },
    enabled: !!user && !!ticketId,
  });
};
