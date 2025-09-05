import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  console.log('PersonaLibrary rendering - component active');
  
  useEffect(() => {
    console.log('PersonaLibrary useEffect - component mounted');
    return () => {
      console.log('PersonaLibrary useEffect - component unmounted');
    };
  }, []);

  // Lock background scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // Reset scroll to top when modal opens
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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

  const modalContent = (
    <div 
      className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      style={{ zIndex: 999999 }}
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="persona-library-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card rounded-lg shadow-2xl w-[95vw] sm:w-[90vw] max-w-[1400px] h-[95vh] sm:h-[90vh] flex flex-col overflow-hidden border border-border">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 id="persona-library-title" className="text-lg sm:text-xl font-semibold text-card-foreground">Customer Personas</h2>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Choose a persona to help personalize content and campaigns
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-muted"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="sticky top-[73px] z-10 p-4 sm:p-6 border-b border-border bg-card/95 backdrop-blur-sm flex-shrink-0">
          <div className="space-y-3 sm:space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search personas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {filterTypes.map((type) => (
                <Button
                  key={type.label}
                  variant={selectedType === type.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType(type.value)}
                  className="text-xs sm:text-sm"
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Personas Grid - Scrollable */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredPersonas.map((persona) => (
                <Card 
                  key={persona.id} 
                  className="cursor-pointer hover:shadow-lg transition-all duration-300 border hover:border-primary/30 bg-card hover:bg-accent/5 group"
                  onClick={() => handlePersonaSelect(persona)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-2xl border-2 group-hover:scale-105 transition-transform"
                        style={{ 
                          backgroundColor: `${persona.color_theme}15`,
                          borderColor: `${persona.color_theme}30`
                        }}
                      >
                        {persona.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm sm:text-lg text-card-foreground truncate">{persona.name}</CardTitle>
                        <CardDescription className="text-xs font-medium text-muted-foreground truncate">
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
                      className="w-full mt-3 text-white hover:opacity-90 transition-opacity" 
                      size="sm"
                      style={{ backgroundColor: persona.color_theme }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePersonaSelect(persona);
                      }}
                    >
                      Assign This Persona
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {!isLoading && filteredPersonas.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-card-foreground">No personas found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="sticky bottom-0 p-3 sm:p-4 bg-muted/30 border-t border-border flex-shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            <strong>What this does:</strong> Assigning a persona helps personalize content, trigger smarter automations, 
            and unlock AI-generated campaigns tailored to your customers' values and habits.
          </p>
        </div>
      </div>
    </div>
  );

  console.log('PersonaLibrary - About to render modal');
  
  return createPortal(modalContent, document.body);
}