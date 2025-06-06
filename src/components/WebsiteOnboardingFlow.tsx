import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft, Globe, Loader2, Sparkles, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WebsiteOnboardingFlowProps {
  onComplete: (data: any) => void;
}

export const WebsiteOnboardingFlow = ({ onComplete }: WebsiteOnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [extractedData, setExtractedData] = useState({
    businessName: "",
    aboutBusiness: "",
    location: "",
    services: "",
    brandVoice: "",
    annualEvents: "",
    websiteContent: ""
  });

  const steps = [
    {
      title: "Enter Your Website",
      description: "We'll analyze your website to automatically fill in your business details, brand voice, and annual events.",
      component: "url-input"
    },
    {
      title: "Review & Edit Your Details",
      description: "We've extracted information from your website. Please review and edit as needed.",
      component: "review-data"
    }
  ];

  const currentStepData = steps[currentStep - 1];
  const progress = (currentStep / steps.length) * 100;

  const extractionItems = [
    "Business name and location",
    "About us / company description", 
    "Brand voice and tone from your content",
    "Annual events and promotions",
    "Services and specializations"
  ];

  const analyzeWebsite = async () => {
    if (!websiteUrl.trim()) {
      toast.error("Please enter a website URL");
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-website', {
        body: { websiteUrl: websiteUrl.trim() }
      });

      if (error) {
        console.error('Error analyzing website:', error);
        toast.error("Failed to analyze website. Please try again or fill in manually.");
        return;
      }

      if (data?.extractedData) {
        setExtractedData(data.extractedData);
        setCurrentStep(2);
        toast.success("Website analyzed successfully!");
      }
    } catch (error) {
      console.error('Error in analyzeWebsite:', error);
      toast.error("Failed to analyze website. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      analyzeWebsite();
    } else {
      // Complete onboarding with extracted and edited data
      const finalData = {
        aboutBusiness: `${extractedData.businessName ? extractedData.businessName + '. ' : ''}${extractedData.aboutBusiness}${extractedData.location ? ' Located in ' + extractedData.location + '.' : ''}${extractedData.services ? ' Services: ' + extractedData.services : ''}`,
        toneSamples: extractedData.brandVoice,
        annualEvents: extractedData.annualEvents,
        websiteUrl: websiteUrl
      };
      onComplete(finalData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  };

  const updateExtractedData = (field: string, value: string) => {
    setExtractedData(prev => ({
      ...prev,
      [field]: value
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

        {isAnalyzing && (
          <Card className="shadow-xl border-blue-200 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
                <h3 className="text-lg font-semibold text-blue-800">
                  Analyzing your website...
                </h3>
              </div>
              <p className="text-center text-blue-600 mb-6">
                Just a second here, we are collecting your:
              </p>
              <div className="space-y-3">
                {extractionItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-xl border-green-200">
          <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
            <CardTitle className="text-xl flex items-center gap-2">
              {currentStep === 1 ? <Globe className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              {currentStepData.title}
            </CardTitle>
            <CardDescription className="text-green-100">
              {currentStepData.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {currentStep === 1 ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL
                  </label>
                  <Input
                    id="website"
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourgardencenter.com"
                    className="text-base border-green-200 focus:border-green-400"
                    disabled={isAnalyzing}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    We'll extract your business information, brand voice, and events from your website
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name
                  </label>
                  <Input
                    value={extractedData.businessName}
                    onChange={(e) => updateExtractedData('businessName', e.target.value)}
                    placeholder="Your Garden Center Name"
                    className="border-green-200 focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    About Your Business
                  </label>
                  <Textarea
                    value={extractedData.aboutBusiness}
                    onChange={(e) => updateExtractedData('aboutBusiness', e.target.value)}
                    placeholder="Tell us about your garden center..."
                    className="min-h-[100px] border-green-200 focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <Input
                    value={extractedData.location}
                    onChange={(e) => updateExtractedData('location', e.target.value)}
                    placeholder="City, State"
                    className="border-green-200 focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand Voice & Tone
                  </label>
                  <Textarea
                    value={extractedData.brandVoice}
                    onChange={(e) => updateExtractedData('brandVoice', e.target.value)}
                    placeholder="Examples of your writing style..."
                    className="min-h-[100px] border-green-200 focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Annual Events
                  </label>
                  <Textarea
                    value={extractedData.annualEvents}
                    onChange={(e) => updateExtractedData('annualEvents', e.target.value)}
                    placeholder="Spring sale, holiday workshops, etc..."
                    className="min-h-[80px] border-green-200 focus:border-green-400"
                  />
                </div>
              </div>
            )}
            
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isAnalyzing}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              
              <Button
                onClick={handleNext}
                className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                disabled={
                  isAnalyzing || 
                  (currentStep === 1 && (!websiteUrl.trim() || !isValidUrl(websiteUrl)))
                }
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing Website...
                  </>
                ) : (
                  <>
                    {currentStep === steps.length ? "Complete Setup" : "Analyze Website"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {currentStep === 1 && !isAnalyzing && (
          <div className="text-center mt-4">
            <Button 
              variant="ghost" 
              onClick={() => setCurrentStep(2)}
              className="text-green-600 hover:text-green-700"
            >
              Skip and fill manually instead
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
