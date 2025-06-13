
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Star, Crown, Zap, TrendingUp, Users, Clock, Shield, Link } from "lucide-react";
import { useState, useEffect } from "react";
import { SocialConnectionManager } from "@/components/analytics/SocialConnectionManager";
import { AnalyticsSetupWizard } from "@/components/analytics/AnalyticsSetupWizard";
import { TokenUsageDashboard } from "@/components/tokens/TokenUsageDashboard";

const SubscriptionPage = () => {
  const [loading, setLoading] = useState(true);

  // Mock subscription stats
  const [stats, setStats] = useState({
    currentPlan: 'Growth',
    billingCycle: 'Monthly',
    nextBilling: 'Dec 15, 2024',
    usagePercent: 67
  });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpgradePlan = () => {
    console.log('Upgrade plan clicked');
    // Implementation for plan upgrade
  };

  const handleBillingHistory = () => {
    console.log('Billing history clicked');
    // Implementation for billing history
  };

  const handleManagePayment = () => {
    console.log('Manage payment clicked');
    // Implementation for payment management
  };

  const handleCancelSubscription = () => {
    console.log('Cancel subscription clicked');
    // Implementation for subscription cancellation
  };

  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Enhanced Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                  <CreditCard className="w-10 h-10 text-blue-600" />
                  Account Settings
                </h1>
                <p className="text-lg text-gray-600 font-medium">
                  Manage your subscription, billing, and account preferences
                </p>
                
                {/* Quick stats */}
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Crown className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{stats.currentPlan}</span> plan
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{stats.billingCycle}</span> billing
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">{stats.usagePercent}%</span> usage
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Shield className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">Next: {stats.nextBilling}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleBillingHistory}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-blue-50 border-blue-200 text-blue-700"
                  size="lg"
                >
                  <CreditCard className="w-5 h-5" />
                  Billing History
                </Button>
                
                <Button
                  onClick={handleManagePayment}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-green-50 border-green-200 text-green-700"
                  size="lg"
                >
                  <Shield className="w-5 h-5" />
                  Payment Methods
                </Button>
                
                <Button
                  onClick={handleUpgradePlan}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                  size="lg"
                >
                  <Zap className="w-5 h-5" />
                  Upgrade Plan
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Account Settings Content */}
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid gap-6">
            {/* Token Usage Dashboard */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900">Token Usage & Billing</h2>
              </div>
              
              <TokenUsageDashboard />
            </div>

            {/* Current Plan Card */}
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
                    <span className="text-lg font-semibold">Growth Plan</span>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      Active
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>Next billing: {stats.nextBilling}</div>
                    <div>Billing cycle: {stats.billingCycle}</div>
                    <div>Base allowance: 100 tokens/month</div>
                    <div>Overage rate: $0.25/token</div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button 
                      onClick={handleUpgradePlan}
                      className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Upgrade
                    </Button>
                    <Button 
                      onClick={handleCancelSubscription}
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Cancel Subscription
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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
