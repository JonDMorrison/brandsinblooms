import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useAllPersonas } from '@/hooks/useAllPersonas';

interface PersonaCounts {
  [personaName: string]: number;
}

export const usePersonaCustomerCounts = () => {
  const [counts, setCounts] = useState<PersonaCounts>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { personas } = useAllPersonas();

  useEffect(() => {
    const fetchPersonaCounts = async () => {
      if (!user || !tenant || !personas) {
        setLoading(false);
        return;
      }

      try {
        const { data: customers, error } = await supabase
          .from('crm_customers')
          .select('persona_id, persona')
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        // Count customers by persona using unified approach
        const personaCounts: PersonaCounts = {};
        
        // Initialize all persona names with 0 counts
        personas.forEach(persona => {
          personaCounts[persona.persona_name] = 0;
        });
        
        customers?.forEach(customer => {
          if (customer.persona_id) {
            // Find persona name by ID (preferred method)
            const persona = personas.find(p => p.id === customer.persona_id);
            if (persona) {
              personaCounts[persona.persona_name] = (personaCounts[persona.persona_name] || 0) + 1;
            }
          } else if (customer.persona) {
            // Fallback to legacy persona field - only count if it matches a current persona
            const persona = personas.find(p => p.persona_name === customer.persona);
            if (persona) {
              personaCounts[persona.persona_name] = (personaCounts[persona.persona_name] || 0) + 1;
            }
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
  }, [user, tenant, personas]);

  return { counts, loading };
};