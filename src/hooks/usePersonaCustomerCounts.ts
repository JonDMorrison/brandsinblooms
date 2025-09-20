import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useAllPersonas } from '@/hooks/useAllPersonas';

interface PersonaCounts {
  [personaId: string]: number;
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
        console.log('🔧 usePersonaCustomerCounts: Missing dependencies', { user: !!user, tenant: !!tenant, personas: !!personas });
        setLoading(false);
        return;
      }

      console.log('🔧 usePersonaCustomerCounts: Fetching counts for tenant:', tenant.id);

      try {
        const { data: customers, error } = await supabase
          .from('crm_customers')
          .select('persona_id, persona')
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        console.log('🔧 usePersonaCustomerCounts: Raw customer data:', customers);
        console.log('🔧 usePersonaCustomerCounts: Available personas:', personas);

        // Count customers by persona using unified approach
        const personaCounts: PersonaCounts = {};
        
        // Initialize all persona IDs with 0 counts
        personas.forEach(persona => {
          personaCounts[persona.id] = 0;
        });
        
        customers?.forEach(customer => {
          if (customer.persona_id) {
            // Count by persona ID (preferred method)
            personaCounts[customer.persona_id] = (personaCounts[customer.persona_id] || 0) + 1;
          } else if (customer.persona) {
            // Fallback to legacy persona field - find ID by name and count
            const persona = personas.find(p => p.persona_name === customer.persona);
            if (persona) {
              personaCounts[persona.id] = (personaCounts[persona.id] || 0) + 1;
            }
          }
        });

        console.log('🔧 usePersonaCustomerCounts: Final counts:', personaCounts);
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