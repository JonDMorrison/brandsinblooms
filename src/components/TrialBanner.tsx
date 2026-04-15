import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui-legacy/button";
import { X } from "lucide-react";
import { useState } from "react";

export const TrialBanner = () => {
  const { subscription, loading, isTrialExpired, trialDaysLeft } = useSubscription();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show anything while loading subscription status - prevents flash
  if (loading) {
    return null;
  }

  // Don't show if no subscription data yet (still initializing)
  if (!subscription) {
    return null;
  }

  // Don't show for paid plans or if dismissed
  if (
    isDismissed ||
    subscription.plan === 'sprout' ||
    subscription.plan === 'bloom'
  ) {
    return null;
  }

  // Don't show if trial has plenty of time left
  if (!isTrialExpired && trialDaysLeft > 7) {
    return null;
  }

  const isUrgent = isTrialExpired || trialDaysLeft <= 3;

  return (
    <div className={`w-full px-2 py-1 text-xs md:px-4 md:py-2 md:text-sm ${
      isUrgent 
        ? 'bg-red-500 text-white' 
        : 'bg-orange-500 text-white'
    }`}>
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {isTrialExpired 
              ? "Your trial has expired" 
              : `${trialDaysLeft} days left in your trial`
            }
          </span>
          <span className="hidden md:inline">
            {isTrialExpired 
              ? "Upgrade now to continue using BloomSuite" 
              : "Upgrade to Pro to unlock unlimited features"
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 hover:text-white text-xs md:text-sm"
            onClick={() => window.location.href = '/pricing'}
          >
            Upgrade Now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 p-1"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
