
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Crown, ArrowRight } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
// Removed sonner import - using global toast replacement

const SubscriptionSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSubscription, subscription } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [planDetails, setPlanDetails] = useState<{
    plan: string;
    billing: string;
    amount: string;
  } | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      toast.error('Invalid session. Redirecting to pricing...');
      navigate('/pricing');
      return;
    }

    // Refresh subscription status and get plan details
    const handleSuccess = async () => {
      try {
        await refreshSubscription();
        
        // Extract plan details from URL params or subscription
        const plan = searchParams.get('plan') || subscription?.plan || 'Unknown';
        const billing = searchParams.get('billing') || subscription?.billing_interval || 'monthly';
        
        const amounts = {
          'sprout': { monthly: '$39', annual: '$32' },
          'bloom': { monthly: '$79', annual: '$66' }
        };
        
        const amount = amounts[plan as keyof typeof amounts]?.[billing as keyof typeof amounts.sprout] || 'N/A';
        
        setPlanDetails({
          plan: plan.charAt(0).toUpperCase() + plan.slice(1),
          billing: billing,
          amount: amount
        });
        
        toast.success(`Welcome to ${plan.charAt(0).toUpperCase() + plan.slice(1)}! Your subscription is now active.`);
      } catch (error) {
        console.error('Error refreshing subscription:', error);
        toast.error('There was an issue verifying your subscription. Please contact support.');
      } finally {
        setLoading(false);
      }
    };

    handleSuccess();
  }, [searchParams, refreshSubscription, subscription, navigate]);

  const handleContinue = () => {
    navigate('/app');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-garden-green border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-garden-background flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full shadow-xl">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Premium!
          </CardTitle>
          <p className="text-gray-600 text-lg">
            Your subscription has been activated successfully
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {planDetails && (
            <div className="bg-garden-green/10 rounded-lg p-6 border border-garden-green/20">
              <div className="flex items-center gap-3 mb-4">
                <Crown className="h-6 w-6 text-garden-green" />
                <h3 className="text-xl font-semibold text-garden-green-dark">
                  {planDetails.plan} Plan Activated
                </h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Plan:</span>
                  <p className="font-semibold">{planDetails.plan}</p>
                </div>
                <div>
                  <span className="text-gray-600">Billing:</span>
                  <p className="font-semibold">{planDetails.billing}</p>
                </div>
                <div>
                  <span className="text-gray-600">Amount:</span>
                  <p className="font-semibold">{planDetails.amount}/month</p>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <p className="font-semibold text-green-600">Active</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">What's Next?</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span>Access all premium features immediately</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span>Start generating unlimited content</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span>Access priority support</span>
              </li>
              {planDetails?.plan === 'Bloom' && (
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span>Multi-user access and team features</span>
                </li>
              )}
            </ul>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleContinue}
              className="w-full bg-garden-green hover:bg-garden-green-dark text-white py-3"
              size="lg"
            >
              Continue to Dashboard
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>You can manage your subscription anytime from your account settings.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccessPage;
