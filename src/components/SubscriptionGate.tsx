
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdmin } from "@/utils/adminUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const { checkAccess, subscription } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check if current user is a developer with super admin access
  const isDeveloper = user?.email ? isSuperAdmin(user.email) : false;

  // Production feature access control for super admins
  if (isDeveloper) {
    return <>{children}</>;
  }

  const hasAccess = checkAccess(requiredPlan);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  const getPlanName = (plan: string) => {
    switch (plan) {
      case 'sprout': return 'Sprout';
      case 'bloom': return 'Bloom';
      default: return 'Premium';
    }
  };

  return (
    <Card className="border-2 border-dashed border-gray-300">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Lock className="h-6 w-6 text-gray-600" />
        </div>
        <CardTitle className="text-lg text-gray-700">
          {getPlanName(requiredPlan)} Feature
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-gray-600 mb-4">
          {feature} is available with the {getPlanName(requiredPlan)} plan or higher.
        </p>
        <Button onClick={handleUpgrade} className="bg-garden-green hover:bg-garden-green-dark">
          <Crown className="h-4 w-4 mr-2" />
          Upgrade to {getPlanName(requiredPlan)}
        </Button>
      </CardContent>
    </Card>
  );
};
