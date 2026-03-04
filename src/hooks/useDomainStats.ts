import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DomainStats {
  domain_id: string;
  domain_name: string;
  tenant_id: string;
  verification_status: string;
  emails_sent_30d: number;
  emails_delivered_30d: number;
  emails_opened_30d: number;
  emails_clicked_30d: number;
  emails_bounced_30d: number;
  emails_complained_30d: number;
  open_rate_30d: number;
  click_rate_30d: number;
  bounce_rate_30d: number;
  complaint_rate_30d: number;
}

export const useDomainStats = (tenantId?: string) => {
  return useQuery({
    queryKey: ['domain-stats-30d', tenantId],
    queryFn: async (): Promise<DomainStats[]> => {
      const { data, error } = await supabase.rpc('get_domain_email_stats_30d', {
        p_tenant_id: tenantId || null,
      });

      if (error) {
        console.error('Error fetching domain stats:', error);
        throw error;
      }

      return (data as DomainStats[]) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
