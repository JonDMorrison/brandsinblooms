import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TimelineEvent {
  id: string;
  event_type: string;
  event_category: string;
  title: string;
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UseTimelineOptions {
  limit?: number;
  offset?: number;
  eventTypes?: string[];
}

/**
 * Hook to fetch unified timeline events for a customer
 * Aggregates events from multiple tables: purchases, SMS, emails, loyalty, lifecycle, etc.
 */
export const useCustomerUnifiedTimeline = (
  customerId: string | undefined,
  options?: UseTimelineOptions
) => {
  const { limit = 50, offset = 0, eventTypes = null } = options || {};

  return useQuery({
    queryKey: ['customer-unified-timeline', customerId, limit, offset, eventTypes],
    queryFn: async () => {
      if (!customerId) return [];

      try {
        const { data, error } = await supabase.rpc('get_customer_unified_timeline', {
          p_customer_id: customerId,
          p_limit: limit,
          p_offset: offset,
          p_event_types: eventTypes,
        });

        if (error) {
          console.error('Error fetching unified timeline:', error);
          // Return empty array instead of throwing to prevent page crash
          return [];
        }

        return (data || []) as TimelineEvent[];
      } catch (err) {
        console.error('Unexpected error in timeline fetch:', err);
        return [];
      }
    },
    enabled: !!customerId,
  });
};

/**
 * Get event category color based on category type
 */
export const getEventCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    purchase: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    sms: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    email: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
    loyalty: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    perks: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
    lifecycle: 'bg-gray-100 text-gray-700 dark:bg-gray-950/50 dark:text-gray-300',
    risk: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    incentive: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  };
  return colors[category] || colors.lifecycle;
};

/**
 * Get impact indicator styling
 */
export const getImpactStyle = (impact: string): { color: string; icon: string } => {
  switch (impact) {
    case 'positive':
      return { color: 'text-emerald-500', icon: '↑' };
    case 'negative':
      return { color: 'text-red-500', icon: '↓' };
    default:
      return { color: 'text-gray-400', icon: '→' };
  }
};
