import { createContext, useContext, useEffect, useState } from "react";
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

  const clearSubscriptionError = () => {
    setSubscriptionError(null);
  };

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

  const fetchSubscription = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching subscription for user:', user.id);
      setSubscriptionError(null);
      
      // Ensure test accounts have PRO access
      if (isTestUser) {
        await ensureTestAccountHasProAccess(user.id, user.email!);
      }

      // Fetch subscription from database
      const { data: allSubscriptions, error: countError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (countError) {
        console.error('❌ Error fetching subscription:', countError);
        setSubscriptionError(`Database error: ${countError.message}`);
        return;
      }

      let data = null;
      
      if (allSubscriptions && allSubscriptions.length > 1) {
        console.log(`📊 Found ${allSubscriptions.length} subscriptions for user, using most recent`);
        data = allSubscriptions[0]; // Use the most recent one
        
        // Clean up duplicates by keeping only the most recent one
        const duplicateIds = allSubscriptions.slice(1).map(sub => sub.id);
        if (duplicateIds.length > 0) {
          console.log('🧹 Cleaning up duplicate subscriptions');
          await supabase
            .from('subscriptions')
            .delete()
            .in('id', duplicateIds);
        }
      } else if (allSubscriptions && allSubscriptions.length === 1) {
        data = allSubscriptions[0];
      }

      if (data) {
        console.log('✅ Found existing subscription:', { plan: data.plan, endDate: data.end_date });
        setSubscription(data);
        
        // Check if trial has expired and update if needed (skip for privileged users)
        const endDate = new Date(data.end_date);
        const now = new Date();
        
        if (data.plan === 'free_trial' && now > endDate && !hasPrivilegedAccess) {
          console.log('⚠️ Trial has expired, updating to expired status');
          await updateSubscriptionPlan('expired', data.billing_interval);
        }
      } else {
        console.log('❌ No subscription found, creating default subscription');
        const newSubscription = await createDefaultSubscription();
        if (newSubscription) {
          setSubscription(newSubscription);
        }
      }
      
      setLastCheckTime(new Date());
    } catch (error) {
      console.error('❌ Error in fetchSubscription:', error);
      setSubscriptionError(`Failed to fetch subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const checkStripeSubscription = async () => {
    if (!user) return;

    try {
      console.log('💳 Checking Stripe subscription status');
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('❌ Error checking Stripe subscription:', error);
        setSubscriptionError(`Stripe check failed: ${error.message}`);
        return;
      }

      console.log('💳 Stripe subscription check result:', data);
      
      // If Stripe returns subscription data, refresh our local state
      if (data && (data.subscribed || data.plan)) {
        console.log('🔄 Stripe data found, refreshing local subscription');
        await fetchSubscription();
      }
    } catch (error) {
      console.error('❌ Error in checkStripeSubscription:', error);
      setSubscriptionError(`Stripe verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const updateSubscription = async (plan: SubscriptionPlan, billingInterval: BillingInterval) => {
    await updateSubscriptionPlan(plan, billingInterval);
  };

  const refreshSubscription = async () => {
    console.log('🔄 Refreshing subscription data');
    setLoading(true);
    setSubscriptionError(null);
    await fetchSubscription();
    await checkStripeSubscription();
    console.log('✅ Subscription refresh completed');
  };

  const checkAccess = (requiredPlan: SubscriptionPlan): boolean => {
    // Privileged access: super admins and test accounts have access to everything
    if (hasPrivilegedAccess) {
      console.log('🔓 Privileged access granted');
      return true;
    }

    if (!subscription) {
      console.log('❌ No subscription found, access denied');
      return false;
    }
    
    // Give trial users full Bloom-level access
    const planHierarchy = {
      'expired': 0,
      'free_trial': 3, // Equivalent to Bloom level
      'sprout': 2,
      'bloom': 3
    };

    const hasAccess = planHierarchy[subscription.plan] >= planHierarchy[requiredPlan];
    console.log('🔍 Access check:', { 
      userPlan: subscription.plan, 
      requiredPlan, 
      hasAccess 
    });
    
    return hasAccess;
  };

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

  useEffect(() => {
    if (user) {
      fetchSubscription();
      // Also check with Stripe on load
      setTimeout(() => {
        checkStripeSubscription();
      }, 1000); // Delay Stripe check to avoid overloading
    }
  }, [user]);

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

  // Auto-refresh subscription status periodically when user is active
  useEffect(() => {
    if (!user || !subscription) return;

    const interval = setInterval(() => {
      // Only auto-refresh if user is on a trial or paid plan and no errors
      if ((subscription.plan === 'free_trial' || subscription.plan === 'sprout' || subscription.plan === 'bloom') && !subscriptionError) {
        checkStripeSubscription();
      }
    }, 300000); // Check every 5 minutes instead of every minute

    return () => clearInterval(interval);
  }, [user, subscription, subscriptionError]);

  const value = {
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
  };

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
