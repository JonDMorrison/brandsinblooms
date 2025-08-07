import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Target, ChevronDown, Plus } from "lucide-react";
import { AudienceSelector } from './AudienceSelector';

interface Persona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

interface Segment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
  type: 'predefined' | 'custom';
  persona_id?: string;
}

interface AudienceTargetingButtonProps {
  selectedPersonas: Persona[];
  selectedSegments: Segment[];
  onPersonasChange: (personas: Persona[]) => void;
  onSegmentsChange: (segments: Segment[]) => void;
  maxPersonas?: number;
  maxSegments?: number;
}

export const AudienceTargetingButton = forwardRef<
  { openModal: () => void },
  AudienceTargetingButtonProps
>(({
  selectedPersonas,
  selectedSegments,
  onPersonasChange,
  onSegmentsChange,
  maxPersonas = 3,
  maxSegments = 5
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    openModal: () => setIsOpen(true)
  }), []);

  const getTotalAudience = () => {
    if (selectedSegments.length === 0) return "All Contacts";
    const total = selectedSegments.reduce((sum, segment) => sum + segment.customer_count, 0);
    return `${total.toLocaleString()} contacts`;
  };

  const getSelectionSummary = () => {
    const totalSelections = selectedPersonas.length + selectedSegments.length;
    if (totalSelections === 0) return "All Contacts";
    
    const parts = [];
    if (selectedPersonas.length > 0) {
      parts.push(`${selectedPersonas.length} persona${selectedPersonas.length > 1 ? 's' : ''}`);
    }
    if (selectedSegments.length > 0) {
      parts.push(`${selectedSegments.length} segment${selectedSegments.length > 1 ? 's' : ''}`);
    }
    
    return parts.join(', ');
  };

  const hasTargeting = selectedPersonas.length > 0 || selectedSegments.length > 0;

  return (
    <>
      <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Target Audience</span>
              {hasTargeting && (
                <Badge variant="secondary" className="text-xs">
                  {getSelectionSummary()}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {getTotalAudience()}
            </p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-2"
        >
          {hasTargeting ? "Edit" : <Plus className="h-4 w-4" />}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Configure Target Audience
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto">
            <AudienceSelector
              selectedPersonas={selectedPersonas}
              selectedSegments={selectedSegments}
              onPersonasChange={onPersonasChange}
              onSegmentsChange={onSegmentsChange}
              maxPersonas={maxPersonas}
              maxSegments={maxSegments}
              onClose={() => setIsOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

AudienceTargetingButton.displayName = 'AudienceTargetingButton';