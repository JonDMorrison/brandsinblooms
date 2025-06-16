
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Crown, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const TrialBanner = () => {
  const { subscription, trialDaysLeft } = useSubscription();
  const navigate = useNavigate();

  if (!subscription || subscription.plan !== 'free_trial') {
    return null;
  }

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  // Show urgent banner for last 3 days
  if (trialDaysLeft <= 3) {
    return (
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-3 text-center shadow-lg">
        <div className="flex items-center justify-center gap-3 text-sm font-medium">
          <Clock className="h-4 w-4 animate-pulse" />
          <span>
            ⚠️ Trial expires in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}! Don't lose your campaigns.
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUpgrade}
            className="ml-4 text-white border-white hover:bg-white hover:text-red-600 font-semibold"
          >
            <Crown className="h-3 w-3 mr-1" />
            Upgrade Now
          </Button>
        </div>
      </div>
    );
  }

  // Show throughout trial period but less urgent
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 border-b shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="outline" className="bg-white/20 text-white border-white/30 font-medium">
            <Zap className="h-3 w-3 mr-1" />
            Free Trial: {trialDaysLeft} days left
          </Badge>
          <span className="hidden sm:inline">Experience premium features - </span>
          <button 
            onClick={handleUpgrade}
            className="text-white hover:text-blue-100 underline hover:no-underline font-medium cursor-pointer bg-transparent border-none p-0"
          >
            upgrade to keep them forever
          </button>
        </div>
        
        <div className="hidden md:block">
          <Button 
            onClick={handleUpgrade}
            variant="outline"
            size="sm"
            className="text-white border-white hover:bg-white hover:text-blue-600"
          >
            <Crown className="h-3 w-3 mr-1" />
            View Plans
          </Button>
        </div>
      </div>
    </div>
  );
};
