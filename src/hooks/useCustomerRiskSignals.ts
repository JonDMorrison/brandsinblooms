import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RiskCalculationResult } from '@/types/segmentation';

/**
 * Hook to trigger risk signal calculation
 */
export function useCalculateRiskSignals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      customerId 
    }: { 
      tenantId?: string; 
      customerId?: string 
    }): Promise<RiskCalculationResult> => {
      console.log('[useCalculateRiskSignals] Triggering calculation', { tenantId, customerId });

      const { data, error } = await supabase.functions.invoke('calculate-risk-signals', {
        body: { 
          tenant_id: tenantId, 
          customer_id: customerId 
        }
      });

      if (error) {
        console.error('[useCalculateRiskSignals] Error:', error);
        throw error;
      }

      return data as RiskCalculationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
}

/**
 * Get risk level label and color based on score
 */
export function getRiskLevelConfig(riskScore: number): {
  level: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  color: string;
  bgColor: string;
} {
  if (riskScore >= 80) {
    return { level: 'critical', label: 'Critical Risk', color: 'text-red-700', bgColor: 'bg-red-100' };
  }
  if (riskScore >= 60) {
    return { level: 'high', label: 'High Risk', color: 'text-orange-700', bgColor: 'bg-orange-100' };
  }
  if (riskScore >= 40) {
    return { level: 'medium', label: 'Medium Risk', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  }
  return { level: 'low', label: 'Low Risk', color: 'text-green-700', bgColor: 'bg-green-100' };
}

      return data as RiskCalculationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-risk-signals'] });
      queryClient.invalidateQueries({ queryKey: ['at-risk-customers-signals'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-risk-stats'] });
    }
  });
}

/**
 * Get risk level label and color based on score
 */
export function getRiskLevelConfig(riskScore: number): {
  level: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  color: string;
  bgColor: string;
} {
  if (riskScore >= 80) {
    return {
      level: 'critical',
      label: 'Critical Risk',
      color: 'text-red-700',
      bgColor: 'bg-red-100'
    };
  }
  if (riskScore >= 60) {
    return {
      level: 'high',
      label: 'High Risk',
      color: 'text-orange-700',
      bgColor: 'bg-orange-100'
    };
  }
  if (riskScore >= 40) {
    return {
      level: 'medium',
      label: 'Medium Risk',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100'
    };
  }
  return {
    level: 'low',
    label: 'Low Risk',
    color: 'text-green-700',
    bgColor: 'bg-green-100'
  };
}

/**
 * Get human-readable risk factor label
 */
export function getRiskFactorLabel(factor: string): string {
  const labels: Record<string, string> = {
    rapid_email_optout: 'Rapid Email Opt-out',
    rapid_sms_optout: 'Rapid SMS Opt-out',
    high_ignore_streak: 'Ignoring Messages',
    hard_bounce_history: 'Email Bounce Issues',
    recurring_soft_bounces: 'Delivery Problems',
    long_term_inactive: 'Long-term Inactive',
    recently_inactive: 'Recently Inactive',
    very_low_engagement: 'Very Low Engagement',
    low_engagement: 'Low Engagement'
  };
  return labels[factor] || factor.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}