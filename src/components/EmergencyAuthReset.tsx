
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { forceLogout } from "@/integrations/supabase/client";

interface EmergencyAuthResetProps {
  className?: string;
}

export const EmergencyAuthReset = ({ className = "" }: EmergencyAuthResetProps) => {
  const [isResetting, setIsResetting] = useState(false);
  const { isInLimboState, authError, forceReset } = useAuth();
  const { subscriptionError } = useSubscription();
  
  const hasErrors = authError || subscriptionError || isInLimboState;
  
  if (!hasErrors) {
    return null;
  }

  const handleEmergencyReset = async () => {
    setIsResetting(true);
    try {
      console.log('🚨 Emergency auth reset triggered');
      
      // Show confirmation
      const confirmed = window.confirm(
        'This will completely reset your authentication state and redirect you to the login page. Continue?'
      );
      
      if (confirmed) {
        await forceReset();
      }
    } catch (error) {
      console.error('❌ Emergency reset failed:', error);
      // Fallback to direct force logout
      await forceLogout();
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800 mb-1">
              Authentication Issue Detected
            </h3>
            <div className="text-xs text-red-700 space-y-1">
              {authError && <p>Auth Error: {authError}</p>}
              {subscriptionError && <p>Subscription Error: {subscriptionError}</p>}
              {isInLimboState && <p>Stuck in authentication loop</p>}
            </div>
          </div>
        </div>
        
        <Button
          onClick={handleEmergencyReset}
          disabled={isResetting}
          size="sm"
          variant="destructive"
          className="w-full text-xs"
        >
          {isResetting ? (
            <>
              <RotateCcw className="w-3 h-3 mr-2 animate-spin" />
              Resetting...
            </>
          ) : (
            <>
              <RotateCcw className="w-3 h-3 mr-2" />
              Reset Authentication
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
