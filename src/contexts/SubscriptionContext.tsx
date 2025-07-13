
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
  updateSubscription: (plan: SubscriptionPlan, billingInterval: BillingInterval) => Promise<void>;
  checkAccess: (requiredPlan: SubscriptionPlan) => boolean;
  refreshSubscription: () => Promise<void>;
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  // Check if current user is a developer with super admin access OR a test account
  const isDeveloper = user?.email ? isSuperAdmin(user.email) : false;
  const isTestUser = user?.email ? isTestAccount(user.email) : false;
  const hasPrivilegedAccess = isDeveloper || isTestUser;

  // Fetch tenant data directly in this component instead of using useTenant hook
  useEffect(() => {
    let isMounted = true;

    const fetchTenant = async () => {
      if (!user) {
        if (isMounted) {
          setTenantLoading(false);
        }
        return;
      }

      try {
        // First get the user's tenant_id from the users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .single();

        if (!isMounted) return;

        if (userError || !userData?.tenant_id) {
          // User not assigned to a tenant yet
          setTenantLoading(false);
          return;
        }

        // Then fetch the tenant details
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', userData.tenant_id)
          .single();

        if (!isMounted) return;

        if (tenantError) {
          console.error('Error fetching tenant:', tenantError);
        } else {
          setTenant(tenantData);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error in fetchTenant:', error);
        }
      } finally {
        if (isMounted) {
          setTenantLoading(false);
        }
      }
    };

    fetchTenant();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const createDefaultSubscription = async () => {
    if (!user) return null;

    try {
      // Creating default subscription for user
      
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
          console.error('Error creating test account subscription:', error);
          return null;
        }

        // Created PRO subscription for test account
        return data;
      }

      // Regular trial subscription for non-test accounts - now 7 days instead of 14
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
        console.error('Error creating subscription:', error);
        return null;
      }

      // Created new 7-day trial subscription
      return data;
    } catch (error) {
      console.error('Error in createDefaultSubscription:', error);
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
        console.error('Error updating subscription:', error);
        toast.error('Failed to update subscription');
        return;
      }

      setSubscription(data);
      if (plan !== 'expired') {
        toast.success(`Successfully upgraded to ${plan} plan!`);
      }
    } catch (error) {
      console.error('Error in updateSubscriptionPlan:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const fetchSubscription = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetching subscription for user
      
      // Ensure test accounts have PRO access
      if (isTestUser) {
        await ensureTestAccountHasProAccess(user.id, user.email!);
      }

      // In tenant model, subscription is still tied to the user who created the tenant
      // So we always query by user_id, not tenant_id
      
      // First check if there are multiple subscriptions for this user
      const { data: allSubscriptions, error: countError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (countError) {
        console.error('Error fetching subscription:', countError);
        toast.error('Failed to load subscription information');
        return;
      }

      let data = null;
      
      if (allSubscriptions && allSubscriptions.length > 1) {
        // Found multiple subscriptions for user, using most recent
        data = allSubscriptions[0]; // Use the most recent one
        
        // Clean up duplicates by keeping only the most recent one
        const duplicateIds = allSubscriptions.slice(1).map(sub => sub.id);
        if (duplicateIds.length > 0) {
          // Cleaning up duplicate subscriptions
          await supabase
            .from('subscriptions')
            .delete()
            .in('id', duplicateIds);
        }
      } else if (allSubscriptions && allSubscriptions.length === 1) {
        data = allSubscriptions[0];
      }

      if (data) {
        // Found existing subscription
        setSubscription(data);
        
        // Check if trial has expired and update if needed (skip for privileged users)
        const endDate = new Date(data.end_date);
        const now = new Date();
        
        if (data.plan === 'free_trial' && now > endDate && !hasPrivilegedAccess) {
          await updateSubscriptionPlan('expired', data.billing_interval);
        }
      } else {
        // No subscription found, creating default subscription
        // Create a default subscription if none exists
        const newSubscription = await createDefaultSubscription();
        if (newSubscription) {
          setSubscription(newSubscription);
        }
      }
    } catch (error) {
      console.error('Error in fetchSubscription:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkStripeSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking Stripe subscription:', error);
        return;
      }

      // Stripe subscription check result
      
      // If Stripe returns subscription data, refresh our local state
      if (data && (data.subscribed || data.plan)) {
        await fetchSubscription();
      }
    } catch (error) {
      console.error('Error in checkStripeSubscription:', error);
    }
  };

  const updateSubscription = async (plan: SubscriptionPlan, billingInterval: BillingInterval) => {
    await updateSubscriptionPlan(plan, billingInterval);
  };

  const refreshSubscription = async () => {
    setLoading(true);
    await fetchSubscription();
    await checkStripeSubscription();
    
    // Show success message after refresh
    toast.success('Subscription status updated');
  };

  const checkAccess = (requiredPlan: SubscriptionPlan): boolean => {
    // Privileged access: super admins and test accounts have access to everything
    if (hasPrivilegedAccess) {
      // Privileged access granted
      return true;
    }

    if (!subscription) return false;
    
    // Give trial users full Bloom-level access
    const planHierarchy = {
      'expired': 0,
      'free_trial': 3, // Now equivalent to Bloom level
      'sprout': 2,
      'bloom': 3
    };

    return planHierarchy[subscription.plan] >= planHierarchy[requiredPlan];
  };

  // Modified to account for privileged access
  const isTrialExpired = subscription?.plan === 'expired' && !hasPrivilegedAccess;

  const trialDaysLeft = (() => {
    // Calculating trial days left
    
    // Privileged access: show as if they have unlimited time
    if (hasPrivilegedAccess) {
      // Privileged access, showing unlimited trial
      return 999; // Show a high number for privileged users
    }
    
    if (!subscription || subscription.plan !== 'free_trial') {
      // Not a free trial, returning 0 days
      return 0;
    }
    
    const endDate = new Date(subscription.end_date);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const daysLeft = Math.max(0, diffDays);
    // Trial days calculation completed
    
    return daysLeft;
  })();

  useEffect(() => {
    if (user && !tenantLoading) {
      fetchSubscription();
      // Also check with Stripe on load
      checkStripeSubscription();
    }
  }, [user, tenant, tenantLoading]);

  // Enhanced trial expiration handling - skip for privileged users
  useEffect(() => {
    if (subscription && subscription.plan === 'expired' && !hasPrivilegedAccess) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/pricing' && currentPath !== '/auth' && !currentPath.startsWith('/subscription')) {
        navigate('/pricing');
        toast.error('Your free trial has ended. Choose a plan to continue accessing premium features.');
      }
    }
  }, [subscription, navigate, hasPrivilegedAccess]);

  // Auto-refresh subscription status periodically when user is active
  useEffect(() => {
    if (!user || !subscription) return;

    const interval = setInterval(() => {
      // Only auto-refresh if user is on a trial or paid plan
      if (subscription.plan === 'free_trial' || subscription.plan === 'sprout' || subscription.plan === 'bloom') {
        checkStripeSubscription();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user, subscription]);

  const value = {
    subscription,
    loading,
    isTrialExpired,
    trialDaysLeft,
    updateSubscription,
    checkAccess,
    refreshSubscription
  };

  // Providing subscription context value

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
