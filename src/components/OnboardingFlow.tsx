import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createCompanyProfileFromOnboarding, saveOnboardingResponse } from "./onboarding/CompanyProfileCreator";
import { LandingPageHeader } from "./landing/LandingPageHeader";

interface OnboardingFlowProps {
  onComplete: (data: any) => void;
  onBack?: () => void;
}

export const OnboardingFlow = ({ onComplete, onBack }: OnboardingFlowProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: ""
  });

  const steps = [
    {
      title: "Tell us about your business",
      description: "Help us understand your garden center's story and what makes it special.",
      field: "aboutBusiness",
      placeholder: "Describe your garden center, its history, location, specialties, and what sets you apart from competitors...",
      label: "About Your Business"
    },
    {
      title: "Share your brand voice",
      description: "Provide examples of how you communicate with customers to help us match your tone.",
      field: "toneSamples",
      placeholder: "Share examples of your marketing copy, social media posts, or how you typically communicate with customers...",
      label: "Brand Voice & Tone Examples"
    },
    {
      title: "Annual events and seasons",
      description: "Tell us about your yearly calendar, seasonal promotions, and special events.",
      field: "annualEvents",
      placeholder: "Describe your seasonal events, annual sales, workshops, plant fairs, holiday promotions, etc...",
      label: "Annual Events & Seasonal Calendar"
    }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    const currentField = steps[currentStep - 1].field as keyof typeof formData;
    if (!formData[currentField].trim()) {
      toast.error("Please fill in this field before continuing");
      return;
    }
    
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (onBack) {
      onBack();
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please log in to continue");
      return;
    }

    const currentField = steps[currentStep - 1].field as keyof typeof formData;
    if (!formData[currentField].trim()) {
      toast.error("Please fill in this field before continuing");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Completing onboarding with manual data
      
      // Save onboarding response to database
      await saveOnboardingResponse(formData, user.id);
      
      // Create company profile from onboarding data
      await createCompanyProfileFromOnboarding(formData, user.id);
      
      // Store the onboarding data in localStorage as backup
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(formData));
      
      // Call the onComplete callback with the data
      onComplete(formData);
      
      toast.success("Setup complete!  Welcome to BloomSuite!");
      
      // Navigate to the app - OnboardingGuard will now allow access
      navigate('/app');
      
    } catch (error) {
      // Error completing onboarding
      toast.error("Failed to complete setup.  Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepData = steps[currentStep - 1];
  const isLastStep = currentStep === steps.length;

  return (
    <div className="min-h-screen bg-garden-background">
      <LandingPageHeader onLogin={() => navigate('/auth')} />
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-2xl">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-garden-green">
                Step {currentStep} of {steps.length}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round((currentStep / steps.length) * 100)}% complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-garden-green h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold text-garden-green-dark mb-2">
                {currentStepData.title}
              </CardTitle>
              <CardDescription className="text-base text-gray-600">
                {currentStepData.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor={currentStepData.field} className="text-base font-medium">
                  {currentStepData.label}
                </Label>
                <Textarea
                  id={currentStepData.field}
                  placeholder={currentStepData.placeholder}
                  value={formData[currentStepData.field as keyof typeof formData]}
                  onChange={(e) => handleInputChange(currentStepData.field, e.target.value)}
                  className="min-h-[150px] resize-none text-base leading-relaxed"
                  required
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {currentStep === 1 ? 'Back to Website' : 'Previous'}
                </Button>

                {isLastStep ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-garden-green hover:bg-garden-green-dark text-white flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Completing Setup...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="bg-garden-green hover:bg-garden-green-dark text-white flex items-center gap-2"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
