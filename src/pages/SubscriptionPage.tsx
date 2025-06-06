import { useState } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Crown, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SubscriptionPage = () => {
  const { subscription, trialDaysLeft, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!subscription) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary font-medium">Loading subscription...</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case 'free_trial': return 'Free Trial';
      case 'sprout': return 'Sprout';
      case 'bloom': return 'Bloom';
      case 'expired': return 'Expired';
      default: return plan;
    }
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'free_trial': return 'default';
      case 'sprout': return 'secondary';
      case 'bloom': return 'default';
      case 'expired': return 'destructive';
      default: return 'default';
    }
  };

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  const handleManageBilling = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) {
        throw error;
      }

      if (data?.url) {
        // Open Stripe customer portal in a new tab
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Failed to open billing portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshSubscription = async () => {
    try {
      await refreshSubscription();
      toast.success('Subscription status refreshed');
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      toast.error('Failed to refresh subscription status');
    }
  };

  return (
    <div className="min-h-screen bg-garden-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-garden-green-dark mb-2">
            My Subscription
          </h1>
          <p className="text-garden-green">
            Manage your subscription and billing information
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Current Plan Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Plan:</span>
                  <Badge variant={getPlanBadgeVariant(subscription.plan)}>
                    {getPlanDisplayName(subscription.plan)}
                  </Badge>
                </div>
                
                {subscription.billing_interval && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Billing:</span>
                    <span className="capitalize">{subscription.billing_interval}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Start Date:</span>
                  <span>{formatDate(subscription.start_date)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">
                    {subscription.plan === 'free_trial' ? 'Trial Ends:' : 'Next Billing:'}
                  </span>
                  <span>{formatDate(subscription.end_date)}</span>
                </div>

                {subscription.plan === 'free_trial' && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Days Remaining:</span>
                    <Badge variant={trialDaysLeft <= 3 ? 'destructive' : 'default'}>
                      {trialDaysLeft} days
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Plan Features Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Plan Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {subscription.plan === 'free_trial' && (
                  <>
                    <div className="text-sm text-gray-600">✅ All features during trial</div>
                    <div className="text-sm text-gray-600">✅ Weekly AI-generated campaigns</div>
                    <div className="text-sm text-gray-600">✅ Seasonal content calendar</div>
                    <div className="text-sm text-gray-600">✅ Email + social post generation</div>
                  </>
                )}
                
                {subscription.plan === 'sprout' && (
                  <>
                    <div className="text-sm text-gray-600">✅ Weekly AI-generated campaigns</div>
                    <div className="text-sm text-gray-600">✅ Seasonal content calendar</div>
                    <div className="text-sm text-gray-600">✅ Email + social post generation</div>
                    <div className="text-sm text-gray-600">✅ 1 user</div>
                    <div className="text-sm text-gray-600">✅ Unlimited scheduling</div>
                    <div className="text-sm text-gray-600">✅ Email support</div>
                  </>
                )}
                
                {subscription.plan === 'bloom' && (
                  <>
                    <div className="text-sm text-gray-600">✅ Everything in Sprout, plus:</div>
                    <div className="text-sm text-gray-600">✅ Multi-user access</div>
                    <div className="text-sm text-gray-600">✅ Custom brand voice tuning</div>
                    <div className="text-sm text-gray-600">✅ Priority support</div>
                    <div className="text-sm text-gray-600">✅ Annual event reminders</div>
                    <div className="text-sm text-gray-600">✅ Image asset library access</div>
                    <div className="text-sm text-gray-600">✅ Monthly success check-ins</div>
                  </>
                )}
                
                {subscription.plan === 'expired' && (
                  <div className="text-sm text-red-600">
                    Your trial has expired. Choose a plan to continue.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing Management Card */}
        {(subscription?.plan === 'sprout' || subscription?.plan === 'bloom') && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Billing Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Manage your billing information, update payment methods, view invoices, and make changes to your subscription.
              </p>
              <div className="flex gap-4">
                <Button 
                  onClick={handleManageBilling}
                  disabled={loading}
                  className="bg-garden-green hover:bg-garden-green-dark"
                >
                  {loading ? 'Opening...' : 'Manage Billing'}
                </Button>
                <Button 
                  onClick={handleRefreshSubscription}
                  variant="outline"
                  className="border-garden-green text-garden-green hover:bg-garden-green hover:text-white"
                >
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          {(subscription?.plan === 'free_trial' || subscription?.plan === 'expired') && (
            <Button 
              onClick={handleUpgrade}
              className="bg-garden-green hover:bg-garden-green-dark"
            >
              <Crown className="h-4 w-4 mr-2" />
              Choose a Plan
            </Button>
          )}
          
          {(subscription?.plan === 'sprout') && (
            <Button 
              onClick={handleUpgrade}
              variant="outline"
              className="border-garden-green text-garden-green hover:bg-garden-green hover:text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Bloom
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
