
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";

interface ExtractedData {
  businessName: string;
  aboutBusiness: string;
  brandVoice: string;
  annualEvents: string;
  location: string;
  services: string;
}

interface DataReviewStepProps {
  extractedData: ExtractedData;
  updateExtractedData: (field: keyof ExtractedData, value: string) => void;
  onBack: () => void;
  onComplete: () => void;
  isCompleting: boolean;
  isAnalyzing: boolean;
}

export const DataReviewStep = ({ 
  extractedData, 
  updateExtractedData, 
  onBack, 
  onComplete, 
  isCompleting,
  isAnalyzing
}: DataReviewStepProps) => {
  if (isAnalyzing) {
    return null;
  }

  return (
    <Card className="border-garden-green/30 bg-white/95 backdrop-blur-sm rounded-2xl">
      <CardHeader className="text-center pb-6">
        <div className="w-16 h-16 bg-garden-sage rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-garden-green" />
        </div>
        <CardTitle className="text-2xl font-semibold text-garden-green-dark">
          Review Your Content
        </CardTitle>
        <p className="text-gray-600 mt-2">
          Instantly receive ready-to-go posts, emails, and more — all editable and fully tailored.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name" className="text-gray-700 font-medium">
              Business Name
            </Label>
            <Input
              id="business-name"
              value={extractedData.businessName}
              onChange={(e) => updateExtractedData('businessName', e.target.value)}
              placeholder="Your Garden Center Name"
              className="h-12 border-garden-green/30 focus:border-garden-green focus:ring-garden-green/20 transition-all duration-200 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="about-business" className="text-gray-700 font-medium">
              About Your Business
            </Label>
            <Textarea
              id="about-business"
              value={extractedData.aboutBusiness}
              onChange={(e) => updateExtractedData('aboutBusiness', e.target.value)}
              placeholder="Tell us about your garden center..."
              className="min-h-[100px] border-garden-green/30 focus:border-garden-green focus:ring-garden-green/20 transition-all duration-200 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-voice" className="text-gray-700 font-medium">
              Brand Voice & Tone
            </Label>
            <Textarea
              id="brand-voice"
              value={extractedData.brandVoice}
              onChange={(e) => updateExtractedData('brandVoice', e.target.value)}
              placeholder="How do you communicate with customers?"
              className="min-h-[80px] border-garden-green/30 focus:border-garden-green focus:ring-garden-green/20 transition-all duration-200 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="annual-events" className="text-gray-700 font-medium">
              Annual Events & Seasons
            </Label>
            <Textarea
              id="annual-events"
              value={extractedData.annualEvents}
              onChange={(e) => updateExtractedData('annualEvents', e.target.value)}
              placeholder="Spring sales, holiday events, workshops..."
              className="min-h-[80px] border-garden-green/30 focus:border-garden-green focus:ring-garden-green/20 transition-all duration-200 rounded-lg"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button 
            onClick={onBack}
            variant="outline"
            className="flex-1 h-12 border-garden-green/30 hover:bg-garden-sage hover:border-garden-green transition-all duration-200 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={onComplete}
            disabled={isCompleting}
            className="flex-1 h-12 bg-garden-green hover:bg-garden-green-dark text-white font-medium transition-all duration-200 hover:shadow-lg rounded-lg"
          >
            {isCompleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              "Complete Setup"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
