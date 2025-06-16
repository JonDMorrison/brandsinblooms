
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Star, Shield, Link, Crown, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { SocialConnectionManager } from "@/components/analytics/SocialConnectionManager";
import { AnalyticsSetupWizard } from "@/components/analytics/AnalyticsSetupWizard";
import { TokenUsageDashboard } from "@/components/tokens/TokenUsageDashboard";
import { useTokens } from "@/hooks/useTokens";
import { formatDistanceToNow } from "date-fns";
import { SubscriptionHeader } from "@/components/subscription/SubscriptionHeader";
import { TokenBalanceCard } from "@/components/subscription/TokenBalanceCard";
import { CurrentPlanCard } from "@/components/subscription/CurrentPlanCard";
import { CustomerPortalButton } from "@/components/subscription/CustomerPortalButton";

const SubscriptionPage = () => {
  const [loading, setLoading] = useState(true);
  const { subscription, refreshSubscription } = useSubscription();
  const { tokenBalance, getOverageAmount, getOverageCost } = useTokens();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpgradePlan = () => {
    navigate('/pricing');
  };

  const handleBillingHistory = () => {
    // Will be handled by customer portal
    document.querySelector('[data-portal-button]')?.click();
  };

  const handleManagePayment = () => {
    // Will be handled by customer portal  
    document.querySelector('[data-portal-button]')?.click();
  };

  const handleCancelSubscription = () => {
    // Will be handled by customer portal
    document.querySelector('[data-portal-button]')?.click();
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

  const currentPlan = subscription?.plan === 'free_trial' ? 'Free Trial' : 
                    subscription?.plan === 'sprout' ? 'Sprout' :
                    subscription?.plan === 'bloom' ? 'Bloom' : 'No Plan';

  const billingCycle = subscription?.billing_interval === 'annual' ? 'Annual' : 'Monthly';
  const nextBilling = subscription?.end_date ? 
    new Date(subscription.end_date).toLocaleDateString() : 'N/A';

  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <SubscriptionHeader
          currentPlan={currentPlan}
          billingCycle={billingCycle}
          tokenUsagePercent={tokenStats.usagePercent}
          resetTime={tokenStats.resetTime}
          onBillingHistory={handleBillingHistory}
          onManagePayment={handleManagePayment}
          onUpgradePlan={handleUpgradePlan}
        />
        
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid gap-6">
            {/* Subscription Management Card */}
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="pb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Crown className="w-6 h-6 text-green-600" />
                  Subscription Management
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Current Plan</h3>
                      <p className="text-lg text-green-600 font-medium">{currentPlan}</p>
                      <p className="text-sm text-gray-600">
                        {subscription?.plan === 'free_trial' 
                          ? `Trial ends ${nextBilling}`
                          : `Next billing: ${nextBilling}`
                        }
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Billing</h3>
                      <p className="text-gray-700">{billingCycle}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Button 
                      onClick={handleUpgradePlan}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      {subscription?.plan === 'free_trial' ? 'Upgrade Now' : 'Change Plan'}
                    </Button>
                    
                    {(subscription?.plan === 'sprout' || subscription?.plan === 'bloom') && (
                      <div data-portal-button>
                        <CustomerPortalButton 
                          variant="outline"
                          className="w-full"
                        />
                      </div>
                    )}
                    
                    <Button 
                      onClick={() => refreshSubscription()}
                      variant="ghost"
                      className="w-full"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Refresh Status
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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
