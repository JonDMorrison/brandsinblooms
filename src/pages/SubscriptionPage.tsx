
import { useState } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Crown, User, CreditCard, Receipt, Settings as SettingsIcon, Mail, Shield, Users, Building } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SubscriptionPage = () => {
  const { subscription, trialDaysLeft, refreshSubscription } = useSubscription();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!subscription) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary font-medium">Loading account information...</p>
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
      toast.success('Account information refreshed');
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      toast.error('Failed to refresh account information');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen bg-garden-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-garden-green-dark mb-2 flex items-center gap-3">
            <SettingsIcon className="h-8 w-8" />
            Account Settings
          </h1>
          <p className="text-garden-green">
            Manage your subscription, billing, and account preferences
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Current Plan Card */}
          <Card className="lg:col-span-2">
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

          {/* Account Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600 break-all">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    Joined {user?.created_at ? formatDate(user.created_at) : 'Recently'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Email verified</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Features Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Plan Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Included in your plan:</h4>
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
              </div>

              <div>
                <h4 className="font-semibold mb-3">Plan Actions:</h4>
                <div className="space-y-3">
                  {(subscription?.plan === 'free_trial' || subscription?.plan === 'expired') && (
                    <Button 
                      onClick={handleUpgrade}
                      className="w-full bg-garden-green hover:bg-garden-green-dark"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Choose a Plan
                    </Button>
                  )}
                  
                  {(subscription?.plan === 'sprout') && (
                    <Button 
                      onClick={handleUpgrade}
                      variant="outline"
                      className="w-full border-garden-green text-garden-green hover:bg-garden-green hover:text-white"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Bloom
                    </Button>
                  )}

                  <Button 
                    onClick={handleRefreshSubscription}
                    variant="outline"
                    className="w-full"
                  >
                    Refresh Status
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Management Card */}
        {(subscription?.plan === 'sprout' || subscription?.plan === 'bloom') && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Billing & Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Payment Management</h4>
                  <p className="text-gray-600 mb-4 text-sm">
                    Update payment methods, view invoices, and manage your billing information through the Stripe customer portal.
                  </p>
                  <Button 
                    onClick={handleManageBilling}
                    disabled={loading}
                    className="bg-garden-green hover:bg-garden-green-dark"
                  >
                    {loading ? 'Opening...' : 'Manage Billing'}
                  </Button>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Billing History</h4>
                  <p className="text-gray-600 mb-4 text-sm">
                    Access your complete billing history, download invoices, and view payment details.
                  </p>
                  <Button 
                    onClick={handleManageBilling}
                    disabled={loading}
                    variant="outline"
                    className="border-garden-green text-garden-green hover:bg-garden-green hover:text-white"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    View Invoices
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => navigate('/team')}
                variant="outline"
                className="flex-1"
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Team
              </Button>
              
              <Button 
                onClick={() => navigate('/profile')}
                variant="outline"
                className="flex-1"
              >
                <Building className="h-4 w-4 mr-2" />
                Company Profile
              </Button>
              
              <Separator orientation="vertical" className="hidden sm:block h-10" />
              
              <Button 
                onClick={handleSignOut}
                variant="destructive"
                className="flex-1"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubscriptionPage;
