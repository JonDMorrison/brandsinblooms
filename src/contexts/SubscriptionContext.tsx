
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { isSuperAdmin } from "@/utils/adminUtils";

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

  // Check if current user is a developer with super admin access
  const isDeveloper = user?.email ? isSuperAdmin(user.email) : false;

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
          console.log('User not assigned to a tenant yet');
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
      console.log('Creating default subscription for user:', user.id, 'tenant:', tenant?.id || 'none');
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 14); // 14-day trial

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

      console.log('Created new subscription:', data);
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
        endDate.setDate(startDate.getDate() + 14);
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
      console.log('Fetching subscription for user:', user.id, 'tenant:', tenant?.id || 'none');
      
      // In tenant model, subscription is still tied to the user who created the tenant
      // So we always query by user_id, not tenant_id
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        toast.error('Failed to load subscription information');
        return;
      }

      if (data) {
        console.log('Found existing subscription:', data.plan, 'for user:', user.id);
        setSubscription(data);
        
        // Check if trial has expired and update if needed
        const endDate = new Date(data.end_date);
        const now = new Date();
        
        if (data.plan === 'free_trial' && now > endDate && !isDeveloper) {
          await updateSubscriptionPlan('expired', data.billing_interval);
        }
      } else {
        console.log('No subscription found, creating default subscription');
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

      console.log('Stripe subscription check result:', data);
      
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
    // Developer bypass: super admins have access to everything
    if (isDeveloper) {
      console.log('Developer bypass: granting access to', user?.email);
      return true;
    }

    if (!subscription) return false;
    
    const planHierarchy = {
      'expired': 0,
      'free_trial': 1,
      'sprout': 2,
      'bloom': 3
    };

    return planHierarchy[subscription.plan] >= planHierarchy[requiredPlan];
  };

  // Modified to account for developer bypass
  const isTrialExpired = subscription?.plan === 'expired' && !isDeveloper;

  const trialDaysLeft = (() => {
    console.log('SubscriptionContext: Calculating trialDaysLeft', {
      subscription: subscription,
      plan: subscription?.plan,
      endDate: subscription?.end_date,
      isDeveloper
    });
    
    // Developer bypass: show as if they have unlimited time
    if (isDeveloper) {
      console.log('SubscriptionContext: Developer bypass, showing unlimited trial');
      return 999; // Show a high number for developers
    }
    
    if (!subscription || subscription.plan !== 'free_trial') {
      console.log('SubscriptionContext: Not a free trial, returning 0 days');
      return 0;
    }
    
    const endDate = new Date(subscription.end_date);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const daysLeft = Math.max(0, diffDays);
    console.log('SubscriptionContext: Trial days calculation', {
      endDate: endDate.toISOString(),
      now: now.toISOString(),
      diffTime,
      diffDays,
      daysLeft
    });
    
    return daysLeft;
  })();

  useEffect(() => {
    if (user && !tenantLoading) {
      fetchSubscription();
      // Also check with Stripe on load
      checkStripeSubscription();
    }
  }, [user, tenant, tenantLoading]);

  // Enhanced trial expiration handling - skip for developers
  useEffect(() => {
    if (subscription && subscription.plan === 'expired' && !isDeveloper) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/pricing' && currentPath !== '/auth' && !currentPath.startsWith('/subscription')) {
        navigate('/pricing');
        toast.error('Your free trial has ended. Choose a plan to continue accessing premium features.');
      }
    }
  }, [subscription, navigate, isDeveloper]);

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

  console.log('SubscriptionContext: Providing context value', {
    subscription: subscription?.plan,
    loading,
    isTrialExpired,
    trialDaysLeft,
    isDeveloper
  });

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
