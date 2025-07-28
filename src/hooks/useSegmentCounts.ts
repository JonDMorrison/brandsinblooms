import { useState, useEffect } from 'react';
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
  const { user } = useAuth();
  const { tenant } = useTenant();

  useEffect(() => {
    const fetchSegmentCounts = async () => {
      if (!user || !tenant) return;

      setLoading(true);
      try {
        // Get all customers for the tenant
        const { data: customers, error } = await supabase
          .from('crm_customers')
          .select('*')
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        if (!customers) {
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

        // Calculate segment counts
        const segmentCounts: SegmentCounts = {
          'loyalty-members': customers.filter(customer => 
            customer.tags && customer.tags.includes('loyalty')
          ).length,
          
          'high-value': customers.filter(customer => 
            customer.total_spent && customer.total_spent > 500
          ).length,
          
          'new-customers': customers.filter(customer => 
            new Date(customer.created_at) >= thirtyDaysAgo
          ).length,
          
          'lapsed-customers': customers.filter(customer => 
            customer.last_purchase_date && 
            new Date(customer.last_purchase_date) < ninetyDaysAgo
          ).length,
          
          'seasonal-shoppers': customers.filter(customer => 
            customer.tags && (
              customer.tags.some((tag: string) => 
                ['seasonal', 'holiday', 'christmas', 'valentine', 'easter', 'summer', 'winter'].includes(tag.toLowerCase())
              )
            )
          ).length,
          
          'frequent-buyers': customers.filter(customer => 
            customer.order_history && 
            Array.isArray(customer.order_history) && 
            customer.order_history.length >= 3
          ).length,
        };

        setCounts(segmentCounts);
      } catch (error) {
        console.error('Error fetching segment counts:', error);
        // Keep counts at 0 on error
      } finally {
        setLoading(false);
      }
    };

    fetchSegmentCounts();
  }, [user, tenant]);

  return { counts, loading };
};
