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
      
      // Check if any of the segments are predefined (non-UUID format)
      const predefinedSegmentIds = segmentIds.filter(id => !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
      const uuidSegmentIds = segmentIds.filter(id => id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
      
      // Create predefined segments in database if needed
      const createdSegmentIds = [];
      for (const predefinedId of predefinedSegmentIds) {
        // Get predefined segment details
        const predefinedSegments = [
          { id: 'loyalty-members', name: 'Loyalty Members', description: 'Customers enrolled in your loyalty program with active engagement' },
          { id: 'high-value', name: 'High-Value Customers', description: 'Top spending customers who drive significant revenue' },
          { id: 'new-customers', name: 'New Customers', description: 'Recent customers who made their first purchase within 30 days' },
          { id: 'lapsed-customers', name: 'Lapsed Customers', description: 'Previously active customers who haven\'t purchased in 90+ days' },
          { id: 'seasonal-shoppers', name: 'Seasonal Shoppers', description: 'Customers who typically purchase during specific seasons or holidays' },
          { id: 'frequent-buyers', name: 'Frequent Buyers', description: 'Customers with 3+ purchases in the last 6 months' },
        ];
        
        const predefinedSegment = predefinedSegments.find(s => s.id === predefinedId);
        if (predefinedSegment) {
          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');
          
          // Get current user's tenant
          const { data: userData } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single();
          
          if (userData?.tenant_id) {
            // Create segment in crm_segments table
            const { data: newSegment, error: createError } = await supabase
              .from('crm_segments')
              .insert({
                name: predefinedSegment.name,
                description: predefinedSegment.description,
                tenant_id: userData.tenant_id,
                user_id: user.id,
                conditions: {},
                customer_count: 0
              })
              .select('id')
              .single();
            
            if (!createError && newSegment) {
              createdSegmentIds.push(newSegment.id);
            }
          }
        }
      }
      
      // Combine all segment IDs (existing UUIDs + newly created UUIDs)
      const allSegmentIds = [...uuidSegmentIds, ...createdSegmentIds];
      
      if (allSegmentIds.length === 0) {
        throw new Error('No valid segments to assign');
      }
      
      const insertData = allSegmentIds.map(segmentId => ({
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