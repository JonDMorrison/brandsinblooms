import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Check, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Persona {
  id: string;
  name: string;
  description: string;
  tone: string;
  icon: string;
  color_theme: string;
  buying_triggers: string[];
  sample_phrases: string[];
  ideal_products: string[];
}

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  currentPersonaId?: string;
  onPersonaSelect?: (persona: Persona) => void;
  mode?: "assign" | "view" | "select";
  title?: string;
}

export const PersonaModal = ({
  isOpen,
  onClose,
  customerId,
  currentPersonaId,
  onPersonaSelect,
  mode = "assign",
  title
}: PersonaModalProps) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchPersonas();
    }
  }, [isOpen]);

  const fetchPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .order("name");

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error("Error fetching personas:", error);
      toast({
        title: "Error",
        description: "Failed to load personas. Please try again.",
        variant: "destructive",
      });
    }
  };

  const assignPersona = async (persona: Persona) => {
    if (!customerId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("crm_customers")
        .update({ 
          persona_id: persona.id,
          persona: persona.name 
        })
        .eq("id", customerId);

      if (error) throw error;

      toast({
        title: "Persona Assigned",
        description: `${persona.name} ${persona.icon} has been assigned to this customer`,
      });

      onClose();
    } catch (error) {
      console.error("Error assigning persona:", error);
      toast({
        title: "Error",
        description: "Failed to assign persona. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaAction = (persona: Persona) => {
    if (mode === "assign" && customerId) {
      assignPersona(persona);
    } else if (onPersonaSelect) {
      onPersonaSelect(persona);
      onClose();
    }
  };

  // Extract all unique tags from personas
  const allTags = Array.from(
    new Set(
      personas.flatMap(p => [
        ...p.buying_triggers,
        ...p.ideal_products
      ])
    )
  ).slice(0, 8); // Limit to most common tags

  const filteredPersonas = personas.filter(persona => {
    const matchesSearch = persona.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      persona.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      persona.tone.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = selectedFilter === "all" || 
      persona.buying_triggers.some(trigger => trigger.toLowerCase().includes(selectedFilter.toLowerCase())) ||
      persona.ideal_products.some(product => product.toLowerCase().includes(selectedFilter.toLowerCase()));

    return matchesSearch && matchesFilter;
  });

  const getModalTitle = () => {
    if (title) return title;
    if (mode === "assign") return "Assign Customer Persona";
    if (mode === "select") return "Choose Persona";
    return "Customer Personas";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getModalTitle()}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Personas help tailor messaging and marketing based on customer gardening preferences and experience levels.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search personas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter("all")}
            >
              All
            </Button>
            {allTags.map(tag => (
              <Button
                key={tag}
                variant={selectedFilter === tag ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>

        {/* Personas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPersonas.map((persona) => (
            <Card 
              key={persona.id} 
              className={`transition-all duration-200 hover:shadow-md hover:scale-105 cursor-pointer ${
                currentPersonaId === persona.id ? "ring-2 ring-primary" : ""
              }`}
              style={{ borderColor: persona.color_theme + "40" }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{persona.icon}</span>
                    <div>
                      <CardTitle className="text-lg leading-tight">{persona.name}</CardTitle>
                      <CardDescription className="text-sm italic">
                        {persona.tone}
                      </CardDescription>
                    </div>
                  </div>
                  {currentPersonaId === persona.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {expandedPersona === persona.id ? persona.description : 
                    persona.description.substring(0, 100) + "..."
                  }
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {persona.buying_triggers.slice(0, 2).map(trigger => (
                    <Badge key={trigger} variant="secondary" className="text-xs">
                      {trigger}
                    </Badge>
                  ))}
                  {persona.buying_triggers.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{persona.buying_triggers.length - 2}
                    </Badge>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  {mode === "assign" && customerId && (
                    <Button
                      size="sm"
                      onClick={() => handlePersonaAction(persona)}
                      disabled={loading}
                      className="flex-1"
                      style={{ backgroundColor: persona.color_theme }}
                    >
                      {currentPersonaId === persona.id ? "Current Persona" : "Assign Persona"}
                    </Button>
                  )}
                  
                  {(mode === "view" || mode === "select") && (
                    <Button
                      size="sm"
                      onClick={() => handlePersonaAction(persona)}
                      disabled={loading}
                      className="flex-1"
                      style={{ backgroundColor: persona.color_theme }}
                    >
                      {mode === "select" ? "Select" : "Choose"}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedPersona(
                      expandedPersona === persona.id ? null : persona.id
                    )}
                  >
                    {expandedPersona === persona.id ? "Less" : "More"}
                  </Button>
                </div>

                {/* Expanded Details */}
                {expandedPersona === persona.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Buying Triggers:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {persona.buying_triggers.map(trigger => (
                          <Badge key={trigger} variant="outline" className="text-xs">
                            {trigger}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Ideal Products:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {persona.ideal_products.slice(0, 3).map(product => (
                          <Badge key={product} variant="secondary" className="text-xs">
                            {product}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPersonas.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No personas found matching your criteria.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};