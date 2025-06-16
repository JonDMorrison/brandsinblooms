
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, Zap, Users, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface UpgradePromptProps {
  feature: string;
  variant?: 'content' | 'team' | 'analytics' | 'priority';
  compact?: boolean;
}

export const UpgradePrompt = ({ feature, variant = 'content', compact = false }: UpgradePromptProps) => {
  const navigate = useNavigate();
  const { subscription } = useSubscription();

  // Don't show if user already has a paid plan
  if (subscription?.plan === 'sprout' || subscription?.plan === 'bloom') {
    return null;
  }

  const prompts = {
    content: {
      icon: Zap,
      title: "Unlock Unlimited Content",
      description: "Generate unlimited campaigns and content with premium plans",
      cta: "Upgrade Now"
    },
    team: {
      icon: Users,
      title: "Team Features Available",
      description: "Add team members and collaborate with Bloom plan",
      cta: "Upgrade to Bloom"
    },
    analytics: {
      icon: Clock,
      title: "Advanced Analytics",
      description: "Get detailed insights and performance tracking",
      cta: "See Plans"
    },
    priority: {
      icon: Crown,
      title: "Priority Support",
      description: "Get faster responses and dedicated support",
      cta: "Upgrade"
    }
  };

  const prompt = prompts[variant];
  const Icon = prompt.icon;

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">{prompt.title}</p>
            <p className="text-xs text-gray-600">{prompt.description}</p>
          </div>
        </div>
        <Button 
          onClick={handleUpgrade}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          {prompt.cta}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-2 border-dashed border-blue-300 bg-blue-50/50">
      <CardContent className="p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">
          {prompt.title}
        </h3>
        <p className="text-gray-600 mb-4">
          {prompt.description}
        </p>
        <Button 
          onClick={handleUpgrade}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Crown className="h-4 w-4 mr-2" />
          {prompt.cta}
        </Button>
      </CardContent>
    </Card>
  );
};

export const TrialEndingSoon = ({ daysLeft }: { daysLeft: number }) => {
  const navigate = useNavigate();

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-900">
              Trial ending in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-orange-700">
              Upgrade now to keep all your content and campaigns
            </p>
          </div>
          <Button 
            onClick={() => navigate('/pricing')}
            size="sm"
            className="bg-orange-600 hover:bg-orange-700"
          >
            Upgrade
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
