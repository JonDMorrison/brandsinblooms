
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface CRMSegment {
  id: string;
  name: string;
  description?: string;
  conditions: any;
  customer_count: number;
  auto_update: boolean;
  persona_id?: string;
  created_at: string;
  updated_at: string;
}

export const useCRMSegments = () => {
  const [segments, setSegments] = useState<CRMSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchSegments = useCallback(async () => {
    if (!user || !tenant) return;

    setLoading(true);
    try {
      console.log('🔄 Fetching segments for tenant:', tenant.id);
      
      // First get all segments
      const { data: segmentsData, error: segmentsError } = await supabase
        .from('crm_segments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (segmentsError) throw segmentsError;
      
      console.log('📋 Found segments:', segmentsData);

      // Then get customer counts for each segment
      const segmentsWithCount = await Promise.all(
        (segmentsData || []).map(async (segment) => {
          console.log(`🔢 Counting customers for segment: ${segment.name} (${segment.id})`);
          
          const { count, error: countError } = await supabase
            .from('customer_segments')
            .select('*', { count: 'exact', head: true })
            .eq('segment_id', segment.id);

          if (countError) {
            console.error('❌ Error counting customers for segment:', segment.id, countError);
          }

          console.log(`✅ Customer count for ${segment.name}:`, count);

          return {
            ...segment,
            customer_count: count || 0
          };
        })
      );
      
      console.log('🎯 Final segments with counts:', segmentsWithCount);
      setSegments(segmentsWithCount);
    } catch (error) {
      console.error('❌ Error fetching segments:', error);
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, [user, tenant]);

  const createSegment = useCallback(async (segmentData: { name: string; filters: any[] }) => {
    if (!user || !tenant) {
      console.error('Cannot create segment: missing user or tenant');
      toast.error('Authentication error. Please refresh and try again.');
      throw new Error('Missing user or tenant');
    }

    console.log('Creating segment with data:', {
      name: segmentData.name,
      tenant_id: tenant.id,
      user_id: user.id,
      filters: segmentData.filters
    });

    try {
      const { data, error } = await supabase
        .from('crm_segments')
        .insert({
          name: segmentData.name,
          conditions: { filters: segmentData.filters },
          tenant_id: tenant.id,
          user_id: user.id,
          customer_count: 0,
          auto_update: true
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating segment:', error);
        toast.error(`Failed to create segment: ${error.message}`);
        throw error;
      }
      
      console.log('Segment created successfully:', data);
      
      // Add the new segment to the list
      setSegments(prev => [data, ...prev]);
      return true;
    } catch (error: any) {
      console.error('Error creating segment:', error);
      toast.error(error.message || 'Failed to create segment');
      throw error;
    }
  }, [user, tenant]);

  const deleteSegment = useCallback(async (segmentId: string) => {
    if (!user || !tenant) return false;

    try {
      const { error } = await supabase
        .from('crm_segments')
        .delete()
        .eq('id', segmentId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      
      // Remove the segment from the list
      setSegments(prev => prev.filter(segment => segment.id !== segmentId));
      toast.success('Segment deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting segment:', error);
      toast.error('Failed to delete segment');
      return false;
    }
  }, [user, tenant]);

  // Filter segments based on search term
  const filteredSegments = segments.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    segment.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  return {
    segments: filteredSegments,
    loading,
    searchTerm,
    setSearchTerm,
    fetchSegments,
    createSegment,
    deleteSegment
  };
};
