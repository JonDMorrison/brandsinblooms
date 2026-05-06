import { useState } from "react";
import { AuthAlert, AuthButton, AuthInput } from "@/components/auth";
import { Globe, RefreshCw } from "lucide-react";

interface AnalysisError {
  type: "network" | "validation" | "extraction" | "unknown";
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
  onResetAnalysis,
}: UrlInputStepProps) => {
  const [error, setError] = useState("");

  const hasValidHttpsUrl = (value: string) => {
    try {
      const parsedUrl = new URL(value.trim());
      return parsedUrl.protocol === "https:" && Boolean(parsedUrl.hostname);
    } catch {
      return false;
    }
  };

  const handleAnalyze = () => {
    if (!websiteUrl.trim()) {
      setError("Please enter a website URL");
      return;
    }
    if (!hasValidHttpsUrl(websiteUrl)) {
      setError("Please enter a valid URL");
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

  return (
    <div className="auth-onboarding-step auth-onboarding-step--url">
      <div className="auth-onboarding-step__header">
        <div className="auth-icon-bubble auth-icon-bubble--large">
          <Globe aria-hidden="true" />
        </div>
        <h1>Let's set up your store</h1>
        <p>
          Enter your website and BloomSuite will build a starter profile from
          your brand, products, and location details.
        </p>
      </div>

      {/* Error Display */}
      {analysisError && (
        <AuthAlert
          key={analysisError.message}
          variant={analysisError.type === "validation" ? "error" : "info"}
        >
          <span className="auth-onboarding-alert-stack">
            <div>{analysisError.message}</div>
            {analysisError.suggestedAction && (
              <div className="auth-onboarding-muted">
                <strong>Suggestion:</strong> {analysisError.suggestedAction}
              </div>
            )}
            <div className="auth-onboarding-actions auth-onboarding-actions--inline">
              {analysisError.canRetry && (
                <AuthButton
                  onClick={handleTryAgain}
                  variant="secondary"
                  fullWidth={false}
                  size="sm"
                >
                  <RefreshCw aria-hidden="true" />
                  Try Again
                </AuthButton>
              )}
              <AuthButton
                onClick={onManualEntry}
                variant="secondary"
                fullWidth={false}
                size="sm"
              >
                Manual Entry Instead
              </AuthButton>
            </div>
          </span>
        </AuthAlert>
      )}

      <AuthInput
        id="website-url"
        label="Website URL"
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
        icon={<Globe aria-hidden="true" />}
        disabled={isAnalyzing}
        error={error}
      />

      <AuthButton
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        loading={isAnalyzing}
      >
        Analyze My Website
      </AuthButton>

      <AuthButton
        onClick={onManualEntry}
        variant="ghost"
        disabled={isAnalyzing}
        className="auth-onboarding-manual-link"
      >
        Don't have a website? Set up manually →
      </AuthButton>

      {/* Help Text */}
      <div className="auth-onboarding-help">
        <p>Use your full secure URL, for example https://www.yoursite.com.</p>
        <p>Your data is processed securely and never stored.</p>
      </div>
    </div>
  );
};
