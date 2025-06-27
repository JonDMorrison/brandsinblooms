
import { CreditCard, Crown, Clock, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscriptionHeaderProps {
  currentPlan: string;
  billingCycle: string;
  tokenUsagePercent: number;
  resetTime: string;
  onBillingHistory: () => void;
  onManagePayment: () => void;
  onUpgradePlan: () => void;
}

export const SubscriptionHeader = ({
  currentPlan,
  billingCycle,
  tokenUsagePercent,
  resetTime,
  onBillingHistory,
  onManagePayment,
  onUpgradePlan
}: SubscriptionHeaderProps) => {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-[#3E5A6B] flex items-center gap-3">
              <CreditCard className="w-10 h-10 text-blue-600" />
              Account Settings
            </h1>
            <p className="text-lg text-gray-600 font-medium">
              Manage your subscription, billing, and account preferences
            </p>
            
            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Crown className="w-4 h-4 text-[#68BEB9]" />
                <span className="font-medium">{currentPlan}</span> plan
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{billingCycle}</span> billing
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{tokenUsagePercent}%</span> token usage
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Shield className="w-4 h-4 text-slate-600" />
                <span className="font-medium">Resets {resetTime}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={onBillingHistory}
              variant="outline"
              className="flex items-center gap-2 hover:bg-blue-50 border-blue-200 text-blue-700"
              size="lg"
            >
              <CreditCard className="w-5 h-5" />
              Billing History
            </Button>
            
            <Button
              onClick={onManagePayment}
              variant="outline"
              className="flex items-center gap-2 hover:bg-[#68BEB9]/10 border-[#68BEB9]/40 text-[#3E5A6B]"
              size="lg"
            >
              <Shield className="w-5 h-5" />
              Payment Methods
            </Button>
            
            <Button
              onClick={onUpgradePlan}
              className="flex items-center gap-2 bg-[#68BEB9] hover:bg-[#5AA8A3] text-white shadow-md"
              size="lg"
            >
              <TrendingUp className="w-5 h-5" />
              Upgrade Plan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
