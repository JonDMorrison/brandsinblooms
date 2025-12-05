import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UsageStats {
  tier: string;
  isFoundingCustomer: boolean;
  email: {
    used: number;
    limit: number;
    remaining: number;
    percent: number;
    unlimited: boolean;
    overageThisMonth: number;
    overageRate: number;
  };
  sms: {
    used: number;
    limit: number;
    remaining: number;
    percent: number;
    unlimited: boolean;
    overageThisMonth: number;
    overageRate: number;
  };
  billingInterval: string;
  endDate: string;
  plan: string;
}

export interface UsageThresholds {
  emailAt80: boolean;
  emailAt100: boolean;
  smsAt80: boolean;
  smsAt100: boolean;
  anyAt80: boolean;
  anyAt100: boolean;
}

export interface UpgradeRecommendation {
  shouldUpgrade: boolean;
  reason: string;
  suggestedTier: string | null;
  savings: string | null;
}

const TIER_ORDER = ['seed', 'sprout', 'bloom', 'thrive'];

export const useUsageTracking = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_usage_stats', {
        p_user_id: user.id
      });

      if (rpcError) throw rpcError;

      if (data && typeof data === 'object') {
        const statsData = data as Record<string, unknown>;
        const emailData = statsData.email as Record<string, unknown> || {};
        const smsData = statsData.sms as Record<string, unknown> || {};
        
        setUsage({
          tier: String(statsData.tier || 'legacy'),
          isFoundingCustomer: Boolean(statsData.is_founding_customer),
          email: {
            used: Number(emailData.used || 0),
            limit: Number(emailData.limit || 10000),
            remaining: Number(emailData.remaining || 0),
            percent: Number(emailData.percent || 0),
            unlimited: Boolean(emailData.unlimited),
            overageThisMonth: Number(emailData.overage_this_month || 0),
            overageRate: Number(emailData.overage_rate || 0.002),
          },
          sms: {
            used: Number(smsData.used || 0),
            limit: Number(smsData.limit || 1000),
            remaining: Number(smsData.remaining || 0),
            percent: Number(smsData.percent || 0),
            unlimited: Boolean(smsData.unlimited),
            overageThisMonth: Number(smsData.overage_this_month || 0),
            overageRate: Number(smsData.overage_rate || 0.03),
          },
          billingInterval: String(statsData.billing_interval || 'monthly'),
          endDate: String(statsData.end_date || ''),
          plan: String(statsData.plan || 'free_trial'),
        });
      }
    } catch (err) {
      console.error('Error fetching usage stats:', err);
      setError('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const getThresholds = useCallback((): UsageThresholds => {
    if (!usage) {
      return {
        emailAt80: false,
        emailAt100: false,
        smsAt80: false,
        smsAt100: false,
        anyAt80: false,
        anyAt100: false,
      };
    }

    const emailAt80 = !usage.email.unlimited && usage.email.percent >= 80;
    const emailAt100 = !usage.email.unlimited && usage.email.percent >= 100;
    const smsAt80 = !usage.sms.unlimited && usage.sms.percent >= 80;
    const smsAt100 = !usage.sms.unlimited && usage.sms.percent >= 100;

    return {
      emailAt80,
      emailAt100,
      smsAt80,
      smsAt100,
      anyAt80: emailAt80 || smsAt80,
      anyAt100: emailAt100 || smsAt100,
    };
  }, [usage]);

  const getUpgradeRecommendation = useCallback((): UpgradeRecommendation => {
    if (!usage) {
      return { shouldUpgrade: false, reason: '', suggestedTier: null, savings: null };
    }

    const currentTierIndex = TIER_ORDER.indexOf(usage.tier);
    const thresholds = getThresholds();

    // Already at highest tier
    if (currentTierIndex === TIER_ORDER.length - 1) {
      return { shouldUpgrade: false, reason: 'You\'re on our highest tier!', suggestedTier: null, savings: null };
    }

    // At or near limit
    if (thresholds.anyAt100) {
      const nextTier = TIER_ORDER[currentTierIndex + 1];
      return {
        shouldUpgrade: true,
        reason: 'You\'ve reached your limit. Upgrade to continue sending.',
        suggestedTier: nextTier,
        savings: null,
      };
    }

    if (thresholds.anyAt80) {
      const nextTier = TIER_ORDER[currentTierIndex + 1];
      return {
        shouldUpgrade: true,
        reason: 'You\'re approaching your limit. Upgrade now to avoid interruption.',
        suggestedTier: nextTier,
        savings: null,
      };
    }

    return { shouldUpgrade: false, reason: '', suggestedTier: null, savings: null };
  }, [usage, getThresholds]);

  const checkCanSend = useCallback((type: 'email' | 'sms', count: number): { 
    canSend: boolean; 
    remaining: number;
    overageNeeded: number;
  } => {
    if (!usage) {
      return { canSend: false, remaining: 0, overageNeeded: count };
    }

    const stats = type === 'email' ? usage.email : usage.sms;
    
    if (stats.unlimited) {
      return { canSend: true, remaining: Infinity, overageNeeded: 0 };
    }

    const canSend = stats.remaining >= count;
    const overageNeeded = canSend ? 0 : count - stats.remaining;

    return { canSend, remaining: stats.remaining, overageNeeded };
  }, [usage]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return {
    usage,
    loading,
    error,
    refetch: fetchUsage,
    getThresholds,
    getUpgradeRecommendation,
    checkCanSend,
    formatNumber,
  };
};
