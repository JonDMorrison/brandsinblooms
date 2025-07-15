import React, { useState, useEffect } from 'react';
import { EnhancedAppleCard } from '@/components/ui/enhanced-apple-card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Zap, Users, Activity, Calendar, FileText } from 'lucide-react';
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
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">Usage Analytics</h2>
            <p className="text-text-secondary mt-1">Monitor your current usage and performance metrics</p>
          </div>
          <div className="animate-pulse h-5 w-20 bg-surface-secondary rounded"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <EnhancedAppleCard key={i} variant="elevated" className="animate-pulse">
              <div className="p-6 space-y-4">
                <div className="h-6 bg-surface-secondary rounded w-2/3"></div>
                <div className="h-8 bg-surface-secondary rounded w-1/3"></div>
                <div className="h-2 bg-surface-secondary rounded"></div>
                <div className="h-4 bg-surface-secondary rounded w-1/2"></div>
              </div>
            </EnhancedAppleCard>
          ))}
        </div>
      </div>
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Usage Analytics</h2>
          <p className="text-text-secondary mt-1">Monitor your current usage and performance metrics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium text-text-primary">Live Tracking</span>
        </div>
      </div>

      {/* Main Usage Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {usageMetrics.map((metric, index) => {
          const Icon = metric.icon;
          const percentage = getUsagePercentage(metric.used, metric.max);
          const status = getUsageStatus(metric.used, metric.max);

          return (
            <EnhancedAppleCard 
              key={index} 
              variant="elevated" 
              hoverEffect="subtle" 
              animated={true}
              staggerDelay={index * 100}
              className="group"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 ${index === 0 ? 'bg-blue-100 dark:bg-blue-900/20' : index === 1 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-purple-100 dark:bg-purple-900/20'} rounded-lg`}>
                      <Icon className={`h-5 w-5 ${index === 0 ? 'text-blue-600 dark:text-blue-400' : index === 1 ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary">{metric.label}</h3>
                      <p className="text-xs text-text-secondary">Current period</p>
                    </div>
                  </div>
                  <Badge 
                    variant={status === 'critical' ? 'destructive' : status === 'warning' ? 'outline' : 'secondary'} 
                    className="text-xs"
                  >
                    {status === 'unlimited' ? 'Unlimited' : status === 'critical' ? 'Limit Reached' : status === 'warning' ? 'Near Limit' : Math.round(percentage) + '%'}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-text-primary">{metric.used.toLocaleString()}</span>
                    <span className="text-sm text-text-secondary">
                      {metric.max === -1 ? 'used' : `of ${metric.max.toLocaleString()}`}
                    </span>
                  </div>
                  
                  {metric.max !== -1 && (
                    <div className="space-y-2">
                      <Progress value={percentage} className="h-2" />
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">
                          {metric.max - metric.used} remaining
                        </span>
                        <span className={`font-medium ${status === 'critical' ? 'text-red-600' : status === 'warning' ? 'text-amber-600' : 'text-green-600'}`}>
                          {status === 'unlimited' ? 'Unlimited' : `${Math.round(percentage)}%`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </EnhancedAppleCard>
          );
        })}
      </div>

      {/* Usage Insights */}
      <EnhancedAppleCard variant="interactive" surface="secondary" className="group">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-6 w-6 text-text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Usage Insights</h3>
                <p className="text-sm text-text-secondary">Monthly overview and recommendations</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-text-secondary">
              <Calendar className="h-4 w-4" />
              <span>Updated: Today</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-surface-primary rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">{usageData.postsCreated}</div>
              <div className="text-sm text-text-secondary">Posts Created</div>
            </div>
            <div className="text-center p-4 bg-surface-primary rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">{usageData.connectionsUsed}</div>
              <div className="text-sm text-text-secondary">Active Connections</div>
            </div>
            <div className="text-center p-4 bg-surface-primary rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-1">{Math.round((usageData.tokensUsed / usageData.maxTokens) * 100)}%</div>
              <div className="text-sm text-text-secondary">Token Usage</div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {usageData.postsCreated > 0 && (
              <div className="flex items-center text-text-secondary">
                <FileText className="h-4 w-4 mr-2 text-blue-500" />
                You've created {usageData.postsCreated} posts this month
              </div>
            )}
            {usageData.connectionsUsed > 0 && (
              <div className="flex items-center text-text-secondary">
                <Users className="h-4 w-4 mr-2 text-green-500" />
                {usageData.connectionsUsed} social accounts connected
              </div>
            )}
            {subscription?.plan === 'free_trial' && (
              <div className="flex items-center text-text-secondary">
                <TrendingUp className="h-4 w-4 mr-2 text-purple-500" />
                Upgrade to unlock higher limits and premium features
              </div>
            )}
          </div>
        </div>
      </EnhancedAppleCard>
    </div>
  );
};