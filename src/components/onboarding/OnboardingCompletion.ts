
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createCompanyProfileFromOnboarding, saveOnboardingResponse } from "./CompanyProfileCreator";

interface OnboardingCompletionData {
  aboutBusiness: string;
  toneSamples: string;
  annualEvents: string;
  websiteUrl: string;
}

export const useOnboardingCompletion = () => {
  const navigate = useNavigate();

  const completeOnboarding = async (
    extractedData: any,
    websiteUrl: string,
    userId: string,
    onComplete: (data: any) => void,
    markAsCompleted: () => void,
    clearProgress: () => void
  ) => {
    console.log('🚀 Starting enhanced onboarding completion process...');
    
    try {
      // Prepare final onboarding data
      const finalData: OnboardingCompletionData = {
        aboutBusiness: `${extractedData.businessName ? extractedData.businessName + '. ' : ''}${extractedData.aboutBusiness}${extractedData.location ? ' Located in ' + extractedData.location + '.' : ''}${extractedData.services ? ' Services: ' + extractedData.services : ''}`,
        toneSamples: extractedData.brandVoice,
        annualEvents: extractedData.annualEvents,
        websiteUrl: websiteUrl
      };
      
      console.log('📋 Final onboarding data prepared:', finalData);
      
      // STEP 1: Save onboarding response to database (quick operation)
      console.log('💾 Step 1: Saving onboarding response...');
      try {
        await saveOnboardingResponse(finalData, userId);
        console.log('✅ Onboarding response saved successfully');
        
        // Mark as completed immediately to prevent race conditions
        markAsCompleted();
      } catch (saveError) {
        console.error('❌ Failed to save onboarding response:', saveError);
        toast.error("Failed to save onboarding data. Please try again.");
        throw saveError;
      }
      
      // STEP 2: Create company profile and generate content (complex operation)
      console.log('🔧 Step 2: Creating company profile and generating content...');
      try {
        await createCompanyProfileFromOnboarding(finalData, userId);
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
        throw profileError;
      }
      
      // Store the onboarding data in localStorage as backup
      localStorage.setItem(`garden-center-onboarding-${userId}`, JSON.stringify(finalData));
      
      // Clear the progress since onboarding is complete
      clearProgress();
      
      // Call the onComplete callback with the data
      onComplete(finalData);
      
      toast.success("🎉 Setup complete! Your first week's content is ready to review!");
      
      console.log('🎯 Onboarding completed successfully, navigating to dashboard...');
      
      // FIX: Navigate to '/' instead of '/app' - this was the critical bug
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 200);
      
    } catch (error) {
      console.error('🚨 Critical error in onboarding completion:', error);
      
      // Provide user-friendly error message
      const friendlyMessage = error.message?.includes('Onboarding failed:') 
        ? error.message.replace('Onboarding failed: ', '')
        : 'An unexpected error occurred during setup';
        
      toast.error(`Setup failed: ${friendlyMessage}. Please try again.`);
      throw error;
    }
  };

  return { completeOnboarding };
};
