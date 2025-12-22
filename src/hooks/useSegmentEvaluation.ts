import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SegmentEvaluationResult } from '@/types/segmentation';

/**
 * Hook to trigger segment evaluation
 */
export function useEvaluateSegments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      segmentId 
    }: { 
      tenantId?: string; 
      segmentId?: string 
    }): Promise<SegmentEvaluationResult> => {
      console.log('[useEvaluateSegments] Triggering evaluation', { tenantId, segmentId });

      const { data, error } = await supabase.functions.invoke('evaluate-segments', {
        body: { 
          tenant_id: tenantId, 
          segment_id: segmentId 
        }
      });

      if (error) {
        console.error('[useEvaluateSegments] Error:', error);
        throw error;
      }

      return data as SegmentEvaluationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['crm_segments'] });
    }
  });
}

/**
 * Hook to fetch all dynamic segments for a tenant
 */
export function useDynamicSegments(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['dynamic-segments', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('crm_segments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) {
        console.error('[useDynamicSegments] Error:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!tenantId
  });
}