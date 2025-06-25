
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, Eye, Heart, MessageCircle, Share2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface PostPerformance {
  id: string;
  content_task_id: string;
  platform: string;
  platform_post_url: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  last_updated: string;
  content_tasks: {
    post_type: string;
    ai_output: string;
  };
}

export const PostPerformanceTracker: React.FC = () => {
  const { user } = useAuth();
  const [performances, setPerformances] = useState<PostPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchPerformances = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('post_performance')
        .select(`
          *,
          content_tasks!inner(
            post_type,
            ai_output,
            user_id
          )
        `)
        .eq('content_tasks.user_id', user.id)
        .order('last_updated', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPerformances(data || []);
    } catch (error) {
      console.error('Error fetching post performances:', error);
      toast.error('Failed to load post performance data');
    } finally {
      setLoading(false);
    }
  };

  const syncAnalytics = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-analytics');
      if (error) throw error;
      
      toast.success('Analytics synced successfully');
      fetchPerformances();
    } catch (error) {
      console.error('Error syncing analytics:', error);
      toast.error('Failed to sync analytics');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchPerformances();
  }, [user]);

  const getEngagementBadgeVariant = (rate: number) => {
    if (rate >= 5) return 'default';
    if (rate >= 2) return 'secondary';
    return 'outline';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Post Performance
        </CardTitle>
        <Button 
          onClick={syncAnalytics} 
          disabled={syncing}
          size="sm"
          variant="outline"
        >
          {syncing ? 'Syncing...' : 'Sync Analytics'}
        </Button>
      </CardHeader>
      <CardContent>
        {performances.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No performance data available yet</p>
            <p className="text-sm">Post content to start tracking performance</p>
          </div>
        ) : (
          <div className="space-y-4">
            {performances.map((performance) => (
              <div key={performance.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="capitalize">
                        {performance.platform}
                      </Badge>
                      <Badge 
                        variant={getEngagementBadgeVariant(performance.engagement_rate)}
                        className="flex items-center gap-1"
                      >
                        <TrendingUp className="w-3 h-3" />
                        {performance.engagement_rate.toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {performance.content_tasks.ai_output.substring(0, 100)}...
                    </p>
                  </div>
                  {performance.platform_post_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(performance.platform_post_url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="flex flex-col items-center">
                    <Eye className="w-4 h-4 text-gray-500 mb-1" />
                    <span className="text-sm font-medium">{formatNumber(performance.views)}</span>
                    <span className="text-xs text-gray-500">Views</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Heart className="w-4 h-4 text-red-500 mb-1" />
                    <span className="text-sm font-medium">{formatNumber(performance.likes)}</span>
                    <span className="text-xs text-gray-500">Likes</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <MessageCircle className="w-4 h-4 text-blue-500 mb-1" />
                    <span className="text-sm font-medium">{formatNumber(performance.comments)}</span>
                    <span className="text-xs text-gray-500">Comments</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Share2 className="w-4 h-4 text-green-500 mb-1" />
                    <span className="text-sm font-medium">{formatNumber(performance.shares)}</span>
                    <span className="text-xs text-gray-500">Shares</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
