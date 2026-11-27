import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { isSuperAdmin } from "@/utils/adminUtils";
import { isTestAccount } from "@/utils/testAccountUtils";
import { getBusinessProfileUserId } from "@/lib/profile/businessProfileUserId";

type SubscriptionPlan =
  | "free_trial"
  | "seed"
  | "sprout"
  | "bloom"
  | "thrive"
  | "expired";
type BillingInterval = "monthly" | "annual";

const PAID_PLANS: SubscriptionPlan[] = ["seed", "sprout", "bloom", "thrive"];

const isPaidPlan = (plan?: SubscriptionPlan | null) =>
  plan ? PAID_PLANS.includes(plan) : false;
const getEffectivePlan = (subscription: Subscription | null) =>
  subscription?.tier ?? subscription?.plan ?? null;

interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  tier: SubscriptionPlan | null;
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
  checkAccess: (requiredPlan: SubscriptionPlan) => boolean;
  refreshSubscription: () => Promise<void>;
  clearSubscriptionError: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider",
    );
  }
  return context;
};

export const SubscriptionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user, isInLimboState, forceReset } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  // Check if current user is a developer with super admin access OR a test account
  const isDeveloper = user?.email ? isSuperAdmin(user.email) : false;
  const isTestUser = user?.email ? isTestAccount(user.email) : false;
  const hasPrivilegedAccess = isDeveloper || isTestUser;

  // Initialize loading state based on whether we have a user
  useEffect(() => {
    if (!user) {
      setLoading(false);
    }
  }, []); // Run only once on mount

  const clearSubscriptionError = useCallback(() => {
    setSubscriptionError(null);
  }, []);

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

      // Optimized query - fetch only what we need with proper timeout handling
      const queryPromise = supabase
        .from("subscriptions")
        .select(
          "id, plan, tier, start_date, end_date, billing_interval, created_at, updated_at",
        )
        // Teammates use their business's subscription (the owner's).
        .eq("user_id", await getBusinessProfileUserId(user.id))
        .order("created_at", { ascending: false })
        .limit(5); // Limit results

      // Use Promise.race for proper timeout handling
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Subscription fetch timed out")),
          20000,
        ),
      );

      const result = (await Promise.race([
        queryPromise,
        timeoutPromise,
      ])) as any;

      const { data: allSubscriptions, error: countError } = result;

      if (countError) {
        setSubscriptionError(`Database error: ${countError.message}`);
        return;
      }

      // Subscription rows are written only server-side: the
      // on_auth_user_created_subscription trigger creates the trial row at
      // signup, and Stripe/admin/OAuth paths (service_role or SECURITY
      // DEFINER RPCs) change plan, tier and dates. The browser only reads.
      // If several rows exist, the most recent one is authoritative.
      const data = allSubscriptions?.[0] ?? null;

      if (data) {
        setSubscription(data);
      } else {
        console.warn("No subscription row found for user", user.id);
        setSubscription(null);
      }

      setLastCheckTime(new Date());
    } catch (error) {
      if (error instanceof Error && error.message.includes("timed out")) {
        // Set default state instead of error state to prevent app crash
        setSubscription(null);
        setSubscriptionError(null);
      } else {
        setSubscriptionError(
          `Failed to fetch subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    } finally {
      setLoading(false);
      setIsLoadingSubscription(false);
    }
  }, [user?.id]);

  const [isCheckingStripe, setIsCheckingStripe] = useState(false);
  const [lastStripeCheck, setLastStripeCheck] = useState<number>(0);

  const checkStripeSubscription = useCallback(async () => {
    if (!user?.id) return;

    // Throttle Stripe checks more aggressively (max once every 2 minutes)
    const now = Date.now();
    if (isCheckingStripe || now - lastStripeCheck < 120000) {
      return;
    }

    try {
      setIsCheckingStripe(true);
      setLastStripeCheck(now);

      // Add proper timeout handling for Stripe calls
      const stripePromise = supabase.functions.invoke("check-subscription");

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Stripe check timed out")), 30000),
      );

      const result = (await Promise.race([
        stripePromise,
        timeoutPromise,
      ])) as any;

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
      if (error instanceof Error && error.message.includes("timed out")) {
        // Don't set error state for timeouts, just continue
      } else {
        setSubscriptionError(
          `Stripe verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    } finally {
      setIsCheckingStripe(false);
    }
  }, [user?.id, fetchSubscription]);

  const refreshSubscription = useCallback(async () => {
    setLoading(true);
    setSubscriptionError(null);
    await fetchSubscription();
    await checkStripeSubscription();
  }, [fetchSubscription, checkStripeSubscription]);

  const checkAccess = useCallback(
    (requiredPlan: SubscriptionPlan) => {
      if (hasPrivilegedAccess) {
        return true;
      }

      const effectivePlan = getEffectivePlan(subscription);

      if (!effectivePlan || effectivePlan === "expired") {
        return false;
      }

      if (requiredPlan === "free_trial") {
        return true;
      }

      if (effectivePlan === "free_trial") {
        return false;
      }

      return true;
    },
    [hasPrivilegedAccess, subscription],
  );

  // Modified to account for privileged access
  const isTrialExpired =
    getEffectivePlan(subscription) === "expired" && !hasPrivilegedAccess;

  const trialDaysLeft = (() => {
    // Privileged access: show as if they have unlimited time
    if (hasPrivilegedAccess) {
      return 999; // Show a high number for privileged users
    }

    if (!subscription || getEffectivePlan(subscription) !== "free_trial") {
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
      setLoading(false);
      setSubscription(null);
      setSubscriptionError(null);
    }
  }, [user?.id]);

  // Enhanced trial expiration handling - skip for privileged users
  useEffect(() => {
    if (
      subscription &&
      getEffectivePlan(subscription) === "expired" &&
      !hasPrivilegedAccess &&
      !isInLimboState
    ) {
      const currentPath = window.location.pathname;
      if (
        currentPath !== "/pricing" &&
        currentPath !== "/auth" &&
        !currentPath.startsWith("/subscription")
      ) {
        navigate("/pricing");
      }
    }
  }, [subscription, navigate, hasPrivilegedAccess, isInLimboState]);

  // Handle limbo state detection
  useEffect(() => {
    if (isInLimboState && subscriptionError) {
      // Give user option to force reset
      setTimeout(() => {
        if (
          window.confirm(
            "Authentication error detected. Would you like to reset your session?",
          )
        ) {
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
      const effectivePlan = getEffectivePlan(subscription);
      if (
        (effectivePlan === "free_trial" || isPaidPlan(effectivePlan)) &&
        !subscriptionError &&
        !isCheckingStripe
      ) {
        checkStripeSubscription();
      }
    }, 1800000); // Check every 30 minutes to significantly reduce load

    return () => clearInterval(interval);
  }, [user?.id, subscription?.plan, subscriptionError]);

  const value = useMemo(
    () => ({
      subscription,
      loading,
      isTrialExpired,
      trialDaysLeft,
      subscriptionError,
      lastCheckTime,
      checkAccess,
      refreshSubscription,
      clearSubscriptionError,
    }),
    [
      subscription,
      loading,
      isTrialExpired,
      trialDaysLeft,
      subscriptionError,
      lastCheckTime,
      checkAccess,
      refreshSubscription,
      clearSubscriptionError,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
