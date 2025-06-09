
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, Edit } from "lucide-react";

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
  const [error, setError] = useState("");

  const handleAnalyze = () => {
    if (!websiteUrl.trim()) {
      setError("Please enter a website URL");
      return;
    }
    setError("");
    onAnalyze();
  };

  return (
    <Card className="border-garden-green/30 bg-white/95 backdrop-blur-sm rounded-2xl">
      <CardHeader className="text-center pb-6">
        <div className="w-16 h-16 bg-garden-sage rounded-full flex items-center justify-center mx-auto mb-4">
          <Edit className="h-8 w-8 text-garden-green" />
        </div>
        <CardTitle className="text-2xl font-semibold text-garden-green-dark">
          Paste Your Website
        </CardTitle>
        <p className="text-gray-600 mt-2">
          We'll analyze your site to learn your brand voice and customer style.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="website-url" className="text-gray-700 font-medium">
            Website URL
          </Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="website-url"
              type="url"
              value={websiteUrl}
              onChange={(e) => {
                setWebsiteUrl(e.target.value);
                setError("");
              }}
              placeholder="https://your-garden-center.com"
              className="pl-10 h-12 border-garden-green/30 focus:border-garden-green focus:ring-garden-green/20 transition-all duration-200 rounded-lg"
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
        </div>

        <Button 
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full h-12 bg-garden-green hover:bg-garden-green-dark text-white font-medium transition-all duration-200 hover:shadow-lg rounded-lg"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Analyze Website"
          )}
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-garden-green/20" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-gray-500">— or —</span>
          </div>
        </div>

        <Button 
          onClick={onManualEntry}
          variant="outline"
          className="w-full h-12 border-garden-green/30 hover:bg-garden-sage hover:border-garden-green transition-all duration-200 rounded-lg"
        >
          Enter Details Manually
        </Button>
      </CardContent>
    </Card>
  );
};
