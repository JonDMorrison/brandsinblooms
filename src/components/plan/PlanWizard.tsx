import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { PlanWizardProvider, usePlanWizard } from './PlanWizardContext';
import { ImageLoadingProvider } from '@/contexts/ImageLoadingContext';
import { PlanStepTheme } from './steps/PlanStepTheme';
import { PlanStepCalendar } from './steps/PlanStepCalendar';
import { PlanStepPreview } from './steps/PlanStepPreview';
import { PlanStepReview } from './steps/PlanStepReview';
import { persistPlan } from '@/lib/plan/planPersist';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

const steps = [
  { id: 1, title: 'Pick Focus', description: 'Choose theme & month' },
  { id: 2, title: 'Generate Content', description: 'Create marketing drafts' },
  { id: 3, title: 'Customize', description: 'Edit & refine content' },
  { id: 4, title: 'Launch', description: 'Schedule & activate' },
];

const PlanWizardContent: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const { state, reset } = usePlanWizard();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Load state from URL on mount
  useEffect(() => {
    const month = searchParams.get('month');
    const theme = searchParams.get('theme');
    const step = searchParams.get('step');

    if (step) {
      const stepNum = parseInt(step, 10);
      if (stepNum >= 1 && stepNum <= 4) {
        setCurrentStep(stepNum);
      }
    }

    // URL state will be handled by individual step components
  }, [searchParams]);

  // Save state to URL when it changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    
    if (state.month) {
      params.set('month', state.month);
    }
    
    if (state.themes.length > 0) {
      params.set('themes', state.themes.map(t => t.id).join(','));
    }
    
    params.set('step', currentStep.toString());
    
    setSearchParams(params);
  }, [state.month, state.themes, currentStep, setSearchParams]);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLaunch = async () => {
    if (!state.themes.length || !state.month) {
      toast.error('Missing theme or month selection');
      return;
    }

    setIsLaunching(true);
    
    try {
      const result = await persistPlan(state);
      
      if (result.success) {
        const themesLabel = state.themes.map(t => t.label).join(' + ');
        let successMsg = `Plan launched! Created ${result.created} items for ${themesLabel}`;
        if (result.skipped > 0) {
          successMsg += ` (${result.skipped} items skipped)`;
        }
        toast.success(successMsg);
        
        // Reset the wizard
        reset();
        
        // Navigate to calendar with launch success params
        const month = state.month ? format(new Date(state.month), 'MMMM yyyy') : 'Your plan';
        navigate(`/calendar?planLaunched=true&launchMonth=${encodeURIComponent(month)}&launchItems=${result.created}`);
        
      } else {
        const errorMsg = result.error || 'Failed to create plan items';
        toast.error(errorMsg);
        
        // Show details if available
        if (result.details && result.details.length > 0) {
          console.log('[PlanWizard] Launch details:', result.details);
        }
      }
    } catch (error) {
      console.error('Plan launch error:', error);
      toast.error('Unexpected error during launch');
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStartOver = () => {
    reset();
    setCurrentStep(1);
    navigate('/plan');
  };

  const progressValue = (currentStep / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div className="h-6 w-px bg-border" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartOver}
                className="gap-2 text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                Start Over
              </Button>
            </div>
          </div>


          {/* Progress */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Progress value={progressValue} className="h-2" />
                <div className="flex justify-between text-sm">
                  {steps.map((step, index) => (
                    <div 
                      key={step.id}
                      className={`text-center ${
                        currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      <div className="font-medium">{step.title}</div>
                      <div className="text-xs">{step.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step Content */}
        <div className="max-w-6xl mx-auto">
          {currentStep === 1 && (
            <PlanStepTheme onNext={handleNext} />
          )}
          {currentStep === 2 && (
            <PlanStepCalendar onNext={handleNext} onBack={handleBack} />
          )}
          {currentStep === 3 && (
            <PlanStepPreview onNext={handleNext} onBack={handleBack} />
          )}
          {currentStep === 4 && (
            <PlanStepReview 
              onBack={handleBack} 
              onLaunch={handleLaunch}
              isLaunching={isLaunching}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const PlanWizard: React.FC = () => {
  return (
    <PlanWizardProvider>
      <ImageLoadingProvider>
        <PlanWizardContent />
      </ImageLoadingProvider>
    </PlanWizardProvider>
  );
};