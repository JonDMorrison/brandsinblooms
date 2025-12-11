import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeliverabilityWarning {
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  value?: number;
  trend?: number[];
}

export interface DeliverabilityStatus {
  domain_id: string;
  domain_name: string;
  tenant_id: string;
  status: 'healthy' | 'warning' | 'critical';
  verification_status: string;
  warmup_stage: number;
  daily_limit: number;
  metrics: {
    sent_30d: number;
    delivered_30d: number;
    opened_30d: number;
    clicked_30d: number;
    bounced_30d: number;
    complained_30d: number;
    campaign_count_30d: number;
  };
  rates: {
    bounce_rate: number;
    complaint_rate: number;
    open_rate: number;
    click_rate: number;
  };
  trend: {
    declining: boolean;
    recent_open_rates: (number | null)[];
  };
  warnings: DeliverabilityWarning[];
  recommendation: string;
}

export const useDeliverabilityStatus = (domainId: string | undefined) => {
  return useQuery({
    queryKey: ['deliverability-status', domainId],
    queryFn: async (): Promise<DeliverabilityStatus> => {
      if (!domainId) throw new Error('Domain ID required');

      const { data, error } = await supabase.functions.invoke('get-deliverability-status', {
        body: { domain_id: domainId },
      });

      if (error) {
        console.error('Error fetching deliverability status:', error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as DeliverabilityStatus;
    },
    enabled: !!domainId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
