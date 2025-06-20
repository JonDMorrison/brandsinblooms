
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
import { LandingPageHeader } from "./landing/LandingPageHeader";
import { OnboardingContentLoader } from "./onboarding/OnboardingContentLoader";

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

    console.log('🚀 Starting enhanced onboarding completion process...');
    setIsCompleting(true);
    
    try {
      // Prepare final onboarding data
      const finalData = {
        aboutBusiness: `${extractedData.businessName ? extractedData.businessName + '. ' : ''}${extractedData.aboutBusiness}${extractedData.location ? ' Located in ' + extractedData.location + '.' : ''}${extractedData.services ? ' Services: ' + extractedData.services : ''}`,
        toneSamples: extractedData.brandVoice,
        annualEvents: extractedData.annualEvents,
        websiteUrl: websiteUrl
      };
      
      console.log('📋 Final onboarding data prepared:', finalData);
      
      // STEP 1: Save onboarding response to database (quick operation)
      console.log('💾 Step 1: Saving onboarding response...');
      try {
        await saveOnboardingResponse(finalData, user.id);
        console.log('✅ Onboarding response saved successfully');
      } catch (saveError) {
        console.error('❌ Failed to save onboarding response:', saveError);
        toast.error("Failed to save onboarding data. Please try again.");
        return;
      }
      
      // STEP 2: Create company profile and generate content (complex operation)
      console.log('🔧 Step 2: Creating company profile and generating content...');
      try {
        await createCompanyProfileFromOnboarding(finalData, user.id);
        console.log('✅ Company profile creation completed successfully');
      } catch (profileError) {
        console.error('❌ Failed to create company profile:', profileError);
        
        // Show specific error message based on the error
        let errorMessage = "Failed to complete setup. ";
        if (profileError.message.includes('tenant')) {
          errorMessage += "There was an issue setting up your workspace. Please try again.";
        } else if (profileError.message.includes('Profile generation')) {
          errorMessage += "AI profile generation failed. Please try again or contact support.";
        } else if (profileError.message.includes('Campaign creation')) {
          errorMessage += "Content planning failed. Please try again.";
        } else if (profileError.message.includes('Failed to create tenant')) {
          errorMessage += "Workspace creation failed. Please check your internet connection and try again.";
        } else {
          errorMessage += "Please try again or contact support if the problem persists.";
        }
        
        toast.error(errorMessage);
        return;
      }
      
      // Store the onboarding data in localStorage as backup
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(finalData));
      
      // Call the onComplete callback with the data
      onComplete(finalData);
      
      toast.success("🎉 Setup complete! Your first week's content is ready to review!");
      
      // Navigate to the app - OnboardingGuard will now allow access
      navigate('/app');
      
    } catch (error) {
      console.error('🚨 Critical error in onboarding completion:', error);
      
      // Provide user-friendly error message
      const friendlyMessage = error.message?.includes('Onboarding failed:') 
        ? error.message.replace('Onboarding failed: ', '')
        : 'An unexpected error occurred during setup';
        
      toast.error(`Setup failed: ${friendlyMessage}. Please try again.`);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleManualEntryBack = () => {
    setUseManualEntry(false);
  };

  // If user chose manual entry, show the original onboarding flow
  if (useManualEntry) {
    return (
      <div className="min-h-screen bg-garden-background">
        <LandingPageHeader onLogin={() => navigate('/auth')} />
        <OnboardingFlow onComplete={onComplete} onBack={handleManualEntryBack} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-garden-background">
      <LandingPageHeader onLogin={() => navigate('/auth')} />
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-lg">
          {/* Simple step indicator */}
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground">Step {currentStep} of {steps.length}</p>
          </div>

          {/* Loading state - Show when analyzing or completing */}
          <WebsiteAnalysisLoader isAnalyzing={isAnalyzing} />
          <OnboardingContentLoader isCompleting={isCompleting} />

          {/* Main form - Hide when analyzing or completing */}
          {!isAnalyzing && !isCompleting && (
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
    </div>
  );
};
