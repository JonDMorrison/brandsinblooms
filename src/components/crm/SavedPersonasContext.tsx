import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Persona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

interface SavedPersonasContextType {
  personas: Persona[];
  loading: boolean;
  addPersona: (persona: Persona) => void;
  removePersona: (personaId: string) => void;
  refreshPersonas: () => Promise<void>;
}

const SavedPersonasContext = createContext<SavedPersonasContextType | undefined>(undefined);

export const SavedPersonasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPersonas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("crm_personas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error("Error fetching personas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  const addPersona = (persona: Persona) => {
    setPersonas(prev => [persona, ...prev]);
  };

  const removePersona = (personaId: string) => {
    setPersonas(prev => prev.filter(p => p.id !== personaId));
  };

  const refreshPersonas = async () => {
    await fetchPersonas();
  };

  return (
    <SavedPersonasContext.Provider value={{
      personas,
      loading,
      addPersona,
      removePersona,
      refreshPersonas
    }}>
      {children}
    </SavedPersonasContext.Provider>
  );
};

export const useSavedPersonas = () => {
  const context = useContext(SavedPersonasContext);
  if (context === undefined) {
    throw new Error("useSavedPersonas must be used within a SavedPersonasProvider");
  }
  return context;
};