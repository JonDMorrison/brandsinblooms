
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Star, Shield, Link } from "lucide-react";
import { useState, useEffect } from "react";
import { SocialConnectionManager } from "@/components/analytics/SocialConnectionManager";
import { AnalyticsSetupWizard } from "@/components/analytics/AnalyticsSetupWizard";
import { TokenUsageDashboard } from "@/components/tokens/TokenUsageDashboard";
import { useTokens } from "@/hooks/useTokens";
import { formatDistanceToNow } from "date-fns";
import { SubscriptionHeader } from "@/components/subscription/SubscriptionHeader";
import { TokenBalanceCard } from "@/components/subscription/TokenBalanceCard";
import { CurrentPlanCard } from "@/components/subscription/CurrentPlanCard";

const SubscriptionPage = () => {
  const [loading, setLoading] = useState(true);
  const { tokenBalance, getOverageAmount, getOverageCost } = useTokens();

  const [stats, setStats] = useState({
    currentPlan: 'Growth',
    billingCycle: 'Monthly',
    nextBilling: 'Dec 15, 2024',
    usagePercent: 67
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpgradePlan = () => {
    // Implementation for plan upgrade
  };

  const handleBillingHistory = () => {
    // Implementation for billing history
  };

  const handleManagePayment = () => {
    // Implementation for payment management
  };

  const handleCancelSubscription = () => {
    // Implementation for subscription cancellation
  };

  const getTokenUsageStats = () => {
    if (!tokenBalance) return { usagePercent: 0, resetTime: 'Unknown' };
    
    const baseAllowance = 100;
    const usagePercent = tokenBalance.tokens_balance < 0 ? 100 : 
      Math.round(((baseAllowance - tokenBalance.tokens_balance) / baseAllowance) * 100);
    
    const resetTime = formatDistanceToNow(new Date(tokenBalance.tokens_reset_at), { addSuffix: true });
    
    return { usagePercent, resetTime };
  };

  const tokenStats = getTokenUsageStats();

  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <SubscriptionHeader
          currentPlan={stats.currentPlan}
          billingCycle={stats.billingCycle}
          tokenUsagePercent={tokenStats.usagePercent}
          resetTime={tokenStats.resetTime}
          onBillingHistory={handleBillingHistory}
          onManagePayment={handleManagePayment}
          onUpgradePlan={handleUpgradePlan}
        />
        
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid gap-6">
            {/* Token Balance Summary Card */}
            {tokenBalance && (
              <TokenBalanceCard
                tokenBalance={tokenBalance}
                overageAmount={getOverageAmount()}
                overageCost={getOverageCost()}
                resetTime={tokenStats.resetTime}
              />
            )}

            {/* Token Usage Dashboard */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900">Detailed Token Usage & Billing</h2>
              </div>
              
              <TokenUsageDashboard />
            </div>

            {/* Current Plan Card */}
            <CurrentPlanCard
              currentPlan={stats.currentPlan}
              nextBilling={stats.nextBilling}
              billingCycle={stats.billingCycle}
              onUpgradePlan={handleUpgradePlan}
              onCancelSubscription={handleCancelSubscription}
            />

            {/* Social Media Connections Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <Link className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900">Social Media Connections</h2>
              </div>
              
              <SocialConnectionManager />
              <AnalyticsSetupWizard />
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-shadow cursor-pointer" onClick={handleManagePayment}>
                <CardContent className="p-6 text-center">
                  <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Payment Methods</h3>
                  <p className="text-gray-600 text-sm">Manage your payment methods and billing information</p>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-shadow cursor-pointer" onClick={handleBillingHistory}>
                <CardContent className="p-6 text-center">
                  <CreditCard className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Billing History</h3>
                  <p className="text-gray-600 text-sm">View and download your billing statements</p>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-shadow cursor-pointer" onClick={handleUpgradePlan}>
                <CardContent className="p-6 text-center">
                  <Star className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Upgrade Plan</h3>
                  <p className="text-gray-600 text-sm">Unlock more features with a higher tier plan</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default SubscriptionPage;
