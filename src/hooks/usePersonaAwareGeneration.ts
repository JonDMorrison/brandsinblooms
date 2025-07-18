import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Persona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

export const usePersonaAwareGeneration = () => {
  const [selectedPersonas, setSelectedPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);

  const generatePersonaAwareContent = async (
    functionName: string,
    basePayload: any
  ) => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke(functionName, {
        body: {
          ...basePayload,
          personas: selectedPersonas
        }
      });

      if (response.error) throw response.error;
      return response.data;
    } catch (error) {
      console.error(`Error generating content with ${functionName}:`, error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const generateStructuredNewsletter = (payload: any) => 
    generatePersonaAwareContent('generate-structured-newsletter', payload);

  const generateEmailContent = (payload: any) => 
    generatePersonaAwareContent('generate-email-content', payload);

  const generateSubjectLines = (payload: any) => 
    generatePersonaAwareContent('generate-subject-lines', payload);

  return {
    selectedPersonas,
    setSelectedPersonas,
    loading,
    generateStructuredNewsletter,
    generateEmailContent,
    generateSubjectLines,
    generatePersonaAwareContent
  };
};