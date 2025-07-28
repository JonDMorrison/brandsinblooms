import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

interface PersonaCounts {
  [personaName: string]: number;
}

export const usePersonaCustomerCounts = () => {
  const [counts, setCounts] = useState<PersonaCounts>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenant } = useTenant();

  useEffect(() => {
    const fetchPersonaCounts = async () => {
      if (!user || !tenant) {
        setLoading(false);
        return;
      }

      try {
        const { data: customers, error } = await supabase
          .from('crm_customers')
          .select('persona')
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        // Count customers by persona
        const personaCounts: PersonaCounts = {};
        customers?.forEach(customer => {
          if (customer.persona) {
            personaCounts[customer.persona] = (personaCounts[customer.persona] || 0) + 1;
          }
        });

        setCounts(personaCounts);
      } catch (error) {
        console.error('Error fetching persona counts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPersonaCounts();
  }, [user, tenant]);

  return { counts, loading };
};