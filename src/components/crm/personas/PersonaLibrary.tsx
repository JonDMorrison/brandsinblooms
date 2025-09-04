import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface PersonaLibraryProps {
  onClose: () => void;
  onPersonaSelect?: (persona: Persona) => void;
  customerId?: string;
}

export function PersonaLibrary({ onClose, onPersonaSelect, customerId }: PersonaLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ['personas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Persona[];
    }
  });

  const filterTypes = [
    { label: "All", value: null },
    { label: "Beginner", keywords: ["beginner", "easy", "low maintenance"] },
    { label: "Pet-Safe", keywords: ["pet", "safe", "friendly"] },
    { label: "Style-Seeker", keywords: ["style", "design", "trendy", "curb appeal"] },
    { label: "Eco-Conscious", keywords: ["sustainable", "organic", "native", "eco"] },
    { label: "Health & Wellness", keywords: ["wellness", "therapeutic", "health"] }
  ];

  const filteredPersonas = personas.filter(persona => {
    const matchesSearch = searchQuery === "" || 
      persona.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      persona.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      persona.buying_triggers.some(trigger => 
        trigger.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (!selectedType) return matchesSearch;
    
    const typeFilter = filterTypes.find(t => t.label === selectedType);
    if (!typeFilter?.keywords) return matchesSearch;
    
    const matchesType = typeFilter.keywords.some(keyword =>
      persona.buying_triggers.some(trigger => 
        trigger.toLowerCase().includes(keyword.toLowerCase())
      ) ||
      persona.description.toLowerCase().includes(keyword.toLowerCase())
    );

    return matchesSearch && matchesType;
  });

  const handlePersonaSelect = async (persona: Persona) => {
    if (customerId) {
      try {
        const { error } = await supabase
          .from('crm_customers')
          .update({ 
            persona: persona.name,
            persona_id: persona.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', customerId);

        if (error) throw error;

        toast({
          title: "Persona assigned",
          description: `${persona.name} has been assigned to this customer.`,
        });
      } catch (error) {
        console.error('Error assigning persona:', error);
        toast({
          title: "Error",
          description: "Failed to assign persona to customer.",
          variant: "destructive",
        });
        return;
      }
    }

    onPersonaSelect?.(persona);
    onClose();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Customer Personas</h2>
              <p className="text-sm text-muted-foreground">
                Choose a persona to help personalize content and campaigns
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search personas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {filterTypes.map((type) => (
              <Button
                key={type.label}
                variant={selectedType === type.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(type.value)}
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Personas Grid */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 220px)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPersonas.map((persona) => (
              <Card 
                key={persona.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                onClick={() => handlePersonaSelect(persona)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                      style={{ backgroundColor: persona.color_theme + '20' }}
                    >
                      {persona.icon}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{persona.name}</CardTitle>
                      <CardDescription className="text-xs font-medium">
                        {persona.tone}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {persona.description}
                  </p>
                  
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Buying Triggers:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {persona.buying_triggers.slice(0, 3).map((trigger, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {trigger}
                          </Badge>
                        ))}
                        {persona.buying_triggers.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{persona.buying_triggers.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Sample Phrases:
                      </p>
                      <p className="text-xs italic text-muted-foreground">
                        "{persona.sample_phrases[0]}"
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full mt-3" 
                    size="sm"
                    style={{ backgroundColor: persona.color_theme }}
                  >
                    Assign This Persona
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {filteredPersonas.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No personas found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="p-4 bg-muted/50 border-t">
          <p className="text-xs text-muted-foreground text-center">
            <strong>What this does:</strong> Assigning a persona helps personalize content, trigger smarter automations, 
            and unlock AI-generated campaigns tailored to your customers' values and habits.
          </p>
        </div>
      </div>
    </div>
  );
}