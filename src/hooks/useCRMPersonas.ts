import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  normalizePersonaMetadata,
  SYSTEM_PERSONAS,
  type PersonaMetadata,
  type PersonaRecord,
} from "@/config/systemPersonas";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

const PERSONA_SELECT_FIELDS =
  "id, persona_name, persona_description, is_custom, created_at, updated_at, tenant_id, user_id, metadata";

export interface CRMPersona extends PersonaRecord {
  created_at: string;
  updated_at: string;
  tenant_id: string;
  user_id: string;
}

export interface PersonaMutationInput {
  name: string;
  description?: string | null;
  metadata?: PersonaMetadata | null;
}

export interface PersonaUpdateInput extends PersonaMutationInput {
  id: string;
}

const normalizeDescription = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const normalizeName = (value: string) => value.trim();

const buildDuplicateName = (baseName: string, existingNames: string[]) => {
  const normalizedNames = new Set(
    existingNames.map((name) => name.toLowerCase()),
  );
  let suffix = 1;
  let candidate = `${baseName} Copy`;

  while (normalizedNames.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${baseName} Copy ${suffix}`;
  }

  return candidate;
};

export const useCRMPersonas = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const queryClient = useQueryClient();

  const personasQuery = useQuery({
    queryKey: ["crm-personas", tenant?.id],
    enabled: Boolean(user?.id && tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as CRMPersona[];
      }

      const { data, error } = await supabase
        .from("crm_personas")
        .select(PERSONA_SELECT_FIELDS)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((persona) => ({
        ...(persona as CRMPersona),
        metadata: normalizePersonaMetadata((persona as any).metadata),
      }));
    },
  });

  const allPersonas = personasQuery.data ?? [];

  const knownPersonaNames = useMemo(() => {
    return [
      ...SYSTEM_PERSONAS.map((persona) => persona.persona_name),
      ...allPersonas.map((persona) => persona.persona_name),
    ];
  }, [allPersonas]);

  const ensureUniquePersonaName = useCallback(
    (name: string, excludeId?: string) => {
      const normalizedName = normalizeName(name).toLowerCase();

      const duplicateSystemPersona = SYSTEM_PERSONAS.some(
        (persona) => persona.persona_name.toLowerCase() === normalizedName,
      );

      const duplicateCustomPersona = allPersonas.some(
        (persona) =>
          persona.id !== excludeId &&
          persona.persona_name.toLowerCase() === normalizedName,
      );

      if (duplicateSystemPersona || duplicateCustomPersona) {
        throw new Error("A persona with this name already exists.");
      }
    },
    [allPersonas],
  );

  const invalidatePersonaQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["crm-personas", tenant?.id] }),
      queryClient.invalidateQueries({
        queryKey: ["persona-customer-counts-source", tenant?.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["crm-customers-persona-assignments", tenant?.id],
      }),
    ]);
  }, [queryClient, tenant?.id]);

  const createPersonaMutation = useMutation({
    mutationFn: async (input: PersonaMutationInput) => {
      if (!user?.id || !tenant?.id) {
        throw new Error("Missing tenant or user context.");
      }

      const name = normalizeName(input.name);
      if (!name) {
        throw new Error("Persona name is required.");
      }

      ensureUniquePersonaName(name);

      const { data, error } = await supabase
        .from("crm_personas")
        .insert({
          persona_name: name,
          persona_description: normalizeDescription(input.description),
          metadata: normalizePersonaMetadata(input.metadata) ?? {},
          tenant_id: tenant.id,
          user_id: user.id,
          is_custom: true,
        } as any)
        .select(PERSONA_SELECT_FIELDS)
        .single();

      if (error) {
        throw error;
      }

      return {
        ...(data as CRMPersona),
        metadata: normalizePersonaMetadata((data as any).metadata),
      };
    },
    onSuccess: async () => {
      await invalidatePersonaQueries();
      toast.success("Persona created successfully.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create persona.",
      );
    },
  });

  const updatePersonaMutation = useMutation({
    mutationFn: async (input: PersonaUpdateInput) => {
      if (!tenant?.id) {
        throw new Error("Missing tenant context.");
      }

      const name = normalizeName(input.name);
      if (!name) {
        throw new Error("Persona name is required.");
      }

      ensureUniquePersonaName(name, input.id);

      const { data, error } = await supabase
        .from("crm_personas")
        .update({
          persona_name: name,
          persona_description: normalizeDescription(input.description),
          metadata: normalizePersonaMetadata(input.metadata) ?? {},
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", input.id)
        .eq("tenant_id", tenant.id)
        .select(PERSONA_SELECT_FIELDS)
        .single();

      if (error) {
        throw error;
      }

      return {
        ...(data as CRMPersona),
        metadata: normalizePersonaMetadata((data as any).metadata),
      };
    },
    onSuccess: async () => {
      await invalidatePersonaQueries();
      toast.success("Persona updated successfully.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update persona.",
      );
    },
  });

  const deletePersonaMutation = useMutation({
    mutationFn: async (personaId: string) => {
      if (!tenant?.id) {
        throw new Error("Missing tenant context.");
      }

      if (SYSTEM_PERSONAS.some((persona) => persona.id === personaId)) {
        throw new Error("System personas cannot be deleted.");
      }

      const [assignmentResult, campaignResult, automationResult] =
        await Promise.all([
          supabase
            .from("customer_personas")
            .delete()
            .eq("persona_id", personaId),
          supabase
            .from("campaign_personas")
            .delete()
            .eq("persona_id", personaId),
          supabase
            .from("automation_personas")
            .delete()
            .eq("persona_id", personaId),
        ]);

      if (assignmentResult.error) {
        throw assignmentResult.error;
      }

      if (campaignResult.error) {
        throw campaignResult.error;
      }

      if (automationResult.error) {
        throw automationResult.error;
      }

      const { error } = await supabase
        .from("crm_personas")
        .delete()
        .eq("id", personaId)
        .eq("tenant_id", tenant.id);

      if (error) {
        throw error;
      }

      return personaId;
    },
    onSuccess: async () => {
      await invalidatePersonaQueries();
      toast.success("Persona deleted successfully.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete persona.",
      );
    },
  });

  const filteredPersonas = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return allPersonas;
    }

    return allPersonas.filter((persona) => {
      const haystack = [persona.persona_name, persona.persona_description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [allPersonas, searchTerm]);

  const fetchPersonas = useCallback(async () => {
    await personasQuery.refetch();
  }, [personasQuery]);

  const createPersona = useCallback(
    async (input: PersonaMutationInput) => {
      try {
        return await createPersonaMutation.mutateAsync(input);
      } catch {
        return null;
      }
    },
    [createPersonaMutation],
  );

  const updatePersona = useCallback(
    async (input: PersonaUpdateInput) => {
      try {
        return await updatePersonaMutation.mutateAsync(input);
      } catch {
        return null;
      }
    },
    [updatePersonaMutation],
  );

  const duplicatePersona = useCallback(
    async (persona: CRMPersona) => {
      const duplicateName = buildDuplicateName(
        persona.persona_name,
        knownPersonaNames,
      );

      return createPersona({
        name: duplicateName,
        description: persona.persona_description,
        metadata: normalizePersonaMetadata(persona.metadata),
      });
    },
    [createPersona, knownPersonaNames],
  );

  const deletePersona = useCallback(
    async (personaId: string) => {
      try {
        await deletePersonaMutation.mutateAsync(personaId);
        return true;
      } catch {
        return false;
      }
    },
    [deletePersonaMutation],
  );

  return {
    personas: filteredPersonas,
    allPersonas,
    loading: authLoading || tenantLoading || personasQuery.isLoading,
    searchTerm,
    setSearchTerm,
    fetchPersonas,
    createPersona,
    updatePersona,
    duplicatePersona,
    deletePersona,
    isCreating: createPersonaMutation.isPending,
    isUpdating: updatePersonaMutation.isPending,
    isDeleting: deletePersonaMutation.isPending,
  };
};
