import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TargetingPersona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

export interface TargetingSegment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
  type: "predefined" | "custom";
}

export interface AutomationTargetingPayload {
  personas: TargetingPersona[];
  segments: TargetingSegment[];
}

type SaveAutomationTargetingArgs = AutomationTargetingPayload & {
  automationId: string;
};

type SegmentTargetingCondition = {
  type: "segment";
  segment_id: string;
  segment_name?: string;
};

function isDuplicateError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("duplicate") === true
  );
}

async function resolveSegments(segmentIds: string[]) {
  if (segmentIds.length === 0) {
    return [] as TargetingSegment[];
  }

  const [crmSegmentsResult, customSegmentsResult] = await Promise.all([
    supabase
      .from("crm_segments")
      .select("id, name, description, customer_count")
      .in("id", segmentIds),
    supabase
      .from("custom_segments")
      .select("id, name, customer_count")
      .in("id", segmentIds),
  ]);

  if (crmSegmentsResult.error) {
    throw crmSegmentsResult.error;
  }

  if (customSegmentsResult.error) {
    throw customSegmentsResult.error;
  }

  const segmentMap = new Map<string, TargetingSegment>();

  for (const segment of crmSegmentsResult.data ?? []) {
    segmentMap.set(String(segment.id), {
      id: String(segment.id),
      name: String(segment.name),
      description: segment.description ?? undefined,
      customer_count: Number(segment.customer_count ?? 0),
      type: "predefined",
    });
  }

  for (const segment of customSegmentsResult.data ?? []) {
    segmentMap.set(String(segment.id), {
      id: String(segment.id),
      name: String(segment.name),
      description: undefined,
      customer_count: Number(segment.customer_count ?? 0),
      type: "custom",
    });
  }

  return segmentIds
    .map((segmentId) => segmentMap.get(segmentId))
    .filter(Boolean) as TargetingSegment[];
}

export const usePersonaSegmentIntegration = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const saveAutomationTargeting = useCallback(
    async ({
      automationId,
      personas,
      segments,
    }: SaveAutomationTargetingArgs) => {
      if (!automationId) {
        return;
      }

      try {
        setLoading(true);

        const personaTargeting = {
          persona_ids: personas.map((persona) => persona.id),
          conditions: segments.map(
            (segment) =>
              ({
                type: "segment",
                segment_id: segment.id,
                segment_name: segment.name,
              }) satisfies SegmentTargetingCondition,
          ),
        };

        const { error: automationError } = await supabase
          .from("crm_automations")
          .update({ persona_targeting: personaTargeting })
          .eq("id", automationId);

        if (automationError) {
          throw automationError;
        }

        const { error: deleteError } = await supabase
          .from("automation_personas")
          .delete()
          .eq("automation_id", automationId);

        if (deleteError) {
          throw deleteError;
        }

        if (personas.length > 0) {
          const { error: insertError } = await supabase
            .from("automation_personas")
            .insert(
              personas.map((persona) => ({
                automation_id: automationId,
                persona_id: persona.id,
              })),
            );

          if (insertError && !isDuplicateError(insertError)) {
            throw insertError;
          }
        }
      } catch (error) {
        console.error("Error saving automation targeting:", error);
        toast({
          title: "Error",
          description: "Failed to save automation targeting preferences.",
          variant: "destructive",
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const loadAutomationTargeting = useCallback(async (automationId: string) => {
    if (!automationId) {
      return {
        personas: [] as TargetingPersona[],
        segments: [] as TargetingSegment[],
      };
    }

    try {
      setLoading(true);

      const [
        { data: automationRow, error: automationError },
        { data: automationPersonas, error: personaLinkError },
      ] = await Promise.all([
        supabase
          .from("crm_automations")
          .select("persona_targeting")
          .eq("id", automationId)
          .single(),
        supabase
          .from("automation_personas")
          .select("persona_id")
          .eq("automation_id", automationId),
      ]);

      if (automationError) {
        throw automationError;
      }

      if (personaLinkError) {
        throw personaLinkError;
      }

      const targeting = (automationRow?.persona_targeting ?? {}) as {
        persona_ids?: string[];
        conditions?: SegmentTargetingCondition[];
      };

      const personaIds = Array.from(
        new Set([
          ...(targeting.persona_ids ?? []),
          ...(automationPersonas ?? []).map((record) =>
            String(record.persona_id),
          ),
        ]),
      ).filter(Boolean);

      const segmentIds = Array.from(
        new Set(
          (targeting.conditions ?? [])
            .filter((condition) => condition?.type === "segment")
            .map((condition) => String(condition.segment_id)),
        ),
      ).filter(Boolean);

      const [personaDetailsResult, segments] = await Promise.all([
        personaIds.length > 0
          ? supabase
              .from("crm_personas")
              .select("id, persona_name, persona_description, is_custom")
              .in("id", personaIds)
          : Promise.resolve({ data: [] as TargetingPersona[], error: null }),
        resolveSegments(segmentIds),
      ]);

      if (personaDetailsResult.error) {
        throw personaDetailsResult.error;
      }

      return {
        personas: (personaDetailsResult.data ?? []).map((persona) => ({
          id: String(persona.id),
          persona_name: String(persona.persona_name),
          persona_description: persona.persona_description ?? undefined,
          is_custom: Boolean(persona.is_custom),
        })),
        segments,
      } satisfies AutomationTargetingPayload;
    } catch (error) {
      console.error("Error loading automation targeting:", error);
      return {
        personas: [] as TargetingPersona[],
        segments: [] as TargetingSegment[],
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    saveAutomationTargeting,
    loadAutomationTargeting,
  };
};
