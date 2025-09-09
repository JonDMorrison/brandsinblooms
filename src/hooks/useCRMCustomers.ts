import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export interface CRMCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  persona?: string;
  persona_id?: string;
  created_at: string;
  total_spent?: number;
  last_purchase_date?: string;
}

export const useCRMCustomers = () => {
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchCustomers = useCallback(async () => {
    if (!user || !tenant?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, [user, tenant?.id]);

  const assignPersonaToCustomer = async (customerId: string, personaName: string): Promise<boolean> => {
    if (!user || !tenant?.id) return false;

    try {
      const { error } = await supabase
        .from('crm_customers')
        .update({ 
          persona: personaName,
          persona_assignment_method: 'manual',
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      
      // Update local state
      setCustomers(prev => prev.map(customer => 
        customer.id === customerId 
          ? { ...customer, persona: personaName }
          : customer
      ));
      
      return true;
    } catch (error) {
      console.error('Error assigning persona to customer:', error);
      return false;
    }
  };

  const getCustomersByPersona = (personaName: string) => {
    return customers.filter(customer => customer.persona === personaName);
  };

  const getUnassignedCustomers = () => {
    return customers.filter(customer => !customer.persona);
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
    getCustomersByPersona,
    getUnassignedCustomers
  };
};