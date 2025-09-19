
import { useAuth } from "@/contexts/AuthContext";

interface SubscriptionGateProps {
  requiredPlan: 'free_trial' | 'sprout' | 'bloom';
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const SubscriptionGate = ({ 
  requiredPlan, 
  feature, 
  children, 
  fallback 
}: SubscriptionGateProps) => {
  const { user } = useAuth();

  // Allow access if user is not authenticated (for public pages)
  if (!user) {
    return <>{children}</>;
  }

  // Under the new plan, all users have access to all features
  return <>{children}</>;
};
