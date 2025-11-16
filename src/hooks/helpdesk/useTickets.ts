import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupportTicket } from '@/types/helpdesk';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';

interface UseTicketsOptions {
  status?: string[];
  priority?: string[];
  categoryId?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const useTickets = (options: UseTicketsOptions = {}) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { page = 1, pageSize = 20 } = options;

  return useQuery({
    queryKey: ['support-tickets', options, user?.id, tenant?.id, isSuperAdmin],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Build query
      let query = supabase
        .from('support_tickets')
        .select('*, category:support_categories(name, color, icon)', { count: 'exact' });

      // Super admins see ALL tickets across ALL tenants
      // Regular users see only their own tickets in their tenant
      if (!isSuperAdmin) {
        // Regular user: only their tickets in their tenant
        if (!tenant?.id) throw new Error('No tenant found');
        query = query
          .eq('tenant_id', tenant.id)
          .eq('user_id', user.id);
      }
      // Super admins get no tenant filter - see everything across all tenants

      // Apply filters
      if (options.status?.length) {
        query = query.in('status', options.status as any);
      }
      if (options.priority?.length) {
        query = query.in('priority', options.priority as any);
      }
      if (options.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }
      if (options.assignedTo) {
        query = query.eq('assigned_to', options.assignedTo);
      }
      if (options.search) {
        query = query.or(`subject.ilike.%${options.search}%,ticket_number.ilike.%${options.search}%`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        tickets: data as SupportTicket[],
        totalCount: count || 0,
      };
    },
    enabled: !!user,
  });
};
