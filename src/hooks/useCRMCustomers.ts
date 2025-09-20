import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useCRMPersonas } from "@/hooks/useCRMPersonas";

export interface CRMCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  persona?: string; // Legacy field
  persona_id?: string; // Legacy field
  created_at: string;
  total_spent?: number;
  last_purchase_date?: string;
  assigned_personas?: any[]; // New field for many-to-many relationships
}

export const useCRMCustomers = () => {
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { personas } = useCRMPersonas();

  const fetchCustomers = useCallback(async () => {
    if (!user || !tenant?.id) return;
    
    try {
      setLoading(true);
      // Fetch customers with their persona assignments (left join to include customers without personas)
      const { data, error } = await supabase
        .from('crm_customers')
        .select(`
          *,
          customer_personas(
            persona_id,
            predefined_persona_id,
            personas:persona_id(persona_name)
          )
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to include persona information
      const customersWithPersonas = (data || []).map(customer => ({
        ...customer,
        assigned_personas: customer.customer_personas || []
      }));
      
      setCustomers(customersWithPersonas);
    } catch (error) {
      console.error('Error fetching customers:', error);
      // Fallback to simple fetch if join fails
      try {
        const { data, error: fallbackError } = await supabase
          .from('crm_customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        setCustomers(data || []);
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  }, [user, tenant?.id]);

  const assignPersonaToCustomer = async (customerId: string, personaName: string): Promise<boolean> => {
    if (!user || !tenant?.id) return false;

    try {
      // First, check if this is a predefined persona or custom persona
      const isCustomPersona = personas.some(p => p.persona_name === personaName && p.is_custom);
      
      if (isCustomPersona) {
        // For custom personas, use the customer_personas table
        const customPersona = personas.find(p => p.persona_name === personaName && p.is_custom);
        if (!customPersona) return false;

        const { error } = await supabase
          .from('customer_personas')
          .insert({
            customer_id: customerId,
            persona_id: customPersona.id
          });

        if (error && error.code !== '23505') { // Ignore duplicate key errors
          throw error;
        }
      } else {
        // For system personas, use the customer_personas table with predefined_persona_id
        const { error } = await supabase
          .from('customer_personas')
          .insert({
            customer_id: customerId,
            predefined_persona_id: personaName
          });

        if (error && error.code !== '23505') { // Ignore duplicate key errors
          throw error;
        }
      }
      
      // Refresh the customer data
      await fetchCustomers();
      
      return true;
    } catch (error) {
      console.error('Error assigning persona to customer:', error);
      return false;
    }
  };

  const removePersonaFromCustomer = async (customerId: string): Promise<boolean> => {
    if (!user || !tenant?.id) return false;

    try {
      // Remove from customer_personas table (handles both custom and system personas)
      const { error } = await supabase
        .from('customer_personas')
        .delete()
        .eq('customer_id', customerId);

      if (error) throw error;
      
      // Also clear legacy persona field for backwards compatibility
      const { error: legacyError } = await supabase
        .from('crm_customers')
        .update({ 
          persona: null,
          persona_id: null,
          persona_assignment_method: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId)
        .eq('tenant_id', tenant.id);

      if (legacyError) console.warn('Error clearing legacy persona field:', legacyError);
      
      // Refresh the customer data
      await fetchCustomers();
      
      return true;
    } catch (error) {
      console.error('Error removing persona from customer:', error);
      return false;
    }
  };

  const getCustomersByPersona = (personaName: string) => {
    return customers.filter(customer => {
      // Check both legacy persona field and new many-to-many relationships
      const hasLegacyPersona = customer.persona === personaName;
      const hasNewPersona = customer.assigned_personas?.some(assignment => 
        assignment.predefined_persona_id === personaName ||
        assignment.personas?.persona_name === personaName
      );
      return hasLegacyPersona || hasNewPersona;
    });
  };

  const getUnassignedCustomers = () => {
    return customers.filter(customer => {
      const hasLegacyPersona = !!customer.persona;
      const hasNewPersona = customer.assigned_personas && customer.assigned_personas.length > 0;
      return !hasLegacyPersona && !hasNewPersona;
    });
  };

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.first_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.last_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return {
    customers: filteredCustomers,
    loading,
    searchTerm,
    setSearchTerm,
    fetchCustomers,
    assignPersonaToCustomer,
    removePersonaFromCustomer,
    getCustomersByPersona,
    getUnassignedCustomers
  };
};