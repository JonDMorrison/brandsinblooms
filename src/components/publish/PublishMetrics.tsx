import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Clock, 
  Send, 
  CheckCircle,
  AlertCircle,
  BarChart3,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PublishMetricsProps {
  refreshTrigger?: number;
}

interface MetricData {
  totalPublished: number;
  totalScheduled: number;
  totalApproved: number;
  successRate: number;
  todayPublished: number;
  weekPublished: number;
  recentActivity: Array<{
    id: string;
    type: string;
    platform: string;
    timestamp: string;
    status: string;
  }>;
}

export const PublishMetrics = ({ refreshTrigger }: PublishMetricsProps) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadMetrics();
    }
  }, [user, refreshTrigger]);

  const loadMetrics = async () => {
    try {
      setLoading(true);

      // Get published posts
      const { data: publishedPosts, error: publishedError } = await supabase
        .from('social_posts')
        .select('id, platform, published_at, status')
        .eq('user_id', user?.id);

      if (publishedError) throw publishedError;

      // Get scheduled posts
      const { data: scheduledPosts, error: scheduledError } = await supabase
        .from('scheduled_posts')
        .select('id, platform, publish_at, status')
        .eq('user_id', user?.id);

      if (scheduledError) throw scheduledError;

      // Get approved content
      const { data: approvedContent, error: approvedError } = await supabase
        .from('content_tasks')
        .select('id, status, created_at')
        .eq('user_id', user?.id)
        .eq('status', 'approved');

      if (approvedError) throw approvedError;

      // Calculate metrics
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const todayPublished = (publishedPosts || []).filter(post => 
        post.published_at && new Date(post.published_at) >= todayStart
      ).length;

      const weekPublished = (publishedPosts || []).filter(post => 
        post.published_at && new Date(post.published_at) >= weekStart
      ).length;

      const totalPublished = (publishedPosts || []).filter(post => post.status === 'published').length;
      const totalScheduled = (scheduledPosts || []).filter(post => post.status === 'QUEUED').length;
      const totalApproved = (approvedContent || []).length;

      // Calculate success rate (published vs failed)
      const totalAttempts = (publishedPosts || []).length;
      const successRate = totalAttempts > 0 ? (totalPublished / totalAttempts) * 100 : 0;

      // Recent activity
      const recentActivity = [
        ...(publishedPosts || []).map(post => ({
          id: post.id,
          type: 'published',
          platform: post.platform || 'unknown',
          timestamp: post.published_at || new Date().toISOString(),
          status: post.status
        })),
        ...(scheduledPosts || []).map(post => ({
          id: post.id,
          type: 'scheduled',
          platform: post.platform || 'unknown',
          timestamp: post.publish_at,
          status: post.status
        }))
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

      setMetrics({
        totalPublished,
        totalScheduled,
        totalApproved,
        successRate,
        todayPublished,
        weekPublished,
        recentActivity
      });

    } catch (error) {
      console.error('Error loading publish metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">Published</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{metrics.totalPublished}</div>
          <div className="text-xs text-gray-500">All time</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-600">Scheduled</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{metrics.totalScheduled}</div>
          <div className="text-xs text-gray-500">Pending</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-gray-600">Approved</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{metrics.totalApproved}</div>
          <div className="text-xs text-gray-500">Ready to publish</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-600">Success Rate</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {metrics.successRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Publishing success</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-orange-600" />
            <span className="text-sm text-gray-600">This Week</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">{metrics.weekPublished}</div>
          <div className="text-xs text-gray-500">Published posts</div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-medium">Recent Activity</h3>
        </div>
        
        <div className="space-y-2">
          {metrics.recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No recent activity</p>
          ) : (
            metrics.recentActivity.map(activity => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  {activity.type === 'published' ? (
                    <Send className="w-4 h-4 text-green-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-blue-600" />
                  )}
                  <div>
                    <span className="text-sm font-medium capitalize">
                      {activity.type} to {activity.platform}
                    </span>
                    <div className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString()} at{' '}
                      {new Date(activity.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
                
                <Badge 
                  variant={activity.status === 'published' || activity.status === 'QUEUED' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {activity.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};