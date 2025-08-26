
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WebsiteStep } from "./steps/WebsiteStep";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SetupWizardModalProps {
  open: boolean;
  onClose: () => void;
  onFinished: () => void;
}

const STEPS = [
  { id: 'website', title: 'Your Website', component: WebsiteStep },
  { id: 'pos', title: 'Connect POS', component: null }, // Placeholder
  { id: 'messaging', title: 'Messaging Setup', component: null }, // Placeholder
  { id: 'automations', title: 'Starter Automations', component: null }, // Placeholder
];

export const SetupWizardModal = ({ open, onClose, onFinished }: SetupWizardModalProps) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    
    try {
      setIsFinishing(true);
      
      // Mark onboarding as completed using the RPC
      const { error } = await supabase.rpc('mark_onboarding_completed');
      
      if (error) throw error;
      
      // Notify parent to refetch profile
      onFinished();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setIsFinishing(false);
    }
  };

  const currentStepData = STEPS[currentStep];
  const StepComponent = currentStepData.component;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="text-2xl font-semibold text-center mb-2">
          Welcome! Let's set up your account
        </DialogTitle>
        
        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {STEPS.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          {/* Step titles */}
          <div className="flex justify-center">
            <h3 className="text-lg font-medium">{currentStepData.title}</h3>
          </div>

          {/* Step content */}
          <div className="min-h-[300px]">
            {StepComponent ? (
              <StepComponent onNext={handleNext} onPrevious={handlePrevious} />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="text-muted-foreground text-center">
                  <h4 className="font-medium mb-2">{currentStepData.title}</h4>
                  <p>This step is coming soon! You can skip it for now.</p>
                </div>
                <Button onClick={handleNext} variant="outline">
                  Skip for now
                </Button>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            
            <div className="space-x-2">
              {currentStep === STEPS.length - 1 ? (
                <Button 
                  onClick={handleFinish} 
                  disabled={isFinishing}
                  className="min-w-24"
                >
                  {isFinishing ? 'Finishing...' : 'Finish Setup'}
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setCurrentStep(STEPS.length - 1)}>
                  Skip all
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
