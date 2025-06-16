
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Crown, Eye } from "lucide-react";
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

  const handleViewPricing = () => {
    navigate('/pricing');
  };

  if (trialDaysLeft <= 3) {
    return (
      <div className="bg-warning-500 text-warning-foreground px-4 py-2 text-center">
        <div className="flex items-center justify-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span>
            Your free trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUpgrade}
            className="ml-4 text-warning-foreground border-warning-foreground hover:bg-warning-foreground hover:text-warning-500"
          >
            <Crown className="h-3 w-3 mr-1" />
            Upgrade Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
            Free Trial: {trialDaysLeft} days left
          </Badge>
        </div>
        
        <div className="hidden sm:flex items-center text-sm text-blue-700">
          <span>Start your journey today - see our simple pricing</span>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleViewPricing}
          className="text-blue-700 border-blue-300 hover:bg-blue-100 flex-shrink-0"
        >
          <Eye className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">View Pricing</span>
          <span className="sm:hidden">Pricing</span>
        </Button>
      </div>
    </div>
  );
};
