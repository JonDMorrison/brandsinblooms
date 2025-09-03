import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Users, Target, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useSegmentSelector } from '@/hooks/useSegmentSelector';
import { usePersonaAwareGeneration } from '@/hooks/usePersonaAwareGeneration';
import { usePlanWizard } from './PlanWizardContext';

interface AudienceTargetingSectionProps {
  onSelectionChange?: (selection: {
    target: 'all' | 'segments' | 'personas';
    segmentIds?: string[];
    personaIds?: string[];
  }) => void;
}

export const AudienceTargetingSection: React.FC<AudienceTargetingSectionProps> = ({
  onSelectionChange
}) => {
  const { state, updateItem } = usePlanWizard();
  const [targetType, setTargetType] = useState<'all' | 'segments' | 'personas'>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    selectedSegments,
    openModal: openSegmentModal,
    hasSegments,
    clearSegments
  } = useSegmentSelector({
    onSegmentsSelected: (segments) => {
      const segmentIds = segments.map(s => s.id);
      handleSelectionChange('segments', segmentIds, []);
    }
  });

  const {
    selectedPersonas,
    setSelectedPersonas
  } = usePersonaAwareGeneration();

  const handleSelectionChange = (
    target: 'all' | 'segments' | 'personas',
    segmentIds: string[] = [],
    personaIds: string[] = []
  ) => {
    setTargetType(target);
    
    // Update all email items with audience targeting
    const emailItems = state.items.filter(item => item.type === 'email');
    emailItems.forEach(item => {
      updateItem(item.id, {
        audienceTarget: target,
        selectedSegmentIds: segmentIds,
        selectedPersonaIds: personaIds
      });
    });

    onSelectionChange?.({ target, segmentIds, personaIds });
  };

  const handlePersonaSelection = (personas: any[]) => {
    setSelectedPersonas(personas);
    const personaIds = personas.map(p => p.id);
    handleSelectionChange('personas', [], personaIds);
  };

  const emailCount = state.items.filter(item => item.type === 'email').length;

  return (
    <Card className="border-accent/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Audience Targeting</CardTitle>
            <Badge variant="outline" className="text-xs">
              {emailCount} emails
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Choose who will receive your email campaigns
        </p>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          <RadioGroup 
            value={targetType} 
            onValueChange={(value) => handleSelectionChange(value as any)}
            className="space-y-3"
          >
            {/* Send to All */}
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background/50">
              <RadioGroupItem value="all" id="all" />
              <div className="flex-1">
                <Label htmlFor="all" className="flex items-center gap-2 cursor-pointer">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Send to All Customers</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Broadcast to your entire customer base
                </p>
              </div>
            </div>

            {/* Target Segments */}
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background/50">
              <RadioGroupItem value="segments" id="segments" />
              <div className="flex-1">
                <Label htmlFor="segments" className="flex items-center gap-2 cursor-pointer">
                  <Users className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Target Segments</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Send to specific customer segments
                </p>
                {targetType === 'segments' && (
                  <div className="mt-2 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openSegmentModal}
                      className="h-8 text-xs"
                    >
                      {hasSegments ? 'Change Segments' : 'Select Segments'}
                    </Button>
                    {hasSegments && (
                      <div className="flex flex-wrap gap-1">
                        {selectedSegments.map(segment => (
                          <Badge key={segment.id} variant="secondary" className="text-xs">
                            {segment.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Target Personas */}
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background/50">
              <RadioGroupItem value="personas" id="personas" />
              <div className="flex-1">
                <Label htmlFor="personas" className="flex items-center gap-2 cursor-pointer">
                  <Target className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">Target Personas</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Send to customers matching specific personas
                </p>
                {targetType === 'personas' && (
                  <div className="mt-2 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // TODO: Open persona selector
                        console.log('Open persona selector');
                      }}
                      className="h-8 text-xs"
                    >
                      {selectedPersonas.length > 0 ? 'Change Personas' : 'Select Personas'}
                    </Button>
                    {selectedPersonas.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedPersonas.map(persona => (
                          <Badge key={persona.id} variant="secondary" className="text-xs">
                            {persona.persona_name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>

          {/* Summary */}
          <div className="pt-3 border-t">
            <div className="text-sm text-muted-foreground">
              <strong>Target:</strong>{' '}
              {targetType === 'all' && 'All customers'}
              {targetType === 'segments' && hasSegments && `${selectedSegments.length} segment${selectedSegments.length !== 1 ? 's' : ''}`}
              {targetType === 'segments' && !hasSegments && 'No segments selected'}
              {targetType === 'personas' && selectedPersonas.length > 0 && `${selectedPersonas.length} persona${selectedPersonas.length !== 1 ? 's' : ''}`}
              {targetType === 'personas' && selectedPersonas.length === 0 && 'No personas selected'}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};