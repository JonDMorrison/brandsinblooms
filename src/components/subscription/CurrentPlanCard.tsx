
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Zap } from "lucide-react";
import { TOKEN_CONSTANTS } from "@/constants/tokens";

interface CurrentPlanCardProps {
  currentPlan: string;
  nextBilling: string;
  billingCycle: string;
  onUpgradePlan: () => void;
  onCancelSubscription: () => void;
}

export const CurrentPlanCard = ({
  currentPlan,
  nextBilling,
  billingCycle,
  onUpgradePlan,
  onCancelSubscription
}: CurrentPlanCardProps) => {
  return (
    <Card className="shadow-lg border-0 bg-white">
      <CardHeader className="pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Crown className="w-6 h-6 text-blue-600" />
          Current Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">{currentPlan} Plan</span>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              Active
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>Next billing: {nextBilling}</div>
            <div>Billing cycle: {billingCycle}</div>
            <div>Base allowance: {TOKEN_CONSTANTS.BASE_ALLOWANCE} tokens/month</div>
            <div>Overage rate: ${TOKEN_CONSTANTS.OVERAGE_RATE}/token</div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={onUpgradePlan}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              <Zap className="w-4 h-4 mr-2" />
              Upgrade
            </Button>
            <Button 
              onClick={onCancelSubscription}
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Cancel Subscription
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
