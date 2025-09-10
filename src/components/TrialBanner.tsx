
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState } from "react";

export const TrialBanner = () => {
  const { isTrialExpired, trialDaysLeft } = useSubscription();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || (!isTrialExpired && trialDaysLeft > 7)) {
    return null;
  }

  const isUrgent = trialDaysLeft <= 3;

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
            className="text-white hover:bg-white/20 text-xs md:text-sm"
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
