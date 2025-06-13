
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Coins, AlertTriangle, Clock } from "lucide-react";
import { TOKEN_CONSTANTS } from "@/constants/tokens";
import { TokenBalance } from "@/types/tokens";

interface TokenBalanceCardProps {
  tokenBalance: TokenBalance;
  overageAmount: number;
  overageCost: number;
  resetTime: string;
}

export const TokenBalanceCard = ({
  tokenBalance,
  overageAmount,
  overageCost,
  resetTime
}: TokenBalanceCardProps) => {
  const isInOverage = tokenBalance.tokens_balance < 0;
  const progressValue = isInOverage ? 0 : (tokenBalance.tokens_balance / TOKEN_CONSTANTS.BASE_ALLOWANCE) * 100;

  return (
    <Card className="shadow-lg border-0 bg-white">
      <CardHeader className="pb-6 bg-gradient-to-r from-green-50 to-blue-50 border-b border-green-100">
        <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Coins className="w-6 h-6 text-green-600" />
          Token Balance Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Current Balance Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Coins className={`w-6 h-6 ${isInOverage ? 'text-orange-600' : 'text-green-600'}`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {isInOverage ? 0 : tokenBalance.tokens_balance}
                  </span>
                  <span className="text-gray-500">/ {TOKEN_CONSTANTS.BASE_ALLOWANCE}</span>
                  {tokenBalance.is_trial && (
                    <Badge variant="outline" className="ml-2">
                      Trial Account
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500">Available tokens this month</p>
              </div>
            </div>

            {isInOverage && (
              <div className="text-right">
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-lg font-bold">+{overageAmount} tokens</span>
                </div>
                <p className="text-sm text-orange-700">
                  ${overageCost.toFixed(2)} overage charge
                </p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Usage Progress</span>
              <span>{Math.round(progressValue)}%</span>
            </div>
            <Progress value={progressValue} className="h-3" />
          </div>

          {/* Reset Information */}
          <div className="flex items-center gap-2 text-gray-600 bg-gray-50 p-3 rounded-lg">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              Tokens reset <strong>{resetTime}</strong>
            </span>
          </div>

          {/* Overage Information */}
          {isInOverage && (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-800">Overage Usage</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    You've used {overageAmount} tokens beyond your monthly allowance. 
                    These will be charged at ${TOKEN_CONSTANTS.OVERAGE_RATE} per token on your next bill.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
