import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Zap, Users } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UsageData {
  postsCreated: number;
  maxPosts: number;
  connectionsUsed: number;
  maxConnections: number;
  tokensUsed: number;
  maxTokens: number;
}

export const UsageAnalytics = () => {
  const { subscription, loading } = useSubscription();
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<UsageData>({
    postsCreated: 0,
    maxPosts: 0,
    connectionsUsed: 0,
    maxConnections: 0,
    tokensUsed: 0,
    maxTokens: 100,
  });
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    const fetchUsageData = async () => {
      if (!user || !subscription) {
        setUsageLoading(false);
        return;
      }

      try {
        // Get current month's content tasks count
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: postsCount } = await supabase
          .from('content_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString());

        // Get social connections count
        const { count: connectionsCount } = await supabase
          .from('social_connections')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true);

        // Get company profile for token balance
        const { data: profile } = await supabase
          .from('company_profiles')
          .select('tokens_balance')
          .eq('user_id', user.id)
          .single();

        // Set limits based on subscription plan
        const limits = {
          'free_trial': { posts: 200, connections: 4, tokens: 100 },
          'sprout': { posts: 1000, connections: 10, tokens: 500 },
          'bloom': { posts: -1, connections: 25, tokens: 1000 }, // -1 means unlimited
          'expired': { posts: 0, connections: 0, tokens: 0 },
        };

        const planLimits = limits[subscription.plan as keyof typeof limits] || limits.expired;
        const tokensUsed = Math.max(0, (profile?.tokens_balance || 100) - planLimits.tokens);

        setUsageData({
          postsCreated: postsCount || 0,
          maxPosts: planLimits.posts,
          connectionsUsed: connectionsCount || 0,
          maxConnections: planLimits.connections,
          tokensUsed,
          maxTokens: planLimits.tokens,
        });
      } catch (error) {
        console.error('Error fetching usage data:', error);
      } finally {
        setUsageLoading(false);
      }
    };

    fetchUsageData();
  }, [user, subscription]);

  if (loading || usageLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                  <div className="h-2 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getUsagePercentage = (used: number, max: number) => {
    if (max === -1) return 0; // Unlimited
    return Math.min((used / max) * 100, 100);
  };

  const getUsageStatus = (used: number, max: number) => {
    const percentage = getUsagePercentage(used, max);
    if (max === -1) return 'unlimited';
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'normal';
  };

  const usageMetrics = [
    {
      label: 'Posts This Month',
      used: usageData.postsCreated,
      max: usageData.maxPosts,
      icon: TrendingUp,
      color: 'text-blue-600',
    },
    {
      label: 'Social Connections',
      used: usageData.connectionsUsed,
      max: usageData.maxConnections,
      icon: Users,
      color: 'text-green-600',
    },
    {
      label: 'AI Tokens Used',
      used: usageData.tokensUsed,
      max: usageData.maxTokens,
      icon: Zap,
      color: 'text-purple-600',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Usage Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {usageMetrics.map((metric, index) => {
            const Icon = metric.icon;
            const percentage = getUsagePercentage(metric.used, metric.max);
            const status = getUsageStatus(metric.used, metric.max);

            return (
              <div key={index} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${metric.color}`} />
                    <span className="font-medium text-sm">{metric.label}</span>
                  </div>
                  {status === 'unlimited' && (
                    <Badge variant="secondary" className="text-xs">Unlimited</Badge>
                  )}
                  {status === 'critical' && (
                    <Badge variant="destructive" className="text-xs">Limit Reached</Badge>
                  )}
                  {status === 'warning' && (
                    <Badge variant="outline" className="text-xs text-orange-600">Near Limit</Badge>
                  )}
                </div>

                {metric.max !== -1 && (
                  <Progress 
                    value={percentage} 
                    className="h-2"
                  />
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {metric.used.toLocaleString()} {metric.max === -1 ? 'used' : `of ${metric.max.toLocaleString()}`}
                  </span>
                  {metric.max !== -1 && (
                    <span className="font-medium">
                      {Math.round(percentage)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Usage Insights */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50">
          <h4 className="font-medium mb-2">Usage Insights</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            {usageData.postsCreated > 0 && (
              <p>• You've created {usageData.postsCreated} posts this month</p>
            )}
            {usageData.connectionsUsed > 0 && (
              <p>• {usageData.connectionsUsed} social accounts connected</p>
            )}
            {subscription?.plan === 'free_trial' && (
              <p>• Upgrade to unlock higher limits and premium features</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};