import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { AlertTriangle, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface UsageWarningBannerProps {
  className?: string;
  dismissible?: boolean;
}

export const UsageWarningBanner = ({ className, dismissible = true }: UsageWarningBannerProps) => {
  const navigate = useNavigate();
  const { usage, loading, getThresholds, getUpgradeRecommendation } = useUsageTracking();
  const [dismissed, setDismissed] = useState(false);

  if (loading || !usage || dismissed) return null;

  const thresholds = getThresholds();
  const recommendation = getUpgradeRecommendation();

  // Don't show if not at any threshold
  if (!thresholds.anyAt80) return null;

  const isAtLimit = thresholds.anyAt100;
  const isNearLimit = thresholds.anyAt80 && !thresholds.anyAt100;

  const getMessage = () => {
    if (thresholds.emailAt100 && thresholds.smsAt100) {
      return "You've reached both your email and SMS limits for this month.";
    }
    if (thresholds.emailAt100) {
      return "You've reached your email limit for this month.";
    }
    if (thresholds.smsAt100) {
      return "You've reached your SMS limit for this month.";
    }
    if (thresholds.emailAt80 && thresholds.smsAt80) {
      return `You're at ${Math.round(usage.email.percent)}% email and ${Math.round(usage.sms.percent)}% SMS usage.`;
    }
    if (thresholds.emailAt80) {
      return `You've used ${Math.round(usage.email.percent)}% of your email quota.`;
    }
    if (thresholds.smsAt80) {
      return `You've used ${Math.round(usage.sms.percent)}% of your SMS quota.`;
    }
    return '';
  };

  return (
    <Alert 
      className={cn(
        "relative",
        isAtLimit 
          ? "border-destructive/50 bg-destructive/10" 
          : "border-amber-300 bg-amber-50",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {isAtLimit ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <TrendingUp className="h-4 w-4 text-amber-600" />
        )}
        <AlertDescription className={cn(
          "flex-1",
          isAtLimit ? "text-destructive" : "text-amber-800"
        )}>
          {getMessage()}
          {recommendation.suggestedTier && (
            <span className="ml-1">
              Upgrade to unlock more capacity.
            </span>
          )}
        </AlertDescription>
        <Button 
          size="sm" 
          variant={isAtLimit ? "destructive" : "outline"}
          onClick={() => navigate('/pricing')}
          className={cn(!isAtLimit && "border-amber-400 text-amber-800 hover:bg-amber-100")}
        >
          Upgrade
        </Button>
        {dismissible && (
          <button 
            onClick={() => setDismissed(true)}
            className={cn(
              "p-1 rounded-full hover:bg-black/10",
              isAtLimit ? "text-destructive" : "text-amber-600"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </Alert>
  );
};
