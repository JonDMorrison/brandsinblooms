
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { WebsiteAnalysisLoader } from "./onboarding/WebsiteAnalysisLoader";
import { UrlInputStep } from "./onboarding/UrlInputStep";
import { DataReviewStep } from "./onboarding/DataReviewStep";
import { OnboardingFlow } from "./OnboardingFlow";
import { useWebsiteAnalysis } from "@/hooks/useWebsiteAnalysis";
import { createCompanyProfileFromOnboarding, saveOnboardingResponse } from "./onboarding/CompanyProfileCreator";

interface WebsiteOnboardingFlowProps {
  onComplete: (data: any) => void;
}

export const WebsiteOnboardingFlow = ({ onComplete }: WebsiteOnboardingFlowProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [useManualEntry, setUseManualEntry] = useState(false);
  
  const { isAnalyzing, extractedData, analyzeWebsite, updateExtractedData } = useWebsiteAnalysis();

  const steps = [
    {
      title: "Enter Your Website",
      description: "We'll analyze your website to automatically fill in your business details, brand voice, and annual events.",
      component: "url-input"
    },
    {
      title: "Review & Edit Your Details",
      description: "We've extracted information from your website. You can change it at any time.",
      component: "review-data"
    }
  ];

  const handleAnalyze = async () => {
    const success = await analyzeWebsite(websiteUrl);
    if (success) {
      setTimeout(() => {
        setCurrentStep(2);
      }, 1000);
    }
  };

  const handleManualEntry = () => {
    setUseManualEntry(true);
  };

  const handleNext = async () => {
    if (!user) {
      toast.error("Please log in to continue");
      return;
    }

    console.log('Starting onboarding completion...');
    setIsCompleting(true);
    
    try {
      // Prepare final onboarding data
      const finalData = {
        aboutBusiness: `${extractedData.businessName ? extractedData.businessName + '. ' : ''}${extractedData.aboutBusiness}${extractedData.location ? ' Located in ' + extractedData.location + '.' : ''}${extractedData.services ? ' Services: ' + extractedData.services : ''}`,
        toneSamples: extractedData.brandVoice,
        annualEvents: extractedData.annualEvents,
        websiteUrl: websiteUrl
      };
      
      console.log('Completing onboarding with data:', finalData);
      
      // Save onboarding response to database
      await saveOnboardingResponse(finalData, user.id);
      
      // Create company profile from onboarding data
      await createCompanyProfileFromOnboarding(finalData, user.id);
      
      // Store the onboarding data in localStorage as backup
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(finalData));
      
      // Call the onComplete callback
      onComplete(finalData);
      
      // Navigate to the main app
      navigate('/?view=app');
      
      toast.success("Setup complete! Your company profile has been created.");
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error("Failed to complete setup. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  // If user chose manual entry, show the original onboarding flow
  if (useManualEntry) {
    return <OnboardingFlow onComplete={onComplete} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-garden-background">
      <div className="w-full max-w-lg">
        {/* Simple step indicator */}
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground">Step {currentStep} of {steps.length}</p>
        </div>

        {/* Loading state - Show when analyzing */}
        <WebsiteAnalysisLoader isAnalyzing={isAnalyzing} />

        {/* Main form - Hide when analyzing */}
        {!isAnalyzing && (
          <>
            {currentStep === 1 ? (
              <UrlInputStep
                websiteUrl={websiteUrl}
                setWebsiteUrl={setWebsiteUrl}
                onAnalyze={handleAnalyze}
                onManualEntry={handleManualEntry}
                isAnalyzing={isAnalyzing}
              />
            ) : (
              <DataReviewStep
                extractedData={extractedData}
                updateExtractedData={updateExtractedData}
                onBack={handleBack}
                onComplete={handleNext}
                isCompleting={isCompleting}
                isAnalyzing={isAnalyzing}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
