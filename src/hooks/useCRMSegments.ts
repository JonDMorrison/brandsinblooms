import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';

interface Segment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
  type: 'predefined' | 'custom';
  persona_id?: string;
  conditions?: any;
  created_at?: string;
}

const PREDEFINED_SEGMENTS = [
  {
    id: "loyalty-members",
    name: "Loyalty Members",
    description: "Customers in the loyalty program",
    type: "predefined" as const,
    customer_count: 0,
    conditions: { loyalty_program: true }
  },
  {
    id: "new-customers",
    name: "New Customers",
    description: "First purchase in last 30 days",
    type: "predefined" as const,
    customer_count: 0,
    conditions: { first_purchase_days: 30 }
  },
  {
    id: "at-risk-customers",
    name: "At-Risk Customers",
    description: "No purchase in 6+ months",
    type: "predefined" as const,
    customer_count: 0,
    conditions: { last_purchase_days: 180 }
  },
  {
    id: "email-engagers",
    name: "Email Engagers",
    description: "Clicked on last 3 campaigns",
    type: "predefined" as const,
    customer_count: 0,
    conditions: { email_engagement: "high" }
  },
  {
    id: "frequent-buyers",
    name: "Frequent Buyers",
    description: "3+ purchases in last 60 days",
    type: "predefined" as const,
    customer_count: 0,
    conditions: { purchase_frequency: { count: 3, days: 60 } }
  },
  {
    id: "big-spenders",
    name: "Big Spenders",
    description: "Average cart value > $200",
    type: "predefined" as const,
    customer_count: 0,
    conditions: { avg_cart_value: { operator: ">", value: 200 } }
  }
];

export const useCRMSegments = () => {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSegments = async () => {
    try {
      setLoading(true);
      
      // Fetch custom segments from crm_segments
      const { data: crmSegments, error: crmError } = await supabase
        .from('crm_segments')
        .select('*')
        .order('name');

      if (crmError) throw crmError;

      // Fetch custom segments from custom_segments
      const { data: customSegments, error: customError } = await supabase
        .from('custom_segments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (customError) throw customError;

      // Combine all segments
      const allSegments: Segment[] = [
        ...PREDEFINED_SEGMENTS,
        ...(crmSegments || []).map(seg => ({
          id: seg.id,
          name: seg.name,
          description: seg.description,
          customer_count: seg.customer_count || 0,
          type: 'custom' as const,
          persona_id: seg.persona_id,
          conditions: seg.conditions,
          created_at: seg.created_at
        })),
        ...(customSegments || []).map(seg => ({
          id: seg.id,
          name: seg.name,
          description: `Custom segment with ${seg.customer_count || 0} customers`,
          customer_count: seg.customer_count || 0,
          type: 'custom' as const,
          conditions: seg.filters,
          created_at: seg.created_at
        }))
      ];

      setSegments(allSegments);
    } catch (error) {
      console.error('Error fetching segments:', error);
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  const deleteSegment = async (segmentId: string, segmentType: string) => {
    try {
      if (segmentType === 'predefined') {
        toast.error('Cannot delete predefined segments');
        return;
      }

      // Try to delete from crm_segments first
      const { error: crmError } = await supabase
        .from('crm_segments')
        .delete()
        .eq('id', segmentId);

      if (crmError) {
        // If not found in crm_segments, try custom_segments
        const { error: customError } = await supabase
          .from('custom_segments')
          .delete()
          .eq('id', segmentId);

        if (customError) throw customError;
      }

      toast.success('Segment deleted successfully');
      fetchSegments(); // Refresh the list
    } catch (error) {
      console.error('Error deleting segment:', error);
      toast.error('Failed to delete segment');
    }
  };

  const filteredSegments = segments.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    segment.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchSegments();
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    const crmChannel = supabase
      .channel('crm_segments_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'crm_segments' },
        () => fetchSegments()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'custom_segments' },
        () => fetchSegments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(crmChannel);
    };
  }, []);

  return {
    segments: filteredSegments,
    loading,
    searchTerm,
    setSearchTerm,
    fetchSegments,
    deleteSegment
  };
};