import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Sparkles } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  description: string;
  buying_triggers: string[];
  ideal_products: string[];
  icon: string;
  color_theme: string;
}

interface PersonaSegmentTemplatesProps {
  personas: Persona[];
  onSelectPersona: (persona: Persona) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function PersonaSegmentTemplates({ 
  personas, 
  onSelectPersona, 
  isOpen, 
  onClose 
}: PersonaSegmentTemplatesProps) {
  if (!isOpen) return null;

  const generateSegmentConditions = (persona: Persona) => {
    return [
      {
        field: 'persona_id',
        operator: 'equals',
        value: persona.id,
        logic: 'AND' as const
      }
    ];
  };

  const handleSelectPersona = (persona: Persona) => {
    onSelectPersona(persona);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Start with a Persona
              </h2>
              <p className="text-muted-foreground mt-1">
                Choose a persona to automatically create a targeted segment
              </p>
            </div>
            <Button variant="ghost" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {personas.map((persona) => (
              <Card 
                key={persona.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50"
                onClick={() => handleSelectPersona(persona)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: persona.color_theme + '20' }}
                    >
                      {persona.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{persona.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {persona.description.slice(0, 80)}...
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Buying Triggers:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {persona.buying_triggers.slice(0, 3).map((trigger, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
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
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Ideal Products:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {persona.ideal_products.slice(0, 2).map((product, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {product}
                          </Badge>
                        ))}
                        {persona.ideal_products.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{persona.ideal_products.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button 
                      className="w-full mt-4"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPersona(persona);
                      }}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Create Segment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {personas.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No personas available</h3>
              <p className="text-muted-foreground">
                Personas will be available once they're set up in your system.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}