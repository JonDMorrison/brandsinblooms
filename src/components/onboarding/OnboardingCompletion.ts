import { toast } from "@/hooks/use-toast";
import {
  createCompanyProfileFromOnboarding,
  saveOnboardingResponse,
} from "./CompanyProfileCreator";
import { confirmLocationSelection } from "@/lib/location/persistLocationExtraction";

interface OnboardingCompletionData {
  aboutBusiness: string;
  toneSamples: string;
  annualEvents: string;
  websiteUrl: string;
}

export interface ConfirmedLocationInput {
  postal_code: string;
  city: string;
  state_province: string;
  country: "US" | "CA";
}

export const useOnboardingCompletion = () => {
  const completeOnboarding = async (
    extractedData: any,
    websiteUrl: string,
    userId: string,
    onComplete: (data: any) => void,
    markAsCompleted: () => void,
    clearProgress: () => void,
    confirmedLocation?: ConfirmedLocationInput,
  ) => {
    try {
      // Prepare final onboarding data
      const finalData: OnboardingCompletionData = {
        aboutBusiness: `${extractedData.businessName ? extractedData.businessName + ". " : ""}${extractedData.aboutBusiness}${extractedData.location ? " Located in " + extractedData.location + "." : ""}${extractedData.services ? " Services: " + extractedData.services : ""}`,
        toneSamples: extractedData.brandVoice,
        annualEvents: extractedData.annualEvents,
        websiteUrl: websiteUrl,
      };
      // STEP 1: Save onboarding response to database (quick operation)
      // Mark as completed FIRST (localStorage) — this is the authoritative
      // signal that prevents the OnboardingGuard from redirecting back.
      // Must happen before any async operation that could fail.
      markAsCompleted();

      // Persist the user-confirmed location with source=manual/confidence=high
      // before creating the company profile, so subsequent profile updates
      // see the confirmed values.
      if (confirmedLocation?.postal_code) {
        const locationResult = await confirmLocationSelection(
          userId,
          confirmedLocation.postal_code,
          confirmedLocation.city,
          confirmedLocation.state_province,
          confirmedLocation.country,
        );
        if (!locationResult.success) {
          console.error(
            "⚠️ Failed to persist confirmed location (non-fatal):",
            locationResult.error,
          );
        }
      }

      try {
        await saveOnboardingResponse(finalData, userId);
      } catch (saveError) {
        console.error("❌ Failed to save onboarding response:", saveError);
        toast({
          title: "Error",
          description: "Failed to save onboarding data. Please try again.",
          variant: "destructive",
        });
        throw saveError;
      }

      // STEP 2: Start company profile and content generation in background
      // Start background process without waiting for completion
      createCompanyProfileFromOnboarding(finalData, userId)
        .then(() => {
          toast({
            title: "Success",
            description:
              "🎉 Your content library is ready! All posts have been generated.",
          });
        })
        .catch((profileError) => {
          console.error(
            "❌ Background company profile creation failed:",
            profileError,
          );

          // Show specific error message based on the error
          let errorMessage = "Content generation encountered an issue. ";
          if (profileError.message.includes("tenant")) {
            errorMessage += "There was an issue setting up your workspace.";
          } else if (profileError.message.includes("Profile generation")) {
            errorMessage += "AI profile generation failed.";
          } else if (profileError.message.includes("Campaign creation")) {
            errorMessage += "Content planning failed.";
          } else {
            errorMessage += "Some content may not be available.";
          }

          toast({
            title: "Error",
            description: errorMessage + " You can retry from the dashboard.",
            variant: "destructive",
          });
        });

      // Store the onboarding data in localStorage as backup
      localStorage.setItem(
        `garden-center-onboarding-${userId}`,
        JSON.stringify(finalData),
      );

      // Clear the progress since onboarding is complete
      clearProgress();

      // Call the onComplete callback with the data
      onComplete(finalData);

      toast({
        title: "Success",
        description:
          "🎉 Profile created! Your dashboard is ready - content is generating in the background.",
      });
    } catch (error) {
      console.error("🚨 Critical error in onboarding completion:", error);

      // Provide user-friendly error message
      const friendlyMessage = error.message?.includes("Onboarding failed:")
        ? error.message.replace("Onboarding failed: ", "")
        : "An unexpected error occurred during setup";

      toast({
        title: "Setup Failed",
        description: `Setup failed: ${friendlyMessage}. Please try again.`,
        variant: "destructive",
      });
      throw error;
    }
  };

  return { completeOnboarding };
};
