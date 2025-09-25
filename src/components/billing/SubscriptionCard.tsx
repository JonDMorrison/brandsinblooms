import React, { useState } from 'react';
import { EnhancedAppleCard } from '@/components/ui/enhanced-apple-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Crown, Zap, Users, Sparkles, Clock, CheckCircle } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { CustomerPortalButton } from '@/components/subscription/CustomerPortalButton';
import { supabase } from '@/integrations/supabase/client';
// Removed sonner import - using global toast replacement

const getPlanInfo = (plan: string) => {
  switch (plan) {
    case 'free_trial':
      return {
        name: 'Free Trial',
        gradient: 'from-blue-500 to-indigo-600',
        bgClass: 'bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700',
        icon: Sparkles,
        features: ['Full access', '200 posts/month', 'All features', '7-day trial'],
        badge: 'Trial Active'
      };
    case 'sprout':
      return {
        name: 'Sprout',
        gradient: 'from-green-500 to-emerald-600',
        bgClass: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
        icon: Zap,
        features: ['Unlimited posts', '10 connections', 'Priority support', 'Advanced analytics'],
        badge: 'Active Plan'
      };
    case 'bloom':
      return {
        name: 'Bloom',
        gradient: 'from-purple-500 to-pink-600',
        bgClass: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20',
        icon: Crown,
        features: ['Everything in Sprout', 'Team features', 'Advanced analytics', 'Custom branding'],
        badge: 'Premium Plan'
      };
    case 'expired':
      return {
        name: 'Expired',
        gradient: 'from-red-400 to-red-600',
        bgClass: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20',
        icon: Calendar,
        features: ['Limited access', 'Upgrade to continue'],
        badge: 'Expired'
      };
    default:
      return {
        name: 'Free',
        gradient: 'from-gray-400 to-gray-600',
        bgClass: 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/20 dark:to-gray-900/20',
        icon: Users,
        features: ['Basic features', 'Limited access'],
        badge: 'Free'
      };
  }
};

export const SubscriptionCard = () => {
  const { subscription, loading, trialDaysLeft, isTrialExpired } = useSubscription();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleUpgrade = async (plan: 'bloomsuite' = 'bloomsuite', billingInterval: 'year' = 'year') => {
    setUpgradeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan, billingInterval }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        try {
          if (window.top) {
            window.top.location.href = data.url;
          } else {
            window.location.href = data.url;
          }
        } catch {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        }
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      // Global toast replacement
      if (window.toast?.error) {
        window.toast.error('Failed to start checkout. Please try again.');
      }
    } finally {
      setUpgradeLoading(false);
    }
  };

  if (loading) {
    return (
      <EnhancedAppleCard variant="elevated" className="animate-pulse">
        <div className="p-8">
          <div className="h-8 bg-surface-secondary rounded-lg w-3/4 mb-4"></div>
          <div className="h-4 bg-surface-secondary rounded w-1/2 mb-6"></div>
          <div className="space-y-3">
            <div className="h-4 bg-surface-secondary rounded w-full"></div>
            <div className="h-4 bg-surface-secondary rounded w-2/3"></div>
          </div>
        </div>
      </EnhancedAppleCard>
    );
  }

  if (!subscription) {
    return (
      <EnhancedAppleCard variant="elevated" surface="secondary">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-surface-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-text-secondary" />
          </div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">No subscription found</h3>
          <p className="text-text-secondary">Unable to load subscription information</p>
        </div>
      </EnhancedAppleCard>
    );
  }

  const planInfo = getPlanInfo(subscription.plan);
  const PlanIcon = planInfo.icon;
  const endDate = new Date(subscription.end_date);
  const isTrialPlan = subscription.plan === 'free_trial';
  const isExpired = subscription.plan === 'expired';

  return (
    <EnhancedAppleCard 
      variant="elevated" 
      hoverEffect="medium"
      className={`relative overflow-hidden ${planInfo.bgClass} border-2 ${isExpired ? 'border-red-200' : 'border-transparent'}`}
    >
      {/* Gradient Background Accent */}
      <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${planInfo.gradient} opacity-10 rounded-full -mr-20 -mt-20`}></div>
      
      <div className="relative p-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${planInfo.gradient} text-white shadow-lg`}>
              <PlanIcon className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-text-primary">{planInfo.name}</h2>
              <div className="flex items-center space-x-3 mt-2">
                <Badge variant={isExpired ? "destructive" : "default"} className="text-xs font-medium">
                  {planInfo.badge}
                </Badge>
                {isTrialPlan && !isTrialExpired && (
                  <div className="flex items-center text-sm text-text-secondary">
                    <Clock className="h-4 w-4 mr-1" />
                    {trialDaysLeft} days left
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {!isExpired && !isTrialExpired && (
            <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${planInfo.gradient} text-white text-sm font-medium shadow-lg`}>
              Active
            </div>
          )}
        </div>

        {/* Status Section */}
        <div className="mb-8">
          {isTrialPlan && (
            <div className={`p-4 rounded-xl ${isTrialExpired ? 'bg-red-50 border border-red-200' : 'bg-white border border-gray-200'} dark:bg-gray-900/50 dark:border-gray-700`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className={`flex items-center gap-2 ${isTrialExpired ? 'text-red-800' : 'text-gray-800 dark:text-gray-200'}`}>
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">
                      {isTrialExpired ? 'Trial Expired' : `${trialDaysLeft} days left in trial`}
                    </span>
                  </div>
                  {!isTrialExpired && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Your trial ends on {endDate.toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  )}
                </div>
                {!isTrialExpired && (
                  <div className="ml-4">
                    <Button 
                      onClick={() => handleUpgrade()}
                      disabled={upgradeLoading}
                      className={`bg-gradient-to-r ${planInfo.gradient} hover:opacity-90 text-white border-0 shadow-lg`}
                      size="sm"
                    >
                      {upgradeLoading ? 'Processing...' : 'Upgrade Plan'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isTrialPlan && !isExpired && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-200 dark:bg-green-950/20">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Active Subscription</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Billed {subscription.billing_interval || 'monthly'} • Next billing: {endDate.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </p>
            </div>
          )}
        </div>


        {/* Action Section */}
        <div className="flex items-center justify-between pt-6 border-t border-border-subtle">
          <div className="flex items-center text-sm text-text-secondary">
            <Calendar className="h-4 w-4 mr-2" />
            <span className="font-medium">
              {isTrialPlan ? 'Trial ends' : 'Next billing'}: {endDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
          </div>
          
          <div className="flex space-x-3">
            {(isTrialExpired || isExpired) && (
              <Button 
                onClick={() => handleUpgrade()}
                disabled={upgradeLoading}
                className={`bg-gradient-to-r ${planInfo.gradient} hover:opacity-90 text-white border-0 shadow-lg`}
              >
                {upgradeLoading ? 'Processing...' : 'Reactivate'}
              </Button>
            )}
            {!isTrialPlan && !isTrialExpired && !isExpired && (
              <CustomerPortalButton variant="outline" />
            )}
          </div>
        </div>
      </div>
    </EnhancedAppleCard>
  );
};