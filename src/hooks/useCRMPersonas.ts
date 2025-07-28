import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface CRMPersona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export const useCRMPersonas = () => {
  const [personas, setPersonas] = useState<CRMPersona[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchPersonas = useCallback(async () => {
    if (!user || !tenant) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_personas')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error('Error fetching personas:', error);
      toast.error('Failed to load personas');
    } finally {
      setLoading(false);
    }
  }, [user, tenant]);

  const createPersona = useCallback(async (personaData: { name: string; description?: string }) => {
    if (!user || !tenant) return false;

    try {
      const { data, error } = await supabase
        .from('crm_personas')
        .insert({
          persona_name: personaData.name,
          persona_description: personaData.description,
          tenant_id: tenant.id,
          user_id: user.id,
          is_custom: true
        })
        .select()
        .single();

      if (error) throw error;
      
      // Add the new persona to the list
      setPersonas(prev => [data, ...prev]);
      toast.success('Persona created successfully');
      return true;
    } catch (error) {
      console.error('Error creating persona:', error);
      toast.error('Failed to create persona');
      return false;
    }
  }, [user, tenant]);

  const deletePersona = useCallback(async (personaId: string) => {
    if (!user || !tenant) return false;

    try {
      const { error } = await supabase
        .from('crm_personas')
        .delete()
        .eq('id', personaId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      
      // Remove the persona from the list
      setPersonas(prev => prev.filter(persona => persona.id !== personaId));
      toast.success('Persona deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting persona:', error);
      toast.error('Failed to delete persona');
      return false;
    }
  }, [user, tenant]);

  // Filter personas based on search term
  const filteredPersonas = personas.filter(persona =>
    persona.persona_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    persona.persona_description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  return {
    personas: filteredPersonas,
    loading,
    searchTerm,
    setSearchTerm,
    fetchPersonas,
    createPersona,
    deletePersona
  };
};