import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft } from "lucide-react";

interface OnboardingFlowProps {
  onComplete: (data: any) => void;
  onBack?: () => void;
}

export const OnboardingFlow = ({ onComplete, onBack }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: ""
  });

  const steps = [
    {
      title: "Help us get to know you",
      description: "What makes your garden center special? Your name, location, a bit of history, or anything you'd like us to know. Paste from your website if you'd like!",
      field: "aboutBusiness",
      placeholder: "e.g., Green Thumb Garden Center has been serving the Springfield community since 1985. Located in the heart of downtown, we specialize in native plants, organic gardening supplies, and seasonal workshops. Our family-owned business started when..."
    },
    {
      title: "Help us understand your voice",
      description: "Paste a newsletter, blog post, or social media post that best represents your tone. Or include all of them.",
      field: "toneSamples",
      placeholder: "Paste your content here - newsletters, social posts, blog articles, etc. This helps us match your unique voice and style..."
    },
    {
      title: "What events do you promote annually?",
      description: "List any recurring events you run (e.g., Spring Sale, Pumpkin Fest, Winter Workshops).",
      field: "annualEvents",
      placeholder: "e.g., Spring Sale (March), Mother's Day Plant Sale (May), Summer Herb Workshop Series (June-August), Fall Festival (October), Holiday Wreath Making (December)..."
    }
  ];

  const currentStepData = steps[currentStep - 1];
  const progress = (currentStep / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (onBack) {
      // If we're on the first step and have an onBack prop, go back to previous page
      onBack();
    }
  };

  const updateFormData = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentStepData.field]: value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-green-800 mb-2">
            Garden Center Marketing Hub
          </h1>
          <p className="text-green-600">Let's personalize your content creation experience</p>
        </div>

        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-gray-600 mt-2 text-center">
            Step {currentStep} of {steps.length}
          </p>
        </div>

        <Card className="shadow-xl border-green-200">
          <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
            <CardTitle className="text-xl">{currentStepData.title}</CardTitle>
            <CardDescription className="text-green-100">
              {currentStepData.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Textarea
              value={formData[currentStepData.field as keyof typeof formData]}
              onChange={(e) => updateFormData(e.target.value)}
              placeholder={currentStepData.placeholder}
              className="min-h-[200px] text-base border-green-200 focus:border-green-400"
            />
            
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 && !onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              
              <Button
                onClick={handleNext}
                className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                disabled={!formData[currentStepData.field as keyof typeof formData].trim()}
              >
                {currentStep === steps.length ? "Complete Setup" : "Next"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
