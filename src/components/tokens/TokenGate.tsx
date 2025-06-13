
import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Coins, Crown } from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import { useNavigate } from "react-router-dom";

interface TokenGateProps {
  tokensRequired: number;
  children: ReactNode;
  action: string;
  onProceed?: () => void;
}

export const TokenGate = ({ tokensRequired, children, action, onProceed }: TokenGateProps) => {
  const { tokenBalance, checkTokenAvailability, getOverageAmount, getOverageCost } = useTokens();
  const navigate = useNavigate();

  if (!tokenBalance) {
    return <>{children}</>;
  }

  const hasTokens = checkTokenAvailability(tokensRequired);
  const willGoIntoOverage = tokenBalance.tokens_balance < tokensRequired && tokenBalance.tokens_balance >= 0;
  const newOverageAmount = Math.max(0, tokensRequired - Math.max(0, tokenBalance.tokens_balance));
  const additionalCost = newOverageAmount * 0.25;

  if (hasTokens && !willGoIntoOverage) {
    return <>{children}</>;
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          {willGoIntoOverage ? (
            <>
              <AlertTriangle className="w-5 h-5" />
              Overage Warning
            </>
          ) : (
            <>
              <Coins className="w-5 h-5" />
              Insufficient Tokens
            </>
          )}
        </CardTitle>
        <CardDescription className="text-orange-700">
          {willGoIntoOverage 
            ? `This ${action} will use ${tokensRequired} tokens and put you into overage.`
            : `You need ${tokensRequired} tokens to ${action}.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white p-4 rounded-lg border border-orange-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Current Balance:</span>
              <div className="font-semibold">
                {Math.max(0, tokenBalance.tokens_balance)} tokens
              </div>
            </div>
            <div>
              <span className="text-gray-600">Required:</span>
              <div className="font-semibold">{tokensRequired} tokens</div>
            </div>
            {willGoIntoOverage && (
              <>
                <div>
                  <span className="text-gray-600">Current Overage:</span>
                  <div className="font-semibold text-orange-600">
                    {getOverageAmount()} tokens (${getOverageCost().toFixed(2)})
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Additional Cost:</span>
                  <div className="font-semibold text-orange-600">
                    +${additionalCost.toFixed(2)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {willGoIntoOverage && onProceed ? (
            <Button 
              onClick={onProceed}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Proceed with Overage (+${additionalCost.toFixed(2)})
            </Button>
          ) : (
            <Button 
              onClick={() => navigate('/subscription')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
          )}
          
          <Button variant="outline" onClick={() => navigate('/subscription')}>
            View Token Usage
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
