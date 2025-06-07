import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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

  const createDefaultSubscription = async () => {
    if (!user) return null;

    try {
      console.log('Creating default subscription for user:', user.id);
      
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

  const fetchSubscription = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching subscription for user:', user.id);
      
      // First try to get existing subscription
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
        console.log('Found existing subscription:', data);
        setSubscription(data);
        
        // Check if trial has expired and update if needed
        const endDate = new Date(data.end_date);
        const now = new Date();
        
        if (data.plan === 'free_trial' && now > endDate) {
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

  const checkStripeSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking Stripe subscription:', error);
        return;
      }

      console.log('Stripe subscription check result:', data);
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
  };

  const checkAccess = (requiredPlan: SubscriptionPlan): boolean => {
    if (!subscription) return false;
    
    const planHierarchy = {
      'expired': 0,
      'free_trial': 1,
      'sprout': 2,
      'bloom': 3
    };

    return planHierarchy[subscription.plan] >= planHierarchy[requiredPlan];
  };

  const isTrialExpired = subscription?.plan === 'expired';

  const trialDaysLeft = (() => {
    if (!subscription || subscription.plan !== 'free_trial') return 0;
    
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
      checkStripeSubscription();
    }
  }, [user]);

  // Check for trial expiration and redirect
  useEffect(() => {
    if (subscription && subscription.plan === 'expired') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/pricing' && currentPath !== '/auth') {
        navigate('/pricing');
        toast.error('Your free trial has ended. Choose a plan to continue.');
      }
    }
  }, [subscription, navigate]);

  const value = {
    subscription,
    loading,
    isTrialExpired,
    trialDaysLeft,
    updateSubscription,
    checkAccess,
    refreshSubscription
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
