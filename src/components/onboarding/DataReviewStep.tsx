
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Sparkles, Loader2 } from "lucide-react";

interface ExtractedData {
  businessName: string;
  aboutBusiness: string;
  location: string;
  services: string;
  brandVoice: string;
  annualEvents: string;
  websiteContent: string;
}

interface DataReviewStepProps {
  extractedData: ExtractedData;
  updateExtractedData: (field: string, value: string) => void;
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
  return (
    <Card className="shadow-md rounded-lg border bg-white">
      <CardContent className="p-6">
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-black">Review & Edit Your Details</h2>
          </div>
          <p className="text-gray-700">
            We've extracted information from your website. You can change it at any time.
          </p>
        </div>

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
              onClick={onBack}
              disabled={isAnalyzing || isCompleting}
              className="flex items-center gap-2 text-black"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            
            <Button
              onClick={onComplete}
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
      </CardContent>
    </Card>
  );
};
