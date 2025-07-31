import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CustomerSegment {
  id: string;
  customer_id: string;
  segment_id: string;
  assigned_at: string;
}

interface Segment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
}

export const useCustomerSegments = (customerId?: string) => {
  const queryClient = useQueryClient();
  
  // Fetch customer's current segments
  const { data: customerSegments = [], isLoading } = useQuery({
    queryKey: ['customer-segments', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_segments')
        .select('id, segment_id, assigned_at')
        .eq('customer_id', customerId);
      
      if (error) throw error;
      
      // Now fetch segment details for each segment_id
      const segmentIds = data.map(item => item.segment_id);
      if (segmentIds.length === 0) return [];
      
      // Fetch from both crm_segments and custom_segments
      const [crmSegments, customSegments] = await Promise.all([
        supabase
          .from('crm_segments')
          .select('id, name, description, customer_count')
          .in('id', segmentIds),
        supabase
          .from('custom_segments')
          .select('id, name, customer_count')
          .in('id', segmentIds)
      ]);
      
      const allSegments = [
        ...(crmSegments.data || []),
        ...(customSegments.data || [])
      ];
      
      // Combine customer_segments data with segment details
      return data.map(item => {
        const segment = allSegments.find(s => s.id === item.segment_id);
        return segment ? {
          id: item.id,
          segment_id: item.segment_id,
          assigned_at: item.assigned_at,
          segment
        } : null;
      }).filter(Boolean);
    },
    enabled: !!customerId
  });

  // Add segments to customer
  const addSegmentsMutation = useMutation({
    mutationFn: async (segmentIds: string[]) => {
      if (!customerId) throw new Error('Customer ID required');
      
      const insertData = segmentIds.map(segmentId => ({
        customer_id: customerId,
        segment_id: segmentId
      }));
      
      const { error } = await supabase
        .from('customer_segments')
        .insert(insertData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-segments', customerId] });
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      toast.success('Segments assigned successfully');
    },
    onError: (error) => {
      console.error('Error adding segments:', error);
      toast.error('Failed to assign segments');
    }
  });

  // Remove segment from customer
  const removeSegmentMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      if (!customerId) throw new Error('Customer ID required');
      
      const { error } = await supabase
        .from('customer_segments')
        .delete()
        .eq('customer_id', customerId)
        .eq('segment_id', segmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-segments', customerId] });
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      toast.success('Segment removed successfully');
    },
    onError: (error) => {
      console.error('Error removing segment:', error);
      toast.error('Failed to remove segment');
    }
  });

  const addSegments = useCallback((segmentIds: string[]) => {
    addSegmentsMutation.mutate(segmentIds);
  }, [addSegmentsMutation]);

  const removeSegment = useCallback((segmentId: string) => {
    removeSegmentMutation.mutate(segmentId);
  }, [removeSegmentMutation]);

  return {
    customerSegments,
    isLoading,
    addSegments,
    removeSegment,
    isAddingSegments: addSegmentsMutation.isPending,
    isRemovingSegment: removeSegmentMutation.isPending
  };
};