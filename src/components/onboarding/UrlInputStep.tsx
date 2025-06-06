
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, Globe, Loader2 } from "lucide-react";

interface UrlInputStepProps {
  websiteUrl: string;
  setWebsiteUrl: (url: string) => void;
  onAnalyze: () => void;
  onManualEntry: () => void;
  isAnalyzing: boolean;
}

export const UrlInputStep = ({ 
  websiteUrl, 
  setWebsiteUrl, 
  onAnalyze, 
  onManualEntry,
  isAnalyzing 
}: UrlInputStepProps) => {
  const isValidUrl = (url: string) => {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Card className="shadow-md rounded-lg border bg-white">
      <CardContent className="p-6">
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-black">Enter Your Website</h2>
          </div>
          <p className="text-gray-700">
            We'll analyze your website to automatically fill in your business details, brand voice, and annual events.
          </p>
        </div>

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
              onClick={onAnalyze}
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
            
            <div className="text-center">
              <button
                onClick={onManualEntry}
                className="text-sm text-black hover:underline"
                disabled={isAnalyzing}
              >
                I'll paste my business information on my own.
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
