import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { SYSTEM_SEGMENTS } from '@/config/segmentDefinitions';
import {
  resolveSegments,
  DbSegment,
  ResolvedSegment,
  DuplicateWarning,
} from '@/utils/segmentResolution';

interface UseSegmentResolutionReturn {
  resolved: ResolvedSegment[];
  systemSegments: ResolvedSegment[];
  userSegments: ResolvedSegment[];
  pendingSystemSegments: ResolvedSegment[];
  duplicateWarnings: DuplicateWarning[];
  loading: boolean;
  refresh: () => void;
}

export const useSegmentResolution = (refreshKey?: number): UseSegmentResolutionReturn => {
  const [dbSegments, setDbSegments] = useState<DbSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchSegments = useCallback(async () => {
    if (!user || !tenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_segments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with live customer counts
      const enriched: DbSegment[] = await Promise.all(
        (data || []).map(async (seg) => {
          const { count } = await supabase
            .from('customer_segments')
            .select('*', { count: 'exact', head: true })
            .eq('segment_id', seg.id);
          return { ...seg, customer_count: count ?? seg.customer_count ?? 0 } as DbSegment;
        }),
      );

      setDbSegments(enriched);
    } catch (err) {
      console.error('useSegmentResolution fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, tenant]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments, refreshKey]);

  const result = useMemo(
    () => resolveSegments(dbSegments, SYSTEM_SEGMENTS),
    [dbSegments],
  );

  return {
    ...result,
    loading,
    refresh: fetchSegments,
  };
};
