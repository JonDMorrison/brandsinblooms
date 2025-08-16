import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { AudienceSelector } from '../AudienceSelector';

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

interface CampaignSetupWizardProps {
  open: boolean;
  onClose: () => void;
  selectedPersonas: Persona[];
  selectedSegments: Segment[];
  onPersonasChange: (personas: Persona[]) => void;
  onSegmentsChange: (segments: Segment[]) => void;
}

type WizardStep = 'basics' | 'audience' | 'review';

export const CampaignSetupWizard = ({
  open,
  onClose,
  selectedPersonas,
  selectedSegments,
  onPersonasChange,
  onSegmentsChange
}: CampaignSetupWizardProps) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('basics');

  const steps = [
    { key: 'basics', label: 'Campaign Basics', icon: '📝' },
    { key: 'audience', label: 'Target Audience', icon: '🎯' },
    { key: 'review', label: 'Review & Confirm', icon: '✅' }
  ];

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);

  const handleNext = () => {
    if (currentStep === 'basics') setCurrentStep('audience');
    else if (currentStep === 'audience') setCurrentStep('review');
  };

  const handlePrevious = () => {
    if (currentStep === 'review') setCurrentStep('audience');
    else if (currentStep === 'audience') setCurrentStep('basics');
  };

  const handleComplete = () => {
    onClose();
  };

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

  const renderStepContent = () => {
    switch (currentStep) {
      case 'basics':
        return (
          <div className="space-y-6 p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Campaign Setup</h3>
              <p className="text-muted-foreground">
                Configure your campaign settings in the main editor. This wizard will help you set up audience targeting.
              </p>
            </div>
            <div className="bg-accent/20 border border-accent/40 rounded-lg p-4">
              <p className="text-sm">
                <strong>Tip:</strong> Make sure to fill in your campaign name and subject line in the main editor before proceeding to audience targeting.
              </p>
            </div>
          </div>
        );

      case 'audience':
        return (
          <AudienceSelector
            selectedPersonas={selectedPersonas}
            selectedSegments={selectedSegments}
            onPersonasChange={onPersonasChange}
            onSegmentsChange={onSegmentsChange}
            maxPersonas={3}
            maxSegments={5}
            onClose={() => {}} // Don't close wizard on audience selector close
          />
        );

      case 'review':
        return (
          <div className="space-y-6 p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Review Your Setup</h3>
              <p className="text-muted-foreground">
                Review your campaign audience targeting configuration.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Target Audience
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Selection:</span>
                    <Badge variant="secondary">{getSelectionSummary()}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Total Reach:</span>
                    <span className="font-medium">{getTotalAudience()}</span>
                  </div>
                </div>
              </div>

              {selectedPersonas.length > 0 && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Selected Personas</h4>
                  <div className="space-y-1">
                    {selectedPersonas.map(persona => (
                      <div key={persona.id} className="text-sm">
                        <span className="font-medium">{persona.persona_name}</span>
                        {persona.persona_description && (
                          <p className="text-muted-foreground text-xs">
                            {persona.persona_description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSegments.length > 0 && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Selected Segments</h4>
                  <div className="space-y-1">
                    {selectedSegments.map(segment => (
                      <div key={segment.id} className="text-sm flex items-center justify-between">
                        <div>
                          <span className="font-medium">{segment.name}</span>
                          {segment.description && (
                            <p className="text-muted-foreground text-xs">
                              {segment.description}
                            </p>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {segment.customer_count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Campaign Setup Wizard
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center space-x-4 py-4 border-b">
          {steps.map((step, index) => {
            const isActive = step.key === currentStep;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div
                key={step.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : isCompleted 
                      ? 'bg-accent text-accent-foreground' 
                      : 'text-muted-foreground'
                }`}
              >
                <span className="text-lg">
                  {isCompleted ? <Check className="h-4 w-4" /> : step.icon}
                </span>
                <span className="text-sm font-medium hidden sm:inline">
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {renderStepContent()}
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between py-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 'basics'}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            
            {currentStep === 'review' ? (
              <Button onClick={handleComplete}>
                <Check className="h-4 w-4 mr-1" />
                Complete Setup
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};