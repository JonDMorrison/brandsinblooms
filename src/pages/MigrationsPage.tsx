import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

type Step = 'connect' | 'choose' | 'analyze' | 'apply' | 'import' | 'report';

const steps: { id: Step; label: string; description: string }[] = [
  { id: 'connect', label: 'Connect', description: 'Connect to Mailchimp or Klaviyo' },
  { id: 'choose', label: 'Choose', description: 'Select lists, segments, and tags' },
  { id: 'analyze', label: 'Analyze (AI)', description: 'AI recommends mappings' },
  { id: 'apply', label: 'Apply', description: 'Review and apply mappings' },
  { id: 'import', label: 'Import', description: 'Import contacts and data' },
  { id: 'report', label: 'Report', description: 'View final report and disconnect' },
];

const MigrationsPage = () => {
  const [currentStep, setCurrentStep] = useState<Step>('connect');
  
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  
  const goToNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };
  
  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">One-Time Migration</h1>
        <p className="text-muted-foreground">
          Import contacts, consent, tags, and segments from Mailchimp or Klaviyo
        </p>
      </div>

      {/* Progress Steps */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    index < currentStepIndex
                      ? 'bg-primary border-primary text-primary-foreground'
                      : index === currentStepIndex
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className={`font-medium text-sm ${
                    index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </div>
                  <div className="text-xs text-muted-foreground max-w-[120px]">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Step Content */}
      <Card className="p-8">
        <div className="min-h-[400px] flex flex-col items-center justify-center">
          <h2 className="text-2xl font-semibold mb-4">
            {steps[currentStepIndex].label}
          </h2>
          <p className="text-muted-foreground text-center mb-8 max-w-md">
            {steps[currentStepIndex].description}
          </p>
          <div className="text-sm text-muted-foreground italic">
            Step content will be implemented in next phase
          </div>
        </div>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={goToPreviousStep}
          disabled={currentStepIndex === 0}
        >
          Previous
        </Button>
        <Button
          onClick={goToNextStep}
          disabled={currentStepIndex === steps.length - 1}
        >
          Next Step
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default MigrationsPage;
