import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { UrlInputStep } from "../onboarding/UrlInputStep";
import { DataReviewStep } from "../onboarding/DataReviewStep";
import { useWebsiteAnalysis } from "@/hooks/useWebsiteAnalysis";
import { useOnboardingCompletion } from "../onboarding/OnboardingCompletion";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface DashboardSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardSetupWizard = ({ isOpen, onClose }: DashboardSetupWizardProps) => {
  const [currentStep, setCurrentStep] = useState<'website' | 'review' | 'complete'>('website');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  
  const { user } = useAuth();
  const { 
    isAnalyzing, 
    analysisError, 
    extractedData, 
    analyzeWebsite, 
    updateExtractedData, 
    resetAnalysis 
  } = useWebsiteAnalysis();
  
  const { completeOnboarding } = useOnboardingCompletion();
  const { markAsCompleted } = useOnboardingStatus();

  const handleAnalyze = async () => {
    if (!websiteUrl) return;
    
    try {
      await analyzeWebsite(websiteUrl);
      
      if (!analysisError) {
        setCurrentStep('review');
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };

  const handleComplete = async () => {
    if (!user?.id) {
      toast.error('User not found');
      return;
    }

    setIsCompleting(true);
    try {
      await completeOnboarding(
        extractedData,
        websiteUrl,
        user.id,
        (data: any) => {
          console.log('Onboarding complete:', data);
        },
        markAsCompleted,
        () => {} // clearProgress - not needed here
      );
      
      toast.success('Setup complete! Welcome to BloomSuite');
      onClose();
    } catch (error) {
      console.error('Failed to complete setup:', error);
      toast.error('Setup failed. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSkip = () => {
    toast.success('You can set up your website analysis later in Settings');
    onClose();
  };

  const handleBack = () => {
    resetAnalysis();
    setCurrentStep('website');
  };

  const handleRetry = () => {
    resetAnalysis();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-6 h-6 text-blue-500" />
            Complete Your Setup
          </DialogTitle>
          <p className="text-muted-foreground">
            Let's analyze your website to personalize BloomSuite for your business
          </p>
        </DialogHeader>
        
        <div className="mt-6">
          {currentStep === 'website' && (
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/60 rounded-lg">
                      <Globe className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">
                        Website Analysis
                      </h3>
                      <p className="text-gray-600 text-sm mb-4">
                        We'll automatically extract your business info, brand voice, and create a personalized profile.
                      </p>
                      
                      {!isAnalyzing && (
                        <UrlInputStep
                          websiteUrl={websiteUrl}
                          setWebsiteUrl={setWebsiteUrl}
                          onAnalyze={handleAnalyze}
                          onManualEntry={() => {}}
                          isAnalyzing={isAnalyzing}
                          analysisError={analysisError}
                          onResetAnalysis={handleRetry}
                        />
                      )}
                      
                      {isAnalyzing && (
                        <div className="flex items-center gap-3 py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-900">Analyzing your website...</p>
                            <p className="text-sm text-gray-600">This may take a moment</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" onClick={handleSkip}>
                  Skip for now
                </Button>
                <Button 
                  onClick={() => {/* Navigate to manual onboarding */}}
                  variant="outline"
                >
                  Enter details manually
                </Button>
              </div>
            </div>
          )}

          {currentStep === 'review' && extractedData && (
            <div className="space-y-6">
              <DataReviewStep
                extractedData={extractedData}
                updateExtractedData={updateExtractedData}
                onComplete={handleComplete}
                onBack={handleBack}
                isCompleting={isCompleting}
                isAnalyzing={isAnalyzing}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};