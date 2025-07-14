
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Globe, Edit, AlertTriangle, RefreshCw } from "lucide-react";

interface AnalysisError {
  type: 'network' | 'validation' | 'extraction' | 'unknown';
  message: string;
  canRetry: boolean;
  suggestedAction?: string;
}

interface UrlInputStepProps {
  websiteUrl: string;
  setWebsiteUrl: (url: string) => void;
  onAnalyze: () => void;
  onManualEntry: () => void;
  isAnalyzing: boolean;
  analysisError?: AnalysisError | null;
  onResetAnalysis?: () => void;
}

export const UrlInputStep = ({ 
  websiteUrl, 
  setWebsiteUrl, 
  onAnalyze, 
  onManualEntry, 
  isAnalyzing,
  analysisError,
  onResetAnalysis
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

  const handleTryAgain = () => {
    if (onResetAnalysis) {
      onResetAnalysis();
    }
    setError("");
  };

  const getErrorVariant = (errorType: string) => {
    switch (errorType) {
      case 'network':
        return 'default';
      case 'validation':
        return 'destructive';
      case 'extraction':
        return 'default';
      default:
        return 'destructive';
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto border-brand-green/30 bg-white/95 backdrop-blur-sm rounded-2xl">
      <CardHeader className="text-center pb-6">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Edit className="h-8 w-8 text-brand-green" />
        </div>
        <CardTitle className="text-2xl font-semibold text-foreground">
          Paste Your Website
        </CardTitle>
        <p className="text-gray-600 mt-2">
          We'll analyze your site to learn your brand voice and customer style.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error Display */}
        {analysisError && (
          <Alert variant={getErrorVariant(analysisError.type)}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <div>{analysisError.message}</div>
              {analysisError.suggestedAction && (
                <div className="text-sm opacity-90">
                  <strong>Suggestion:</strong> {analysisError.suggestedAction}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                {analysisError.canRetry && (
                  <Button
                    onClick={handleTryAgain}
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Try Again
                  </Button>
                )}
                <Button
                  onClick={onManualEntry}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  Manual Entry Instead
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

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
                // Clear analysis error when user starts typing
                if (analysisError && onResetAnalysis) {
                  onResetAnalysis();
                }
              }}
              placeholder="https://your-garden-center.com"
              className="pl-10 h-12 border-brand-green/30 focus:border-brand-green focus:ring-brand-green/20 transition-all duration-200 rounded-lg"
              disabled={isAnalyzing}
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
        </div>

        <Button 
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full h-12 bg-brand-green hover:bg-brand-green-600 text-white font-medium transition-all duration-200 hover:shadow-lg rounded-lg"
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
            <span className="w-full border-t border-brand-green/20" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-gray-500">— or —</span>
          </div>
        </div>

        <Button 
          onClick={onManualEntry}
          variant="outline"
          className="w-full h-12 border-brand-green/30 hover:bg-muted hover:border-brand-green transition-all duration-200 rounded-lg"
          disabled={isAnalyzing}
        >
          Enter Details Manually
        </Button>

        {/* Help Text */}
        <div className="text-xs text-gray-500 text-center space-y-1">
          <p>Having trouble? Try entering your full website URL including "https://"</p>
          <p>Example: https://www.yoursite.com</p>
        </div>
      </CardContent>
    </Card>
  );
};
