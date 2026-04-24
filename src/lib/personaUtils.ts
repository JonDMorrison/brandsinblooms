import { getCustomerEngagementScore } from "@/lib/segmentFields";
import {
  getPersonaMatchCandidates,
  type PersonaRecord,
} from "@/config/systemPersonas";

export interface PersonaAssignmentLike {
  persona_id?: string | null;
  predefined_persona_id?: string | null;
}

export interface PersonaCustomerLike {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  persona?: string | null;
  persona_id?: string | null;
  total_spent?: number | null;
  lifetime_value?: number | null;
  preferred_channel?: string | null;
  email_engagement_score?: number | null;
  total_emails_opened?: number | null;
  total_emails_clicked?: number | null;
  total_emails_sent?: number | null;
  created_at?: string | null;
  last_purchase_date?: string | null;
  customer_personas?: PersonaAssignmentLike[] | null;
}

export function buildPersonaNameIndex(personas: PersonaRecord[]) {
  const nameIndex = new Map<string, string>();

  personas.forEach((persona) => {
    getPersonaMatchCandidates(persona).forEach((candidate) => {
      nameIndex.set(candidate.toLowerCase(), persona.id);
    });
  });

  return nameIndex;
}

export function resolveCustomerPersonaIds(
  customer: PersonaCustomerLike,
  personaNameIndex: Map<string, string>,
) {
  const personaIds = new Set<string>();

  customer.customer_personas?.forEach((assignment) => {
    const assignmentId =
      assignment.persona_id ?? assignment.predefined_persona_id;
    if (assignmentId) {
      personaIds.add(String(assignmentId));
    }
  });

  if (customer.persona_id) {
    personaIds.add(String(customer.persona_id));
  }

  const matchedLegacyPersonaId = customer.persona
    ? personaNameIndex.get(customer.persona.toLowerCase())
    : null;

  if (matchedLegacyPersonaId) {
    personaIds.add(matchedLegacyPersonaId);
  }

  return Array.from(personaIds);
}

export function isCustomerAssignedToPersona(
  customer: PersonaCustomerLike,
  personaId: string,
  personaNameIndex: Map<string, string>,
) {
  return resolveCustomerPersonaIds(customer, personaNameIndex).includes(
    personaId,
  );
}

export function getCustomerLifetimeValue(customer: PersonaCustomerLike) {
  return customer.total_spent ?? customer.lifetime_value ?? 0;
}

export function getPreferredChannel(customer: PersonaCustomerLike) {
  const value = customer.preferred_channel?.trim();
  return value && value.length > 0 ? value : null;
}

export function getCustomerDisplayName(customer: PersonaCustomerLike) {
  const fullName =
    `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
  return fullName || customer.email || "Customer";
}

export function getCustomerPersonaMetrics(customer: PersonaCustomerLike) {
  return {
    engagementScore: getCustomerEngagementScore(customer as never),
    value: getCustomerLifetimeValue(customer),
    preferredChannel: getPreferredChannel(customer),
  };
}
