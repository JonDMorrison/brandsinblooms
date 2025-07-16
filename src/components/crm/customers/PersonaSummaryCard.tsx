import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, User } from "lucide-react";

interface Persona {
  id: string;
  name: string;
  description: string;
  tone: string;
  icon: string;
  color_theme: string;
  buying_triggers: string[];
  ideal_products: string[];
}

interface PersonaSummaryCardProps {
  persona?: Persona;
  onAssignClick: () => void;
  loading?: boolean;
  confidenceScore?: number;
  assignmentMethod?: string;
}

export const PersonaSummaryCard = ({ persona, onAssignClick, loading, confidenceScore, assignmentMethod }: PersonaSummaryCardProps) => {
  if (!persona) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <User className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Persona Assigned</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Assign a persona to personalize marketing and communication for this customer.
          </p>
          <Button onClick={onAssignClick} disabled={loading}>
            Assign Persona
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={{ borderColor: persona.color_theme + "40" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{persona.icon}</span>
            <div>
            <span className="text-lg">{persona.name}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground ml-2 inline" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>This persona helps tailor messaging based on the customer's gardening interests and experience level.</p>
                  {assignmentMethod === 'pos_auto' && (
                    <p className="mt-1 text-xs">Auto-assigned via POS purchase pattern</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {assignmentMethod === 'pos_auto' && (
              <Badge variant="outline" className="ml-2 text-xs">
                Auto-assigned
              </Badge>
            )}
            {confidenceScore && confidenceScore < 1.0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {Math.round(confidenceScore * 100)}% confidence
              </Badge>
            )}
          </div>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onAssignClick} disabled={loading}>
          Change
        </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Tone:</p>
          <p className="text-sm italic" style={{ color: persona.color_theme }}>
            {persona.tone}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {persona.description}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Key Interests:</p>
          <div className="flex flex-wrap gap-1">
            {persona.buying_triggers.slice(0, 4).map(trigger => (
              <Badge key={trigger} variant="secondary" className="text-xs">
                {trigger}
              </Badge>
            ))}
            {persona.buying_triggers.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{persona.buying_triggers.length - 4} more
              </Badge>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Ideal Products:</p>
          <div className="flex flex-wrap gap-1">
            {persona.ideal_products.slice(0, 3).map(product => (
              <Badge 
                key={product} 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: persona.color_theme }}
              >
                {product}
              </Badge>
            ))}
            {persona.ideal_products.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{persona.ideal_products.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};