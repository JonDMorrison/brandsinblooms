import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";

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

  const { data: customerInfo } = useQuery({
    queryKey: ["customer-basic", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_customers")
        .select("id, first_name, last_name, email")
        .eq("id", customerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const customerName =
    `${customerInfo?.first_name ?? ""} ${customerInfo?.last_name ?? ""}`.trim() ||
    customerInfo?.email ||
    "Customer";

  // Fetch assigned personas for this customer
  const {
    data: assignments = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["customer-personas", customerId, tenant?.id],
    enabled: !!customerId && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_personas")
        .select(
          `
          id,
          persona_id,
          predefined_persona_id
        `,
        )
        .eq("customer_id", customerId);

      if (error) throw error;
      return data as PersonaAssignment[];
    },
  });

  // Get list of assigned persona IDs (both predefined and custom)
  const assignedPersonaIds = assignments
    .map((a) => a.predefined_persona_id || a.persona_id)
    .filter(Boolean);

  const assignPersona = async (personaId: string, isCustom: boolean) => {
    if (!user || !tenant?.id) return false;

    try {
      // Check if this persona is already assigned
      const existingAssignment = assignments.find((assignment) =>
        isCustom
          ? assignment.persona_id === personaId
          : assignment.predefined_persona_id === personaId,
      );

      if (existingAssignment) {
        return true; // Return success since the persona is already assigned
      }

      const insertData = {
        customer_id: customerId,
        ...(isCustom
          ? { persona_id: personaId, predefined_persona_id: null }
          : { predefined_persona_id: personaId, persona_id: null }),
      };
      const { data, error } = await supabase
        .from("customer_personas")
        .insert(insertData)
        .select();

      if (error) {
        // Check if it's a unique constraint violation
        if (error.code === "23505") {
          // Unique violation error code
          return true; // Return success since the persona is effectively assigned
        }
        console.error("❌ Database error:", error);
        throw error;
      }
      if (tenant?.id) {
        await logActivity({
          tenantId: tenant.id,
          customerId,
          actorType: "user",
          actorId: user?.id ?? null,
          source: "ui",
          activityType: "persona.assigned",
          status: "success",
          title: "Persona assigned",
          description: {
            parts: [
              {
                type: "text",
                text: isCustom ? "Custom persona assigned" : "Persona assigned",
              },
            ],
          },
          metadata: {
            persona_id: personaId,
            is_custom: isCustom,
            customer_name: customerName,
            customer_first_name: customerInfo?.first_name ?? null,
            customer_last_name: customerInfo?.last_name ?? null,
          },
          relatedEntities: {
            customer_id: customerId,
            persona_id: personaId,
          },
        });
      }
      await refetch();
      return true;
    } catch (error) {
      console.error("❌ Error assigning persona:", error);
      toast({
        title: "Error",
        description: "Failed to assign persona to customer.",
        variant: "destructive",
      });
      return false;
    }
  };

  const unassignPersona = async (personaId: string, isCustom: boolean) => {
    if (!user || !tenant?.id) return false;

    try {
      const query = supabase
        .from("customer_personas")
        .delete()
        .eq("customer_id", customerId);

      if (isCustom) {
        query.eq("persona_id", personaId);
      } else {
        query.eq("predefined_persona_id", personaId);
      }

      const { error } = await query;
      if (error) throw error;

      if (tenant?.id) {
        await logActivity({
          tenantId: tenant.id,
          customerId,
          actorType: "user",
          actorId: user?.id ?? null,
          source: "ui",
          activityType: "persona.removed",
          status: "success",
          title: "Persona removed",
          description: {
            parts: [
              {
                type: "text",
                text: isCustom ? "Custom persona removed" : "Persona removed",
              },
            ],
          },
          metadata: {
            persona_id: personaId,
            is_custom: isCustom,
            customer_name: customerName,
            customer_first_name: customerInfo?.first_name ?? null,
            customer_last_name: customerInfo?.last_name ?? null,
          },
          relatedEntities: {
            customer_id: customerId,
            persona_id: personaId,
          },
        });
      }

      await refetch();
      return true;
    } catch (error) {
      console.error("Error unassigning persona:", error);
      toast({
        title: "Error",
        description: "Failed to remove persona from customer.",
        variant: "destructive",
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
    isPersonaAssigned,
  };
};
