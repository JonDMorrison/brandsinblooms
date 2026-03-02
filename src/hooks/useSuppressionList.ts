/**
 * Hook for managing email suppression list
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface SuppressionRecord {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  email: string;
  phone: string | null;
  suppression_type: string;
  channel: string;
  reason: string | null;
  source_event_id: string | null;
  auto_suppressed: boolean;
  suppressed_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_by: string | null;
  created_at: string;
}

export interface SuppressionStats {
  total: number;
  byType: Record<string, number>;
  autoSuppressed: number;
  manual: number;
}

const EMAIL_BLOCKING_TYPES = ['unsubscribed', 'bounced', 'complaint', 'complained', 'hard_bounce'] as const;

/**
 * Count tenant-scoped blocked emails (suppression_type = 'blocked').
 * This intentionally does NOT include global blocks.
 */
export function useBlockedEmailCount(options?: { enabled?: boolean }) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ['blocked-email-count', tenantId],
    queryFn: async (): Promise<number> => {
      if (!tenantId) return 0;

      const { count, error } = await supabase
        .from('suppression_list')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('channel', 'email')
        .is('lifted_at', null)
        .eq('suppression_type', 'blocked');

      if (error) throw error;
      return count || 0;
    },
    enabled: Boolean(tenantId) && (options?.enabled ?? true),
    staleTime: 60000,
  });
}

/**
 * Fetch paginated suppression list
 */
export function useSuppressionList(options?: {
  channel?: 'email' | 'sms';
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const { channel = 'email', search = '', page = 0, pageSize = 50 } = options || {};

  return useQuery({
    queryKey: ['suppression-list', tenantId, channel, search, page, pageSize],
    queryFn: async () => {
      if (!tenantId) return { data: [], count: 0 };

      let query = supabase
        .from('suppression_list')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('channel', channel)
        .is('lifted_at', null)
        .order('suppressed_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (channel === 'email') {
        query = query.in('suppression_type', EMAIL_BLOCKING_TYPES as unknown as string[]);
      }

      if (search) {
        query = query.ilike('email', `%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { data: data as SuppressionRecord[], count: count || 0 };
    },
    enabled: !!tenantId,
  });
}

/**
 * Get suppression statistics
 */
export function useSuppressionStats(options?: { enabled?: boolean }) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ['suppression-stats', tenantId],
    queryFn: async (): Promise<SuppressionStats> => {
      if (!tenantId) {
        return { total: 0, byType: {}, autoSuppressed: 0, manual: 0 };
      }

      const { data, error } = await supabase
        .from('suppression_list')
        .select('suppression_type, auto_suppressed')
        .eq('tenant_id', tenantId)
        .eq('channel', 'email')
        .is('lifted_at', null)
        .in('suppression_type', EMAIL_BLOCKING_TYPES as unknown as string[]);

      if (error) throw error;

      const records = data || [];
      const byType: Record<string, number> = {};
      let autoSuppressed = 0;
      let manual = 0;

      for (const r of records) {
        byType[r.suppression_type] = (byType[r.suppression_type] || 0) + 1;
        if (r.auto_suppressed) {
          autoSuppressed++;
        } else {
          manual++;
        }
      }

      return {
        total: records.length,
        byType,
        autoSuppressed,
        manual
      };
    },
    enabled: Boolean(tenantId) && (options?.enabled ?? true),
    staleTime: 60000,
  });
}

/**
 * Remove email from suppression list (unsuppress)
 */
export function useRemoveSuppression() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      suppressionId,
      email
    }: {
      suppressionId: string;
      email: string;
    }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Soft-delete by setting lifted_at
      const { error } = await supabase
        .from('suppression_list')
        .update({
          lifted_at: new Date().toISOString()
        })
        .eq('id', suppressionId);

      if (error) throw error;

      return { email };
    },
    onSuccess: (data) => {
      toast.success(`Removed ${data.email} from suppression list`);
      queryClient.invalidateQueries({ queryKey: ['suppression-list'] });
      queryClient.invalidateQueries({ queryKey: ['suppression-stats'] });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : null;
      toast.error(message || 'Failed to remove suppression');
    }
  });
}

/**
 * Get skipped sends for a campaign
 */
export function useCampaignSkippedSends(campaignId: string | null | undefined) {
  return useQuery({
    queryKey: ['campaign-skipped-sends', campaignId],
    queryFn: async () => {
      if (!campaignId) return { data: [], stats: {} };

      const { data, error } = await supabase
        .from('email_send_skips')
        .select('email, reason, created_at')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Calculate stats by reason
      const stats: Record<string, number> = {};
      for (const skip of data || []) {
        stats[skip.reason] = (stats[skip.reason] || 0) + 1;
      }

      return { data: data || [], stats };
    },
    enabled: !!campaignId,
  });
}
