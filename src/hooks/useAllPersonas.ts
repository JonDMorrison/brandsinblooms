import { useMemo } from "react";
import {
  normalizePersonaMetadata,
  SYSTEM_PERSONAS,
  type PersonaRecord,
} from "@/config/systemPersonas";
import { useCRMPersonas } from "./useCRMPersonas";

export type UnifiedPersona = PersonaRecord;

export const useAllPersonas = () => {
  const crmPersonas = useCRMPersonas();

  const personas = useMemo<UnifiedPersona[]>(() => {
    return [...SYSTEM_PERSONAS, ...crmPersonas.allPersonas].map((persona) => ({
      ...persona,
      metadata: normalizePersonaMetadata(persona.metadata),
    }));
  }, [crmPersonas.allPersonas]);

  return {
    ...crmPersonas,
    personas,
    predefinedPersonas: SYSTEM_PERSONAS,
    customPersonas: crmPersonas.allPersonas,
  };
};
