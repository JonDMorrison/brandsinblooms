import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";

interface PersonaAssignment {
  id: string;
  persona_id?: string;
  predefined_persona_id?: string;
  persona?: {
    id: string;
    persona_name: string;
    persona_description?: string;
  };
}

export const useCustomerPersonas = (customerId: string) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();

  // Fetch assigned personas for this customer
  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['customer-personas', customerId, tenant?.id],
    enabled: !!customerId && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_personas')
        .select(`
          id,
          persona_id,
          predefined_persona_id,
          crm_personas (
            id,
            persona_name,
            persona_description
          )
        `)
        .eq('customer_id', customerId);
      
      if (error) throw error;
      return data as PersonaAssignment[];
    }
  });

  // Get list of assigned persona IDs (both predefined and custom)
  const assignedPersonaIds = assignments.map(a => 
    a.predefined_persona_id || a.persona_id
  ).filter(Boolean);

  const assignPersona = async (personaId: string, isCustom: boolean) => {
    if (!user || !tenant?.id) return false;

    try {
      const insertData = {
        customer_id: customerId,
        ...(isCustom 
          ? { persona_id: personaId, predefined_persona_id: null }
          : { predefined_persona_id: personaId, persona_id: null }
        )
      };

      const { error } = await supabase
        .from('customer_personas')
        .insert(insertData);

      if (error) throw error;
      
      await refetch();
      return true;
    } catch (error) {
      console.error('Error assigning persona:', error);
      toast({
        title: "Error",
        description: "Failed to assign persona to customer.",
        variant: "destructive"
      });
      return false;
    }
  };

  const unassignPersona = async (personaId: string, isCustom: boolean) => {
    if (!user || !tenant?.id) return false;

    try {
      const query = supabase
        .from('customer_personas')
        .delete()
        .eq('customer_id', customerId);

      if (isCustom) {
        query.eq('persona_id', personaId);
      } else {
        query.eq('predefined_persona_id', personaId);
      }

      const { error } = await query;
      if (error) throw error;
      
      await refetch();
      return true;
    } catch (error) {
      console.error('Error unassigning persona:', error);
      toast({
        title: "Error",
        description: "Failed to remove persona from customer.",
        variant: "destructive"
      });
      return false;
    }
  };

  const isPersonaAssigned = (personaId: string) => {
    return assignedPersonaIds.includes(personaId);
  };

  return {
    assignments,
    assignedPersonaIds,
    isLoading,
    refetch,
    assignPersona,
    unassignPersona,
    isPersonaAssigned
  };
};