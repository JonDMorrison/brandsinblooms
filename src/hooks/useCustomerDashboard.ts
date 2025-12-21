import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerCrossChannelMetrics } from '@/hooks/useCrossChannelMetrics';
import { useCustomerPurchaseMetrics } from '@/hooks/usePurchaseMetrics';
import { useCustomerPostPurchaseMetrics } from '@/hooks/usePostPurchaseMetrics';
import { useCustomerLoyaltyMetrics } from '@/hooks/useLoyaltyMetrics';
import { useCustomerLifecycleMetrics } from '@/hooks/useLifecycleMetrics';
import { useCustomerContentIntentMetrics } from '@/hooks/useContentIntentMetrics';
import { useCustomerRiskSignals, useCustomerNegativeEvents } from '@/hooks/useRiskSignals';
import { useCustomerUnifiedTimeline, TimelineEvent } from '@/hooks/useCustomerUnifiedTimeline';
import type { Customer360Enriched } from '@/types/customerMetrics';

// Extended type to handle both enriched view and basic customer data
export interface CustomerData {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  
  // Optional enriched fields
  first_seen_at?: string;
  last_seen_at?: string;
  signup_source?: string | null;
  signup_campaign?: string | null;
  preferred_channel?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  timezone?: string | null;
  store_id?: string | null;
  store_name?: string | null;
  
  // Email metrics
  email_total_sent?: number;
  email_total_delivered?: number;
  email_total_opened?: number;
  email_total_clicked?: number;
  email_total_bounced?: number;
  email_total_unsubscribes?: number;
  email_open_rate?: number;
  email_click_rate?: number;
  email_bounce_rate?: number;
  email_last_sent_at?: string | null;
  email_last_opened_at?: string | null;
  email_last_clicked_at?: string | null;
  
  // SMS metrics
  sms_total_sent?: number;
  sms_total_delivered?: number;
  sms_total_clicked?: number;
  sms_total_failed?: number;
  sms_total_replied?: number;
  sms_total_opt_outs?: number;
  sms_delivery_rate?: number;
  sms_click_rate?: number;
  sms_reply_rate?: number;
  sms_opt_out_rate?: number;
  sms_avg_response_time_minutes?: number;
  sms_engagement_score?: number;
  sms_last_sent_at?: string | null;
  sms_last_delivered_at?: string | null;
  sms_last_clicked_at?: string | null;
  sms_last_replied_at?: string | null;
  sms_last_opt_out_at?: string | null;
  
  // Engagement summary
  engagement_overall_score?: number;
  engagement_email_score?: number;
  engagement_sms_score?: number;
  engagement_purchase_score?: number;
  engagement_tier?: string | null;
  engagement_last_calculated_at?: string | null;
}

/**
 * Hook to fetch a single customer by ID with full 360 data
 */
export const useCustomer360 = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ['customer-360', customerId],
    queryFn: async () => {
      if (!customerId) return null;

      // Try the enriched view first
      const { data: enriched, error: enrichedError } = await supabase
        .from('customer_360_enriched')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();

      if (!enrichedError && enriched) {
        return enriched as unknown as CustomerData;
      }

      // Fallback to basic customer data
      const { data: customer, error: customerError } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
        throw customerError;
      }

      return customer as unknown as CustomerData | null;
    },
    enabled: !!customerId,
  });
};

export interface CustomerDashboardData {
  // Core customer data
  customer: CustomerData | null;

  // Metrics from various hooks
  crossChannelMetrics: ReturnType<typeof useCustomerCrossChannelMetrics>['data'];
  purchaseMetrics: ReturnType<typeof useCustomerPurchaseMetrics>['data'];
  postPurchaseMetrics: ReturnType<typeof useCustomerPostPurchaseMetrics>['data'];
  loyaltyMetrics: ReturnType<typeof useCustomerLoyaltyMetrics>['data'];
  lifecycleMetrics: ReturnType<typeof useCustomerLifecycleMetrics>['data'];
  contentIntentMetrics: ReturnType<typeof useCustomerContentIntentMetrics>['data'];
  riskSignals: ReturnType<typeof useCustomerRiskSignals>['data'];
  negativeEvents: ReturnType<typeof useCustomerNegativeEvents>['data'];
  timelineEvents: TimelineEvent[];

  // Loading states
  isLoading: boolean;
  isCustomerLoading: boolean;
  isMetricsLoading: boolean;

  // Error states
  hasError: boolean;
  errors: Error[];

  // Refresh function
  refetch: () => void;
}

/**
 * Main orchestration hook for Customer Dashboard
 * Fetches all customer data in parallel and provides a unified interface
 */
export const useCustomerDashboard = (customerId: string | undefined): CustomerDashboardData => {
  // Core customer data
  const customer360Query = useCustomer360(customerId);

  // Channel metrics
  const crossChannelQuery = useCustomerCrossChannelMetrics(customerId);

  // Purchase behavior
  const purchaseQuery = useCustomerPurchaseMetrics(customerId);
  const postPurchaseQuery = useCustomerPostPurchaseMetrics(customerId);

  // Loyalty
  const loyaltyQuery = useCustomerLoyaltyMetrics(customerId);

  // Lifecycle
  const lifecycleQuery = useCustomerLifecycleMetrics(customerId);

  // Content & Intent
  const contentIntentQuery = useCustomerContentIntentMetrics(customerId);

  // Risk signals
  const riskQuery = useCustomerRiskSignals(customerId);
  const negativeEventsQuery = useCustomerNegativeEvents(customerId);

  // Unified timeline
  const timelineQuery = useCustomerUnifiedTimeline(customerId, { limit: 50 });

  // Aggregate loading states
  const isCustomerLoading = customer360Query.isLoading;
  const isMetricsLoading =
    crossChannelQuery.isLoading ||
    purchaseQuery.isLoading ||
    postPurchaseQuery.isLoading ||
    loyaltyQuery.isLoading ||
    lifecycleQuery.isLoading ||
    contentIntentQuery.isLoading ||
    riskQuery.isLoading ||
    negativeEventsQuery.isLoading ||
    timelineQuery.isLoading;

  const isLoading = isCustomerLoading || isMetricsLoading;

  // Aggregate errors
  const errors: Error[] = [
    customer360Query.error,
    crossChannelQuery.error,
    purchaseQuery.error,
    postPurchaseQuery.error,
    loyaltyQuery.error,
    lifecycleQuery.error,
    contentIntentQuery.error,
    riskQuery.error,
    negativeEventsQuery.error,
    timelineQuery.error,
  ].filter((e): e is Error => e !== null);

  const hasError = errors.length > 0;

  // Refetch all data
  const refetch = () => {
    customer360Query.refetch();
    crossChannelQuery.refetch();
    purchaseQuery.refetch();
    postPurchaseQuery.refetch();
    loyaltyQuery.refetch();
    lifecycleQuery.refetch();
    contentIntentQuery.refetch();
    riskQuery.refetch();
    negativeEventsQuery.refetch();
    timelineQuery.refetch();
  };

  return {
    customer: customer360Query.data ?? null,
    crossChannelMetrics: crossChannelQuery.data,
    purchaseMetrics: purchaseQuery.data,
    postPurchaseMetrics: postPurchaseQuery.data,
    loyaltyMetrics: loyaltyQuery.data,
    lifecycleMetrics: lifecycleQuery.data,
    contentIntentMetrics: contentIntentQuery.data,
    riskSignals: riskQuery.data,
    negativeEvents: negativeEventsQuery.data ?? [],
    timelineEvents: timelineQuery.data ?? [],
    isLoading,
    isCustomerLoading,
    isMetricsLoading,
    hasError,
    errors,
    refetch,
  };
};
