import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { SYSTEM_SEGMENTS, SegmentDefinition } from '@/config/segmentDefinitions';

const ID_CHUNK_SIZE = 200;

function chunkIds(ids: string[], size = ID_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

interface SegmentCounts {
  [key: string]: number;
}

export const useSegmentCountsBeta = () => {
  const [counts, setCounts] = useState<SegmentCounts>({});
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useAuth();
  const { tenant } = useTenant();

  const evaluateCondition = (customer: any, condition: { field: string; operator: string; value: any }): boolean => {
    const { field, operator, value } = condition;
    const customerValue = customer[field];

    switch (operator) {
      case '>':
        return Number(customerValue) > Number(value);
      case '<':
        return Number(customerValue) < Number(value);
      case '>=':
        return Number(customerValue) >= Number(value);
      case '<=':
        return Number(customerValue) <= Number(value);
      case '=':
        return customerValue === value;
      case '!=':
        return customerValue !== value;
      case 'contains':
        if (Array.isArray(customerValue)) {
          return customerValue.some((v: string) =>
            v.toLowerCase().includes(String(value).toLowerCase())
          );
        }
        return String(customerValue || '').toLowerCase().includes(String(value).toLowerCase());
      case 'contains_any':
        if (Array.isArray(customerValue) && Array.isArray(value)) {
          return customerValue.some((cv: string) =>
            value.some((v: string) => cv.toLowerCase().includes(v.toLowerCase()))
          );
        }
        return false;
      case 'within_days': {
        if (!customerValue) return false;
        const date = new Date(customerValue);
        const daysAgo = new Date(Date.now() - Number(value) * 24 * 60 * 60 * 1000);
        return date >= daysAgo;
      }
      case 'older_than_days': {
        if (!customerValue) return false;
        const date = new Date(customerValue);
        const daysAgo = new Date(Date.now() - Number(value) * 24 * 60 * 60 * 1000);
        return date < daysAgo;
      }
      default:
        return false;
    }
  };

  const evaluateSegment = (customer: any, segment: SegmentDefinition): boolean => {
    const { rules, logic } = segment.conditions;

    if (rules.length === 0) return false;

    if (logic === 'AND') {
      return rules.every(rule => evaluateCondition(customer, rule));
    } else {
      return rules.some(rule => evaluateCondition(customer, rule));
    }
  };

  const fetchSegmentCounts = useCallback(async () => {
    if (!user || !tenant) return;

    setLoading(true);
    try {
      const { data: customers, error } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      if (!customers || customers.length === 0) {
        const emptyCounts: SegmentCounts = {};
        SYSTEM_SEGMENTS.forEach(s => { emptyCounts[s.id] = 0; });
        setCounts(emptyCounts);
        return;
      }

      // Get manual segment assignments
      const customerIds = customers.map(c => c.id);
      const customerSegments: Array<{ customer_id: string; segment_id: string }> = [];

      for (const idChunk of chunkIds(customerIds)) {
        const { data: customerSegmentsChunk, error: customerSegmentsError } = await supabase
          .from('customer_segments')
          .select('customer_id, segment_id')
          .in('customer_id', idChunk);

        if (customerSegmentsError) {
          console.error('Error fetching customer segments chunk:', customerSegmentsError);
          continue;
        }

        if (customerSegmentsChunk?.length) {
          customerSegments.push(...customerSegmentsChunk);
        }
      }

      const { data: segmentDetails } = await supabase
        .from('crm_segments')
        .select('id, name')
        .eq('tenant_id', tenant.id);

      // Build manual assignment map by segment name
      const manualAssignments: Record<string, Set<string>> = {};
      if (customerSegments.length > 0 && segmentDetails) {
        customerSegments.forEach(assignment => {
          const segment = segmentDetails.find(s => s.id === assignment.segment_id);
          if (segment?.name) {
            if (!manualAssignments[segment.name]) {
              manualAssignments[segment.name] = new Set();
            }
            manualAssignments[segment.name].add(assignment.customer_id);
          }
        });
      }

      // Calculate counts for each system segment
      const segmentCounts: SegmentCounts = {};

      SYSTEM_SEGMENTS.forEach(segment => {
        const automaticMatches = customers.filter(c => evaluateSegment(c, segment));
        const manualMatches = manualAssignments[segment.name] || new Set();

        // Combine automatic + manual (unique customers)
        const allMatches = new Set([
          ...automaticMatches.map(c => c.id),
          ...manualMatches
        ]);

        segmentCounts[segment.id] = allMatches.size;
      });

      setCounts(segmentCounts);
    } catch (error) {
      console.error('Error fetching segment counts:', error);
    } finally {
      setLoading(false);
    }
  }, [user, tenant]);

  useEffect(() => {
    fetchSegmentCounts();
  }, [fetchSegmentCounts, refreshKey]);

  const refreshCounts = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return {
    counts,
    loading,
    refreshCounts,
    segments: SYSTEM_SEGMENTS
  };
};
