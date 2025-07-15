import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Crown, Zap, Users } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { CustomerPortalButton } from '@/components/subscription/CustomerPortalButton';

const getPlanInfo = (plan: string) => {
  switch (plan) {
    case 'free_trial':
      return {
        name: 'Free Trial',
        color: 'bg-blue-100 text-blue-800',
        icon: Calendar,
        features: ['Full access', '200 posts/month', 'All features']
      };
    case 'sprout':
      return {
        name: 'Sprout',
        color: 'bg-green-100 text-green-800',
        icon: Zap,
        features: ['Unlimited posts', '10 connections', 'Priority support']
      };
    case 'bloom':
      return {
        name: 'Bloom',
        color: 'bg-purple-100 text-purple-800',
        icon: Crown,
        features: ['Everything in Sprout', 'Team features', 'Advanced analytics']
      };
    case 'expired':
      return {
        name: 'Expired',
        color: 'bg-red-100 text-red-800',
        icon: Calendar,
        features: ['Limited access', 'Upgrade to continue']
      };
    default:
      return {
        name: 'Free',
        color: 'bg-gray-100 text-gray-800',
        icon: Calendar,
        features: ['Basic features', 'Limited access']
      };
  }
};

export const SubscriptionCard = () => {
  const { subscription, loading, trialDaysLeft, isTrialExpired } = useSubscription();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No subscription found</p>
        </CardContent>
      </Card>
    );
  }

  const planInfo = getPlanInfo(subscription.plan);
  const PlanIcon = planInfo.icon;
  const endDate = new Date(subscription.end_date);
  const isTrialPlan = subscription.plan === 'free_trial';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PlanIcon className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <Badge className={planInfo.color}>
            {planInfo.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Status */}
        <div className="space-y-3">
          {isTrialPlan && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 text-blue-800">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">
                  {isTrialExpired ? 'Trial Expired' : `${trialDaysLeft} days left in trial`}
                </span>
              </div>
              {!isTrialExpired && (
                <p className="text-sm text-blue-600 mt-1">
                  Your trial ends on {endDate.toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {!isTrialPlan && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 text-green-800">
                <Users className="h-4 w-4" />
                <span className="font-medium">Active Subscription</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Billed {subscription.billing_interval || 'monthly'} • Next billing: {endDate.toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Plan Features */}
        <div>
          <h4 className="font-medium mb-3">Plan includes:</h4>
          <ul className="space-y-2">
            {planInfo.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {(isTrialPlan || isTrialExpired) && (
            <Button className="flex-1">
              Upgrade Plan
            </Button>
          )}
          {!isTrialPlan && !isTrialExpired && (
            <CustomerPortalButton 
              variant="outline" 
              className="flex-1"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};