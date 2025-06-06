
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Globe, Loader2, Sparkles, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WebsiteOnboardingFlowProps {
  onComplete: (data: any) => void;
}

export const WebsiteOnboardingFlow = ({ onComplete }: WebsiteOnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
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
      description: "We've extracted information from your website. You can change it at any time.",
      component: "review-data"
    }
  ];

  const currentStepData = steps[currentStep - 1];

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

    console.log('Starting website analysis for:', websiteUrl);
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-website', {
        body: { websiteUrl: websiteUrl.trim() }
      });

      console.log('Analysis response:', { data, error });

      if (error) {
        console.error('Error analyzing website:', error);
        toast.error("Failed to analyze website. Please try again or fill in manually.");
        setIsAnalyzing(false);
        return;
      }

      if (data?.extractedData) {
        console.log('Successfully extracted data:', data.extractedData);
        setExtractedData(data.extractedData);
        setCurrentStep(2);
        toast.success("Website analyzed successfully!");
      } else {
        console.warn('No extracted data received');
        toast.error("No data could be extracted from the website.");
      }
    } catch (error) {
      console.error('Error in analyzeWebsite:', error);
      toast.error("Failed to analyze website. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      analyzeWebsite();
    } else {
      console.log('Starting onboarding completion...');
      setIsCompleting(true);
      try {
        // Complete onboarding with extracted and edited data
        const finalData = {
          aboutBusiness: `${extractedData.businessName ? extractedData.businessName + '. ' : ''}${extractedData.aboutBusiness}${extractedData.location ? ' Located in ' + extractedData.location + '.' : ''}${extractedData.services ? ' Services: ' + extractedData.services : ''}`,
          toneSamples: extractedData.brandVoice,
          annualEvents: extractedData.annualEvents,
          websiteUrl: websiteUrl
        };
        
        console.log('Completing onboarding with data:', finalData);
        onComplete(finalData);
        toast.success("Content creation setup complete!");
      } catch (error) {
        console.error('Error completing onboarding:', error);
        toast.error("Failed to complete setup. Please try again.");
      } finally {
        setIsCompleting(false);
      }
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-garden-background">
      <div className="w-full max-w-lg">
        {/* Simple step indicator */}
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground">Step {currentStep} of {steps.length}</p>
        </div>

        {/* Loading state - Show when analyzing */}
        {isAnalyzing && (
          <Card className="shadow-md rounded-lg border mb-4 bg-white">
            <CardContent className="p-6">
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-3 text-black">Analyzing your website...</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Just a second here, we are collecting your:
                </p>
                <div className="space-y-2 text-left max-w-sm mx-auto">
                  {extractionItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main form - Hide when analyzing */}
        {!isAnalyzing && (
          <Card className="shadow-md rounded-lg border bg-white">
            <CardContent className="p-6">
              {/* Header */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  {currentStep === 1 ? <Globe className="w-5 h-5 text-primary" /> : <Sparkles className="w-5 h-5 text-primary" />}
                  <h2 className="text-xl font-semibold text-black">{currentStepData.title}</h2>
                </div>
                <p className="text-gray-700">{currentStepData.description}</p>
              </div>

              {currentStep === 1 ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="website-url" className="block text-sm font-medium text-gray-700">
                      Website URL
                    </label>
                    <Input
                      id="website-url"
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourgardencenter.com"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-400"
                      disabled={isAnalyzing}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={handleNext}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                      disabled={
                        isAnalyzing || 
                        (!websiteUrl.trim() || !isValidUrl(websiteUrl))
                      }
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          Analyze Website
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Business Name
                    </label>
                    <Input
                      value={extractedData.businessName}
                      onChange={(e) => updateExtractedData('businessName', e.target.value)}
                      placeholder="Your Garden Center Name"
                      className="text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      About Your Business
                    </label>
                    <Textarea
                      value={extractedData.aboutBusiness}
                      onChange={(e) => updateExtractedData('aboutBusiness', e.target.value)}
                      placeholder="Tell us about your garden center..."
                      className="min-h-[80px] text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Location
                    </label>
                    <Input
                      value={extractedData.location}
                      onChange={(e) => updateExtractedData('location', e.target.value)}
                      placeholder="City, State"
                      className="text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Brand Voice & Tone
                    </label>
                    <Textarea
                      value={extractedData.brandVoice}
                      onChange={(e) => updateExtractedData('brandVoice', e.target.value)}
                      placeholder="Examples of your writing style..."
                      className="min-h-[80px] text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Annual Events
                    </label>
                    <Textarea
                      value={extractedData.annualEvents}
                      onChange={(e) => updateExtractedData('annualEvents', e.target.value)}
                      placeholder="Spring sale, holiday workshops, etc..."
                      className="min-h-[60px] text-black"
                    />
                  </div>

                  <div className="flex items-center justify-between mt-6">
                    <Button
                      variant="outline"
                      onClick={handleBack}
                      disabled={isAnalyzing || isCompleting}
                      className="flex items-center gap-2 text-black"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </Button>
                    
                    <Button
                      onClick={handleNext}
                      className="bg-primary hover:bg-primary/90 flex items-center gap-2"
                      disabled={isAnalyzing || isCompleting}
                    >
                      {isCompleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Setting up...
                        </>
                      ) : (
                        <>
                          Create Your Content
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
