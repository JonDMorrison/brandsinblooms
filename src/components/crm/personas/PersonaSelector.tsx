import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PersonaLibrary } from "./PersonaLibrary";
import { PersonaTooltip } from "./PersonaTooltip";
import { User, Edit3, HelpCircle } from "lucide-react";

interface Persona {
  id: string;
  name: string;
  tone: string;
  description: string;
  buying_triggers: string[];
  sample_phrases: string[];
  ideal_products: string[];
  icon: string;
  color_theme: string;
}

interface PersonaSelectorProps {
  value?: string | null;
  onChange?: (personaId: string | null) => void;
  customerId?: string;
  showFullCard?: boolean;
}

export function PersonaSelector({ 
  value, 
  onChange, 
  customerId, 
  showFullCard = false 
}: PersonaSelectorProps) {
  const [showLibrary, setShowLibrary] = useState(false);

  const { data: selectedPersona } = useQuery({
    queryKey: ['persona', value],
    queryFn: async () => {
      if (!value) return null;
      
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('id', value)
        .single();
      
      if (error) throw error;
      return data as Persona;
    },
    enabled: !!value
  });

  const handlePersonaSelect = (persona: Persona) => {
    onChange?.(persona.id);
  };

  const handleRemovePersona = () => {
    onChange?.(null);
  };

  if (showFullCard && selectedPersona) {
    return (
      <>
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                style={{ backgroundColor: selectedPersona.color_theme + '20' }}
              >
                {selectedPersona.icon}
              </div>
              <div>
                <h3 className="font-semibold">{selectedPersona.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedPersona.tone}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowLibrary(true)}
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Change
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRemovePersona}
              >
                Remove
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {selectedPersona.description}
          </p>
          
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Buying Triggers:
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedPersona.buying_triggers.slice(0, 4).map((trigger, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {trigger}
                  </Badge>
                ))}
                {selectedPersona.buying_triggers.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{selectedPersona.buying_triggers.length - 4} more
                  </Badge>
                )}
              </div>
            </div>
            
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Sample Messaging:
              </p>
              <p className="text-xs italic text-muted-foreground">
                "{selectedPersona.sample_phrases[0]}"
              </p>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <strong>Example:</strong> Assigning '{selectedPersona.name}' gives you content ideas like{' '}
            {selectedPersona.ideal_products.slice(0, 2).join(', ')} and messaging that resonates 
            with their {selectedPersona.tone} personality.
          </div>
        </div>

        {showLibrary && (
          <PersonaLibrary
            onClose={() => setShowLibrary(false)}
            onPersonaSelect={handlePersonaSelect}
            customerId={customerId}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {selectedPersona ? (
          <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: selectedPersona.color_theme + '20' }}
            >
              {selectedPersona.icon}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{selectedPersona.name}</p>
              <p className="text-xs text-muted-foreground">{selectedPersona.tone}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowLibrary(true)}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Change
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            onClick={() => setShowLibrary(true)}
            className="w-full justify-start"
          >
            <User className="h-4 w-4 mr-2" />
            Assign Persona
          </Button>
        )}
      </div>

      {showLibrary && (
        <PersonaLibrary
          onClose={() => setShowLibrary(false)}
          onPersonaSelect={handlePersonaSelect}
          customerId={customerId}
        />
      )}
    </>
  );
}