/**
 * Hook for fetching automation email execution data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExecutionStats {
  sent: number;
  skipped: number;
  failed: number;
  byReason: Record<string, number>;
}

export interface FailedExecution {
  id: string;
  customer_id: string;
  email: string;
  error: string;
  reason: string | null;
  created_at: string;
}

/**
 * Get execution stats for an automation email node
 */
export function useNodeExecutionStats(automationId: string | undefined, nodeId: string | undefined) {
  return useQuery({
    queryKey: ['automation-email-executions', automationId, nodeId, 'stats'],
    queryFn: async (): Promise<ExecutionStats> => {
      if (!automationId || !nodeId) {
        return { sent: 0, skipped: 0, failed: 0, byReason: {} };
      }

      const { data, error } = await supabase
        .from('automation_email_executions')
        .select('status, reason')
        .eq('automation_id', automationId)
        .eq('automation_node_id', nodeId);

      if (error || !data) {
        console.error('Failed to fetch execution stats:', error);
        return { sent: 0, skipped: 0, failed: 0, byReason: {} };
      }

      const stats: ExecutionStats = {
        sent: 0,
        skipped: 0,
        failed: 0,
        byReason: {},
      };

      for (const row of data) {
        if (row.status === 'sent') stats.sent++;
        else if (row.status === 'skipped') stats.skipped++;
        else if (row.status === 'failed') stats.failed++;

        if (row.reason) {
          stats.byReason[row.reason] = (stats.byReason[row.reason] || 0) + 1;
        }
      }

      return stats;
    },
    enabled: !!automationId && !!nodeId,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * Get failed executions for an automation email node
 */
export function useNodeFailedExecutions(automationId: string | undefined, nodeId: string | undefined) {
  return useQuery({
    queryKey: ['automation-email-executions', automationId, nodeId, 'failed'],
    queryFn: async (): Promise<FailedExecution[]> => {
      if (!automationId || !nodeId) return [];

      const { data, error } = await supabase
        .from('automation_email_executions')
        .select('id, customer_id, email, error, reason, created_at')
        .eq('automation_id', automationId)
        .eq('automation_node_id', nodeId)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch failed executions:', error);
        return [];
      }

      // Deduplicate by customer_id, keep most recent
      const seen = new Set<string>();
      const result: FailedExecution[] = [];

      for (const row of data || []) {
        if (row.customer_id && !seen.has(row.customer_id)) {
          seen.add(row.customer_id);
          result.push(row as FailedExecution);
        }
      }

      return result;
    },
    enabled: !!automationId && !!nodeId,
    staleTime: 30000,
  });
}

/**
 * Retry failed executions for an automation email node
 */
export function useRetryAutomationEmailNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ automationId, nodeId }: { automationId: string; nodeId: string }) => {
      const { data, error } = await supabase.functions.invoke('retry-automation-email-node', {
        body: { automationId, automationNodeId: nodeId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Retry failed');

      return data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Retry complete: ${data.sent} sent, ${data.skipped} skipped, ${data.failed} failed`);
      queryClient.invalidateQueries({ 
        queryKey: ['automation-email-executions', variables.automationId, variables.nodeId] 
      });
    },
    onError: (error: Error) => {
      toast.error(`Retry failed: ${error.message}`);
    },
  });
}

/**
 * Get recent executions for an automation email node
 */
export function useNodeRecentExecutions(
  automationId: string | undefined, 
  nodeId: string | undefined,
  limit: number = 20
) {
  return useQuery({
    queryKey: ['automation-email-executions', automationId, nodeId, 'recent', limit],
    queryFn: async () => {
      if (!automationId || !nodeId) return [];

      const { data, error } = await supabase
        .from('automation_email_executions')
        .select('id, email, status, reason, error, resend_message_id, created_at')
        .eq('automation_id', automationId)
        .eq('automation_node_id', nodeId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch recent executions:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!automationId && !!nodeId,
    staleTime: 30000,
  });
}
