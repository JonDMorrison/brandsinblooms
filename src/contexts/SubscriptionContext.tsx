import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { isSuperAdmin } from "@/utils/adminUtils";
import { isTestAccount, ensureTestAccountHasProAccess } from "@/utils/testAccountUtils";

type SubscriptionPlan = 'free_trial' | 'sprout' | 'bloom' | 'expired';
type BillingInterval = 'monthly' | 'annual';

interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  start_date: string;
  end_date: string;
  billing_interval: BillingInterval;
  created_at: string;
  updated_at: string;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  isTrialExpired: boolean;
  trialDaysLeft: number;
  subscriptionError: string | null;
  lastCheckTime: Date | null;
  updateSubscription: (plan: SubscriptionPlan, billingInterval: BillingInterval) => Promise<void>;
  checkAccess: (requiredPlan: SubscriptionPlan) => boolean;
  refreshSubscription: () => Promise<void>;
  clearSubscriptionError: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isInLimboState, forceReset } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  // Check if current user is a developer with super admin access OR a test account
  const isDeveloper = user?.email ? isSuperAdmin(user.email) : false;
  const isTestUser = user?.email ? isTestAccount(user.email) : false;
  const hasPrivilegedAccess = isDeveloper || isTestUser;

  // Initialize loading state based on whether we have a user
  useEffect(() => {
    if (!user) {
      console.log('🔓 SubscriptionProvider: No user on init, setting loading to false');
      setLoading(false);
    }
  }, []); // Run only once on mount

  const clearSubscriptionError = useCallback(() => {
    setSubscriptionError(null);
  }, []);

  const createDefaultSubscription = async () => {
    if (!user) return null;

    try {
      console.log('📝 Creating default subscription for user:', user.id);
      
      // For test accounts, create PRO subscription instead of trial
      if (isTestUser) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(startDate.getFullYear() + 10); // 10 years

        const { data, error } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            plan: 'bloom', // Highest tier for test accounts
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            billing_interval: 'annual'
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error creating test account subscription:', error);
          setSubscriptionError(`Failed to create test subscription: ${error.message}`);
          return null;
        }

        console.log('✅ Created PRO subscription for test account');
        return data;
      }

      // Regular trial subscription for non-test accounts - 7 days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 7); // 7-day trial

      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan: 'free_trial',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          billing_interval: 'monthly'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating subscription:', error);
        setSubscriptionError(`Failed to create trial subscription: ${error.message}`);
        return null;
      }

      console.log('✅ Created new 7-day trial subscription');
      return data;
    } catch (error) {
      console.error('❌ Error in createDefaultSubscription:', error);
      setSubscriptionError(`Unexpected error creating subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  const updateSubscriptionPlan = async (plan: SubscriptionPlan, billingInterval: BillingInterval) => {
    if (!user || !subscription) return;

    try {
      const startDate = new Date();
      let endDate = new Date();
      
      if (plan === 'free_trial') {
        endDate.setDate(startDate.getDate() + 7); // 7-day trial
      } else if (plan === 'sprout' || plan === 'bloom') {
        if (billingInterval === 'annual') {
          endDate.setFullYear(startDate.getFullYear() + 1);
        } else {
          endDate.setMonth(startDate.getMonth() + 1);
        }
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          plan,
          billing_interval: billingInterval,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
        .eq('id', subscription.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating subscription:', error);
        setSubscriptionError(`Failed to update subscription: ${error.message}`);
        return;
      }

      setSubscription(data);
      setSubscriptionError(null);
      console.log('✅ Subscription updated successfully');
    } catch (error) {
      console.error('❌ Error in updateSubscriptionPlan:', error);
      setSubscriptionError(`Unexpected error updating subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Add request tracking to prevent duplicate requests
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [lastFetchUser, setLastFetchUser] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Prevent duplicate requests for the same user
    if (isLoadingSubscription || lastFetchUser === user.id) {
      return;
    }

    try {
      setIsLoadingSubscription(true);
      setSubscriptionError(null);
      setLastFetchUser(user.id);
      
      // Ensure test accounts have PRO access (non-blocking)
      if (isTestUser) {
        const testAccountPromise = ensureTestAccountHasProAccess(user.id, user.email!);
        testAccountPromise.catch(console.error);
      }

      // Optimized query - fetch only what we need
      const queryPromise = supabase
        .from('subscriptions')
        .select('id, plan, start_date, end_date, billing_interval, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5); // Limit results

      // Set timeout for the query
      const timeoutId = setTimeout(() => {
        throw new Error('Subscription fetch timed out');
      }, 8000);

      const result = await queryPromise;
      clearTimeout(timeoutId);

      const { data: allSubscriptions, error: countError } = result;

      if (countError) {
        setSubscriptionError(`Database error: ${countError.message}`);
        return;
      }

      let data = null;
      
      if (allSubscriptions && allSubscriptions.length > 1) {
        data = allSubscriptions[0]; // Use the most recent one
        
        // Clean up duplicates asynchronously to avoid blocking
        const duplicateIds = allSubscriptions.slice(1).map(sub => sub.id);
        if (duplicateIds.length > 0) {
          (async () => {
            try {
              await supabase
                .from('subscriptions')
                .delete()
                .in('id', duplicateIds);
              console.log('🧹 Cleaned up duplicate subscriptions');
            } catch (error) {
              console.error('Failed to cleanup duplicate subscriptions:', error);
            }
          })();
        }
      } else if (allSubscriptions && allSubscriptions.length === 1) {
        data = allSubscriptions[0];
      }

      if (data) {
        setSubscription(data);
        
        // Check expiry asynchronously to avoid blocking UI
        const endDate = new Date(data.end_date);
        const now = new Date();
        
        if (data.plan === 'free_trial' && now > endDate && !hasPrivilegedAccess) {
          (async () => {
            try {
              await updateSubscriptionPlan('expired', data.billing_interval);
              console.log('✅ Updated expired subscription');
            } catch (error) {
              console.error('Failed to update expired subscription:', error);
            }
          })();
        }
      } else {
        // Create default subscription asynchronously
        createDefaultSubscription().then(newSub => {
          if (newSub) setSubscription(newSub);
        }).catch(console.error);
      }
      
      setLastCheckTime(new Date());
    } catch (error) {
      if (error instanceof Error && error.message === 'Subscription fetch timed out') {
        setSubscriptionError('Subscription check timed out');
      } else {
        setSubscriptionError(`Failed to fetch subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
      setIsLoadingSubscription(false);
    }
  }, [user?.id, isTestUser, hasPrivilegedAccess]);

  const [isCheckingStripe, setIsCheckingStripe] = useState(false);
  const [lastStripeCheck, setLastStripeCheck] = useState<number>(0);

  const checkStripeSubscription = useCallback(async () => {
    if (!user?.id) return;

    // Throttle Stripe checks more aggressively (max once every 2 minutes)
    const now = Date.now();
    if (isCheckingStripe || (now - lastStripeCheck) < 120000) {
      return;
    }

    try {
      setIsCheckingStripe(true);
      setLastStripeCheck(now);
      
      // Add timeout for Stripe calls
      const stripePromise = supabase.functions.invoke('check-subscription');
      
      const timeoutId = setTimeout(() => {
        throw new Error('Stripe check timed out');
      }, 10000);
      
      const result = await stripePromise;
      clearTimeout(timeoutId);
      
      const { data, error } = result;
      
      if (error) {
        setSubscriptionError(`Stripe check failed: ${error.message}`);
        return;
      }
      
      // Only refresh if there's actually new data
      if (data && (data.subscribed || data.plan)) {
        setLastFetchUser(null);
        await fetchSubscription();
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Stripe check timed out') {
        console.warn('⚠️ Stripe check timed out');
      } else {
        setSubscriptionError(`Stripe verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsCheckingStripe(false);
    }
  }, [user?.id, fetchSubscription]);

  const updateSubscription = useCallback(async (plan: SubscriptionPlan, billingInterval: BillingInterval) => {
    await updateSubscriptionPlan(plan, billingInterval);
  }, []);

  const refreshSubscription = useCallback(async () => {
    console.log('🔄 Refreshing subscription data');
    setLoading(true);
    setSubscriptionError(null);
    await fetchSubscription();
    await checkStripeSubscription();
    console.log('✅ Subscription refresh completed');
  }, [fetchSubscription, checkStripeSubscription]);

  const checkAccess = useCallback((requiredPlan: SubscriptionPlan): boolean => {
    // Under the new plan, all users have access to all features
    console.log('🔓 Universal access granted - all features available to all users');
    return true;
  }, []);

  // Modified to account for privileged access
  const isTrialExpired = subscription?.plan === 'expired' && !hasPrivilegedAccess;

  const trialDaysLeft = (() => {
    // Privileged access: show as if they have unlimited time
    if (hasPrivilegedAccess) {
      return 999; // Show a high number for privileged users
    }
    
    if (!subscription || subscription.plan !== 'free_trial') {
      return 0;
    }
    
    const endDate = new Date(subscription.end_date);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  })();

  // Only fetch subscription when user changes, not on every render
  useEffect(() => {
    if (user?.id) {
      fetchSubscription();
      // Delay Stripe check much longer to let initial load complete
      const stripeTimer = setTimeout(() => {
        checkStripeSubscription();
      }, 15000); // Much longer delay to avoid startup bottleneck
      
      return () => clearTimeout(stripeTimer);
    } else {
      // Important: Clear loading state when there's no user (e.g., on landing pages)
      console.log('🔓 No user found, clearing subscription loading state');
      setLoading(false);
      setSubscription(null);
      setSubscriptionError(null);
    }
  }, [user?.id]);

  // Enhanced trial expiration handling - skip for privileged users
  useEffect(() => {
    if (subscription && subscription.plan === 'expired' && !hasPrivilegedAccess && !isInLimboState) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/pricing' && currentPath !== '/auth' && !currentPath.startsWith('/subscription')) {
        console.log('⚠️ Trial expired, redirecting to pricing');
        navigate('/pricing');
      }
    }
  }, [subscription, navigate, hasPrivilegedAccess, isInLimboState]);

  // Handle limbo state detection
  useEffect(() => {
    if (isInLimboState && subscriptionError) {
      console.log('🚨 Limbo state detected with subscription error, forcing reset');
      // Give user option to force reset
      setTimeout(() => {
        if (window.confirm('Authentication error detected. Would you like to reset your session?')) {
          forceReset();
        }
      }, 2000);
    }
  }, [isInLimboState, subscriptionError, forceReset]);

  // Auto-refresh subscription status periodically when user is active (much less frequent)
  useEffect(() => {
    if (!user?.id || !subscription) return;

    const interval = setInterval(() => {
      // Only auto-refresh if user is on a trial or paid plan and no errors
      if ((subscription.plan === 'free_trial' || subscription.plan === 'sprout' || subscription.plan === 'bloom') && !subscriptionError && !isCheckingStripe) {
        checkStripeSubscription();
      }
    }, 1800000); // Check every 30 minutes to significantly reduce load

    return () => clearInterval(interval);
  }, [user?.id, subscription?.plan, subscriptionError]);

  const value = useMemo(() => ({
    subscription,
    loading,
    isTrialExpired,
    trialDaysLeft,
    subscriptionError,
    lastCheckTime,
    updateSubscription,
    checkAccess,
    refreshSubscription,
    clearSubscriptionError
  }), [
    subscription,
    loading,
    isTrialExpired,
    trialDaysLeft,
    subscriptionError,
    lastCheckTime,
    updateSubscription,
    checkAccess,
    refreshSubscription,
    clearSubscriptionError
  ]);

  console.log('🔍 SubscriptionProvider render:', { 
    hasSubscription: !!subscription, 
    loading, 
    subscriptionError,
    isInLimboState,
    hasPrivilegedAccess,
    lastCheckTime 
  });

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
