import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

interface SegmentCounts {
  'loyalty-members': number;
  'high-value': number;
  'new-customers': number;
  'lapsed-customers': number;
  'seasonal-shoppers': number;
  'frequent-buyers': number;
}

export const useSegmentCounts = () => {
  const [counts, setCounts] = useState<SegmentCounts>({
    'loyalty-members': 0,
    'high-value': 0,
    'new-customers': 0,
    'lapsed-customers': 0,
    'seasonal-shoppers': 0,
    'frequent-buyers': 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchSegmentCounts = useCallback(async () => {
      if (!user || !tenant) {
        console.log('❌ Missing user or tenant:', { user: !!user, tenant: !!tenant });
        return;
      }

      console.log('🚀 Starting fetchSegmentCounts for tenant:', tenant.id);
      setLoading(true);
      try {
        // Get all customers for the tenant
        const { data: customers, error } = await supabase
          .from('crm_customers')
          .select('*')
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        console.log('👥 Total customers found:', customers?.length || 0);
        console.log('👥 Customers data:', customers);

        if (!customers) {
          console.log('❌ No customers found, setting all counts to 0');
          setCounts({
            'loyalty-members': 0,
            'high-value': 0,
            'new-customers': 0,
            'lapsed-customers': 0,
            'seasonal-shoppers': 0,
            'frequent-buyers': 0,
          });
          return;
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        console.log('📅 Date calculations:', { now, thirtyDaysAgo, ninetyDaysAgo });

        // Calculate automatic segment qualifications
        const newCustomers = customers.filter(customer => 
          new Date(customer.created_at) >= thirtyDaysAgo
        );
        const loyaltyCustomers = customers.filter(customer => 
          customer.tags && customer.tags.includes('loyalty')
        );
        const highValueCustomers = customers.filter(customer => 
          customer.total_spent && customer.total_spent > 500
        );
        const lapsedCustomers = customers.filter(customer => 
          customer.last_purchase_date && 
          new Date(customer.last_purchase_date) < ninetyDaysAgo
        );
        const seasonalCustomers = customers.filter(customer => 
          customer.tags && (
            customer.tags.some((tag: string) => 
              ['seasonal', 'holiday', 'christmas', 'valentine', 'easter', 'summer', 'winter'].includes(tag.toLowerCase())
            )
          )
        );
        const frequentBuyers = customers.filter(customer => 
          customer.order_history && 
          Array.isArray(customer.order_history) && 
          customer.order_history.length >= 3
        );

        console.log('🔍 Automatic qualifications:', {
          newCustomers: newCustomers.length,
          loyaltyCustomers: loyaltyCustomers.length,
          highValueCustomers: highValueCustomers.length,
          lapsedCustomers: lapsedCustomers.length,
          seasonalCustomers: seasonalCustomers.length,
          frequentBuyers: frequentBuyers.length,
        });

        console.log('👤 Sample new customers:', newCustomers.slice(0, 3).map(c => ({ email: c.email, created_at: c.created_at })));

        // Get manual segment assignments for predefined segments
        let manualAssignments: Record<string, Set<string>> = {};
        
        // First, try to get ALL customer segments for this tenant
        const { data: allCustomerSegments, error: segmentsError } = await supabase
          .from('customer_segments')
          .select('customer_id, segment_id')
          .in('customer_id', customers.map(c => c.id));

        if (segmentsError) {
          console.error('Error fetching customer segments:', segmentsError);
        } else if (allCustomerSegments && allCustomerSegments.length > 0) {
          console.log('🔍 All customer segments found:', allCustomerSegments);

          // Get the corresponding segment details
          const segmentIds = [...new Set(allCustomerSegments.map(cs => cs.segment_id))];
          const { data: segmentDetails, error: detailsError } = await supabase
            .from('crm_segments')
            .select('id, name')
            .in('id', segmentIds)
            .eq('tenant_id', tenant.id);

          if (detailsError) {
            console.error('Error fetching segment details:', detailsError);
          } else if (segmentDetails) {
            console.log('🔍 Segment details found:', segmentDetails);

            // Build manual assignments by segment name
            allCustomerSegments.forEach(assignment => {
              const segment = segmentDetails.find(s => s.id === assignment.segment_id);
              if (segment && segment.name) {
                if (!manualAssignments[segment.name]) {
                  manualAssignments[segment.name] = new Set();
                }
                manualAssignments[segment.name].add(assignment.customer_id);
              }
            });
          }
        }

        console.log('🔍 Manual assignments found:', manualAssignments);

        // Calculate segment counts (combining automatic + manual assignments)
        const segmentCounts: SegmentCounts = {
          'loyalty-members': new Set([
            ...loyaltyCustomers.map(c => c.id),
            ...(manualAssignments['Loyalty Members'] || [])
          ]).size,
          
          'high-value': new Set([
            ...highValueCustomers.map(c => c.id),
            ...(manualAssignments['High-Value Customers'] || [])
          ]).size,
          
          'new-customers': new Set([
            ...newCustomers.map(c => c.id),
            ...(manualAssignments['New Customers'] || [])
          ]).size,
          
          'lapsed-customers': new Set([
            ...lapsedCustomers.map(c => c.id),
            ...(manualAssignments['Lapsed Customers'] || [])
          ]).size,
          
          'seasonal-shoppers': new Set([
            ...seasonalCustomers.map(c => c.id),
            ...(manualAssignments['Seasonal Shoppers'] || [])
          ]).size,
          
          'frequent-buyers': new Set([
            ...frequentBuyers.map(c => c.id),
            ...(manualAssignments['Frequent Buyers'] || [])
          ]).size,
        };

        console.log('🔢 Final segment counts:', segmentCounts);

        setCounts(segmentCounts);
      } catch (error) {
        console.error('Error fetching segment counts:', error);
        // Keep counts at 0 on error
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

  return { counts, loading, refreshCounts };
};
