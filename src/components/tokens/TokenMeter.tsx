
import { Badge } from "@/components/ui/badge";
import { Coins, AlertTriangle } from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import { TOKEN_CONSTANTS } from "@/constants/tokens";

export const TokenMeter = () => {
  const { tokenBalance, loading, getOverageAmount } = useTokens();

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

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Coins className={`w-4 h-4 ${isInOverage ? 'text-orange-600' : 'text-green-600'}`} />
        <div className="flex items-center gap-1">
          <span className="font-semibold text-sm">
            {isInOverage ? 0 : tokenBalance.tokens_balance}
          </span>
          <span className="text-gray-500 text-sm">/ {TOKEN_CONSTANTS.BASE_ALLOWANCE}</span>
          {tokenBalance.is_trial && (
            <Badge variant="outline" className="text-xs px-1 py-0 ml-1">
              Trial
            </Badge>
          )}
        </div>
      </div>

      {isInOverage && (
        <div className="flex items-center gap-1 text-orange-600">
          <AlertTriangle className="w-3 h-3" />
          <span className="text-xs font-medium">
            +{overageAmount}
          </span>
        </div>
      )}
    </div>
  );
};
