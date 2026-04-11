import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useAllPersonas } from "@/hooks/useAllPersonas";

interface PersonaCounts {
  [personaId: string]: number;
}

export const usePersonaCustomerCounts = () => {
  const [counts, setCounts] = useState<PersonaCounts>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { personas } = useAllPersonas();

  const refreshCounts = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    const fetchPersonaCounts = async () => {
      if (!user || !tenant || !personas) {
        setLoading(false);
        return;
      }
      try {
        // Get counts from the customer_personas many-to-many table AND legacy persona field
        const [customerPersonasResult, legacyCustomersResult] =
          await Promise.all([
            // Count from customer_personas table (new assignments)
            supabase
              .from("customer_personas")
              .select(
                `
              persona_id,
              predefined_persona_id,
              crm_customers!inner(tenant_id)
            `,
              )
              .eq("crm_customers.tenant_id", tenant.id),

            // Count from legacy persona field in crm_customers table
            supabase
              .from("crm_customers")
              .select("persona")
              .eq("tenant_id", tenant.id)
              .not("persona", "is", null),
          ]);

        if (customerPersonasResult.error) throw customerPersonasResult.error;
        // Initialize all persona IDs with 0 counts
        const personaCounts: PersonaCounts = {};
        personas.forEach((persona) => {
          personaCounts[persona.id] = 0;
        });

        // Count from customer_personas table (many-to-many assignments)
        customerPersonasResult.data?.forEach((assignment) => {
          const personaId =
            assignment.persona_id || assignment.predefined_persona_id;
          if (personaId) {
            personaCounts[personaId] = (personaCounts[personaId] || 0) + 1;
          }
        });

        // Count from legacy persona field - find customers not already counted in customer_personas
        legacyCustomersResult.data?.forEach((customer) => {
          if (customer.persona) {
            const persona = personas.find(
              (p) => p.persona_name === customer.persona,
            );
            if (persona) {
              // Only count legacy if this persona doesn't already have assignments in customer_personas
              // This prevents double-counting during migration
              const hasNewAssignments = customerPersonasResult.data?.some(
                (cp) =>
                  cp.persona_id === persona.id ||
                  cp.predefined_persona_id === persona.id,
              );
              if (!hasNewAssignments) {
                personaCounts[persona.id] =
                  (personaCounts[persona.id] || 0) + 1;
              }
            }
          }
        });
        setCounts(personaCounts);
      } catch (error) {
        console.error("Error fetching persona counts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPersonaCounts();
  }, [user, tenant, personas, refreshKey]);

  return { counts, loading, refreshCounts };
};
