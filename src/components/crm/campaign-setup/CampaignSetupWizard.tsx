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
          <div className="p-6 space-y-8">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold">Campaign Setup</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Configure your campaign settings in the main editor. This wizard will help you set up audience targeting.
              </p>
            </div>
            <div className="bg-accent/20 border border-accent/40 rounded-lg p-6 max-w-3xl mx-auto">
              <p className="text-sm leading-relaxed">
                <strong>Tip:</strong> Make sure to fill in your campaign name and subject line in the main editor before proceeding to audience targeting.
              </p>
            </div>
          </div>
        );

      case 'audience':
        return (
          <div className="p-6">
            <AudienceSelector
              selectedPersonas={selectedPersonas}
              selectedSegments={selectedSegments}
              onPersonasChange={onPersonasChange}
              onSegmentsChange={onSegmentsChange}
              maxPersonas={10}
              maxSegments={5}
              onClose={() => {}} // Don't close wizard on audience selector close
            />
          </div>
        );

      case 'review':
        return (
          <div className="p-6 space-y-8">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold">Review Your Setup</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Review your campaign audience targeting configuration.
              </p>
            </div>

            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="p-6 border rounded-lg bg-card">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Target Audience
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Selection:</span>
                    <Badge variant="secondary">{getSelectionSummary()}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Reach:</span>
                    <span className="font-semibold text-primary">{getTotalAudience()}</span>
                  </div>
                </div>
              </div>

              {selectedPersonas.length > 0 && (
                <div className="p-6 border rounded-lg bg-card">
                  <h4 className="font-semibold mb-4">Selected Personas</h4>
                  <div className="space-y-3">
                    {selectedPersonas.map(persona => (
                      <div key={persona.id} className="p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium">{persona.persona_name}</span>
                        {persona.persona_description && (
                          <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                            {persona.persona_description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSegments.length > 0 && (
                <div className="p-6 border rounded-lg bg-card">
                  <h4 className="font-semibold mb-4">Selected Segments</h4>
                  <div className="space-y-3">
                    {selectedSegments.map(segment => (
                      <div key={segment.id} className="p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="font-medium">{segment.name}</span>
                          {segment.description && (
                            <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                              {segment.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">
                          {segment.customer_count.toLocaleString()}
                        </Badge>
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto gap-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Campaign Setup Wizard
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center space-x-4 py-6 px-6 border-b">
          {steps.map((step, index) => {
            const isActive = step.key === currentStep;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div
                key={step.key}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
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
        <div className="flex items-center justify-between p-6 pt-4 border-t bg-muted/20">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 'basics'}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            
            {currentStep === 'review' ? (
              <Button onClick={handleComplete} className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Complete Setup
              </Button>
            ) : (
              <Button onClick={handleNext} className="flex items-center gap-2">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};