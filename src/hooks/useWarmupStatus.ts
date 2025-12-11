import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DomainWarmupStatus {
  domain_id: string;
  domain_name: string;
  status: string;
  is_entri_managed: boolean;
  
  // Warmup stage info
  warmup_stage: number;
  stage_label: string;
  stage_description: string;
  stage_reason: string;
  
  // Progress to next stage
  healthy_days: number;
  required_healthy_days: number;
  stage_progress_percent: number;
  next_stage: number | null;
  next_stage_limit: number | null;
  
  // Today's limits
  daily_limit: number;
  daily_sent: number;
  remaining_today: number;
  usage_percent: number;
  warning_level: 'none' | 'approaching' | 'critical';
  
  // Health metrics
  bounce_rate_30d: number;
  complaint_rate_30d: number;
  open_rate_30d: number;
  emails_sent_30d: number;
  
  // Timestamps
  last_stage_updated_at: string | null;
  last_daily_reset_at: string | null;
}

export interface WarmupStageInfo {
  stage: number;
  daily_limit: number;
  required_healthy_days: number;
  label: string;
  description: string;
}

export interface WarmupStatusResponse {
  success: boolean;
  has_custom_domain: boolean;
  domains: DomainWarmupStatus[];
  warmup_stages: WarmupStageInfo[];
}

export const useWarmupStatus = () => {
  return useQuery({
    queryKey: ['warmup-status'],
    queryFn: async (): Promise<WarmupStatusResponse> => {
      const { data, error } = await supabase.functions.invoke('get-warmup-status');

      if (error) {
        console.error('Error fetching warmup status:', error);
        throw error;
      }

      return data as WarmupStatusResponse;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};
