
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Coins, AlertTriangle, Clock } from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import { formatDistanceToNow } from "date-fns";

export const TokenMeter = () => {
  const { tokenBalance, loading, getOverageAmount, getOverageCost } = useTokens();

  if (loading || !tokenBalance) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Coins className="w-4 h-4 animate-pulse" />
        <span>Loading tokens...</span>
      </div>
    );
  }

  const isInOverage = tokenBalance.tokens_balance < 0;
  const overageAmount = getOverageAmount();
  const overageCost = getOverageCost();
  const baseAllowance = 100; // Default base allowance
  const progressValue = isInOverage ? 0 : (tokenBalance.tokens_balance / baseAllowance) * 100;

  const resetDate = new Date(tokenBalance.tokens_reset_at);
  const timeUntilReset = formatDistanceToNow(resetDate, { addSuffix: true });

  return (
    <div className="flex items-center gap-3">
      {/* Token Count */}
      <div className="flex items-center gap-2">
        <Coins className={`w-4 h-4 ${isInOverage ? 'text-orange-600' : 'text-green-600'}`} />
        <div className="flex items-center gap-1">
          <span className="font-semibold text-sm">
            {isInOverage ? 0 : tokenBalance.tokens_balance}
          </span>
          <span className="text-gray-500 text-sm">/ {baseAllowance}</span>
          {tokenBalance.is_trial && (
            <Badge variant="outline" className="text-xs px-1 py-0 ml-1">
              Trial
            </Badge>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-20">
        <Progress 
          value={progressValue} 
          className="h-2"
          indicatorClassName={isInOverage ? "bg-orange-500" : "bg-green-500"}
        />
      </div>

      {/* Overage Warning */}
      {isInOverage && (
        <div className="flex items-center gap-1 text-orange-600">
          <AlertTriangle className="w-3 h-3" />
          <span className="text-xs font-medium">
            +{overageAmount} tokens (${overageCost.toFixed(2)})
          </span>
        </div>
      )}

      {/* Reset Time */}
      <div className="flex items-center gap-1 text-gray-500 text-xs">
        <Clock className="w-3 h-3" />
        <span>Resets {timeUntilReset}</span>
      </div>
    </div>
  );
};
