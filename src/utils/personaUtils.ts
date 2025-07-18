interface Persona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

export const formatPersonasForPrompt = (personas: Persona[]): string => {
  if (!personas || personas.length === 0) {
    return "general garden center customers interested in plants, gardening supplies, and outdoor living";
  }

  const personaNames = personas.map(p => p.persona_name);
  
  if (personaNames.length === 1) {
    return personaNames[0];
  } else if (personaNames.length === 2) {
    return `${personaNames[0]} and ${personaNames[1]}`;
  } else {
    const allButLast = personaNames.slice(0, -1).join(", ");
    const last = personaNames[personaNames.length - 1];
    return `${allButLast}, and ${last}`;
  }
};

export const buildPersonaAwarePrompt = (basePrompt: string, personas: Persona[]): string => {
  const formattedPersonas = formatPersonasForPrompt(personas);
  
  const personaContext = `\n\nAudience insights: This campaign is targeted toward the following customer personas: ${formattedPersonas}. Write with empathy and clarity to resonate with these profiles. Ensure relevance, tone, and examples match their goals and challenges.`;
  
  return basePrompt + personaContext;
};

export const getPersonaDisplayText = (personas: Persona[]): string => {
  if (!personas || personas.length === 0) {
    return "General audience";
  }
  
  return `Crafted for: ${formatPersonasForPrompt(personas)}`;
};