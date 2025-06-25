
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Crown, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export const TrialBanner = () => {
  const { subscription, trialDaysLeft } = useSubscription();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isMobile = useIsMobile();

  console.log('TrialBanner: Rendering with values', {
    subscription: subscription?.plan,
    trialDaysLeft,
    typeof_trialDaysLeft: typeof trialDaysLeft
  });

  if (!subscription || subscription.plan !== 'free_trial') {
    console.log('TrialBanner: Not showing banner - no subscription or not free trial');
    return null;
  }

  const daysLeft = typeof trialDaysLeft === 'number' && !isNaN(trialDaysLeft) ? trialDaysLeft : 0;
  
  console.log('TrialBanner: Processed daysLeft:', daysLeft);

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  // Calculate proper margin based on sidebar state
  const isCollapsed = state === "collapsed";
  const sidebarWidth = isMobile ? 0 : (isCollapsed ? 56 : 256); // 14 * 4 = 56px collapsed, 64 * 4 = 256px expanded
  
  const bannerStyle = isMobile 
    ? {} 
    : { 
        marginLeft: `${sidebarWidth}px`,
        width: `calc(100% - ${sidebarWidth}px)`
      };

  // Show urgent banner for last 2 days (updated from 3 days)
  if (daysLeft <= 2) {
    const dayText = daysLeft === 1 ? 'day' : 'days';
    console.log('TrialBanner: Showing urgent banner for', daysLeft, dayText);
    
    return (
      <div 
        className="bg-gradient-to-r from-red-500 to-orange-500 text-black px-4 py-3 text-center shadow-lg relative z-40"
        style={bannerStyle}
      >
        <div className="flex items-center justify-center gap-3 text-sm font-medium">
          <Clock className="h-4 w-4 animate-pulse text-black" />
          <span className="text-black">
            ⚠️ Your 7-day trial expires in {daysLeft} {dayText}! Don't lose access to all Bloom features.
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUpgrade}
            className="ml-4 text-black border-black hover:bg-black hover:text-white font-semibold"
          >
            <Crown className="h-3 w-3 mr-1" />
            Upgrade Now
          </Button>
        </div>
      </div>
    );
  }

  // Show throughout trial period but less urgent
  console.log('TrialBanner: Showing regular banner for', daysLeft, 'days left');
  
  return (
    <div 
      className="bg-gradient-to-r from-blue-500 to-purple-600 text-black px-4 py-2 border-b shadow-sm relative z-40"
      style={bannerStyle}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="outline" className="bg-white/20 text-black border-black font-medium">
            <Zap className="h-3 w-3 mr-1 text-black" />
            7-Day Trial: {daysLeft} days left
          </Badge>
          <span className="hidden sm:inline text-black">Full Bloom features included - </span>
          <button 
            onClick={handleUpgrade}
            className="text-black hover:text-gray-700 underline hover:no-underline font-medium cursor-pointer bg-transparent border-none p-0"
          >
            keep them forever
          </button>
        </div>
        
        <div className="hidden md:block">
          <Button 
            onClick={handleUpgrade}
            variant="outline"
            size="sm"
            className="text-black border-black hover:bg-black hover:text-white"
          >
            <Crown className="h-3 w-3 mr-1" />
            View Plans
          </Button>
        </div>
      </div>
    </div>
  );
};
