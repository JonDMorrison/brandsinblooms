import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  buildPersonaNameIndex,
  resolveCustomerPersonaIds,
  type PersonaAssignmentLike,
  type PersonaCustomerLike,
} from "@/lib/personaUtils";

export interface CRMCustomer extends PersonaCustomerLike {
  email: string;
  phone?: string | null;
  created_at: string;
  assigned_persona_ids: string[];
  assigned_personas: Array<{
    id: string;
    persona_name: string;
    is_custom: boolean;
  }>;
  customer_personas?: PersonaAssignmentLike[] | null;
}

export const useCRMCustomers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { personas, loading: personasLoading } = useAllPersonas();
  const queryClient = useQueryClient();

  const personaNameIndex = useMemo(
    () => buildPersonaNameIndex(personas),
    [personas],
  );

  const customersQuery = useQuery({
    queryKey: ["crm-customers-persona-assignments", tenant?.id],
    enabled: Boolean(user?.id && tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as PersonaCustomerLike[];
      }

      const { data, error } = await supabase
        .from("crm_customers")
        .select(
          `
          id,
          email,
          first_name,
          last_name,
          phone,
          persona,
          persona_id,
          created_at,
          total_spent,
          lifetime_value,
          last_purchase_date,
          preferred_channel,
          email_engagement_score,
          total_emails_opened,
          total_emails_clicked,
          total_emails_sent,
          customer_personas(
            persona_id,
            predefined_persona_id
          )
        `,
        )
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        throw error;
      }

      return (data ?? []) as PersonaCustomerLike[];
    },
  });

  const customers = useMemo(() => {
    return (customersQuery.data ?? []).map((customer) => {
      const assignedPersonaIds = resolveCustomerPersonaIds(
        customer,
        personaNameIndex,
      );

      return {
        ...(customer as CRMCustomer),
        email: String(customer.email ?? ""),
        created_at: String(customer.created_at ?? ""),
        assigned_persona_ids: assignedPersonaIds,
        assigned_personas: assignedPersonaIds
          .map((personaId) =>
            personas.find((persona) => persona.id === personaId),
          )
          .filter(Boolean)
          .map((persona) => ({
            id: String(persona?.id),
            persona_name: String(persona?.persona_name),
            is_custom: Boolean(persona?.is_custom),
          })),
      };
    });
  }, [customersQuery.data, personaNameIndex, personas]);

  const refreshCustomers = useCallback(async () => {
    await Promise.all([
      customersQuery.refetch(),
      queryClient.invalidateQueries({
        queryKey: ["persona-customer-counts-source", tenant?.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["activity-feed"] }),
    ]);
  }, [customersQuery, queryClient, tenant?.id]);

  const assignPersonaToCustomer = async (
    customerId: string,
    personaId: string,
  ): Promise<boolean> => {
    if (!user?.id || !tenant?.id) {
      return false;
    }

    const persona = personas.find((item) => item.id === personaId);
    if (!persona) {
      return false;
    }

    try {
      const { error } = await supabase.from("customer_personas").insert(
        persona.is_custom
          ? {
              customer_id: customerId,
              persona_id: personaId,
            }
          : {
              customer_id: customerId,
              predefined_persona_id: personaId,
            },
      );

      if (error && error.code !== "23505") {
        throw error;
      }

      const customer = customers.find((item) => item.id === customerId);
      const existingAssignments = customer?.assigned_persona_ids ?? [];

      if (existingAssignments.length === 0) {
        const { error: legacyError } = await supabase
          .from("crm_customers")
          .update({
            persona: persona.persona_name,
            persona_id: persona.id,
            persona_assignment_method: "manual",
            updated_at: new Date().toISOString(),
          })
          .eq("id", customerId)
          .eq("tenant_id", tenant.id);

        if (legacyError) {
          throw legacyError;
        }
      }

      await refreshCustomers();

      return true;
    } catch (error) {
      console.error("Error assigning persona to customer:", error);
      return false;
    }
  };

  const removeSpecificPersonaFromCustomer = async (
    customerId: string,
    personaId: string,
  ): Promise<boolean> => {
    if (!user?.id || !tenant?.id) {
      return false;
    }

    const persona = personas.find((item) => item.id === personaId);
    if (!persona) {
      return false;
    }

    try {
      const deleteQuery = supabase
        .from("customer_personas")
        .delete()
        .eq("customer_id", customerId);

      if (persona.is_custom) {
        deleteQuery.eq("persona_id", personaId);
      } else {
        deleteQuery.eq("predefined_persona_id", personaId);
      }

      const { error } = await deleteQuery;
      if (error) {
        throw error;
      }

      const customer = customers.find((item) => item.id === customerId);
      const remainingPersonaIds = (customer?.assigned_persona_ids ?? []).filter(
        (assignedId) => assignedId !== personaId,
      );
      const nextPrimaryPersona = personas.find(
        (item) => item.id === remainingPersonaIds[0],
      );

      const { error: legacyError } = await supabase
        .from("crm_customers")
        .update({
          persona: nextPrimaryPersona?.persona_name ?? null,
          persona_id: nextPrimaryPersona?.id ?? null,
          persona_assignment_method: nextPrimaryPersona ? "manual" : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId)
        .eq("tenant_id", tenant.id);

      if (legacyError) {
        throw legacyError;
      }

      await refreshCustomers();
      return true;
    } catch (error) {
      console.error("Error removing persona from customer:", error);
      return false;
    }
  };

  const removePersonaFromCustomer = async (
    customerId: string,
  ): Promise<boolean> => {
    if (!user?.id || !tenant?.id) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("customer_personas")
        .delete()
        .eq("customer_id", customerId);

      if (error) throw error;

      const { error: legacyError } = await supabase
        .from("crm_customers")
        .update({
          persona: null,
          persona_id: null,
          persona_assignment_method: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId)
        .eq("tenant_id", tenant.id);

      if (legacyError) {
        throw legacyError;
      }

      await refreshCustomers();

      return true;
    } catch (error) {
      console.error("Error removing persona from customer:", error);
      return false;
    }
  };

  const getCustomersByPersona = (personaId: string) => {
    return customers.filter((customer) => {
      return customer.assigned_persona_ids.includes(personaId);
    });
  };

  const getUnassignedCustomers = () => {
    return customers.filter((customer) => {
      return customer.assigned_persona_ids.length === 0;
    });
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.last_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return {
    customers: filteredCustomers,
    loading: customersQuery.isLoading || personasLoading,
    searchTerm,
    setSearchTerm,
    fetchCustomers: refreshCustomers,
    assignPersonaToCustomer,
    removePersonaFromCustomer,
    removeSpecificPersonaFromCustomer,
    getCustomersByPersona,
    getUnassignedCustomers,
  };
};
