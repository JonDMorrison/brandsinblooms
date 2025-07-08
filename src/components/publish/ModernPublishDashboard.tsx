import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  Clock, 
  Send, 
  Calendar,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Zap,
  Target,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow, format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScheduledPost {
  id: string;
  content_id: string;
  platform: string;
  publish_at: string;
  status: 'QUEUED' | 'PUBLISHED' | 'ERROR';
  content_tasks?: {
    ai_output: string;
    attachments?: any;
  };
}

interface PublishMetrics {
  totalPublished: number;
  totalScheduled: number;
  successRate: number;
  avgEngagement: number;
  topPerformingPlatform: string;
  publishedToday: number;
  scheduledThisWeek: number;
}

interface RecentActivity {
  id: string;
  type: 'published' | 'scheduled' | 'failed';
  platform: string;
  content: string;
  timestamp: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    reach: number;
  };
}

// Metric card component
const MetricCard = ({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  trend,
  description 
}: {
  title: string;
  value: string | number;
  change?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <div className={cn("flex items-center gap-1 text-sm", getTrendColor())}>
              {TrendIcon && <TrendIcon className="w-3 h-3" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-lg",
          trend === 'up' ? 'bg-green-100' : 
          trend === 'down' ? 'bg-red-100' : 'bg-gray-100'
        )}>
          <Icon className={cn(
            "w-6 h-6",
            trend === 'up' ? 'text-green-600' : 
            trend === 'down' ? 'text-red-600' : 'text-gray-600'
          )} />
        </div>
      </div>
      {description && (
        <p className="text-xs text-gray-500 mt-2">{description}</p>
      )}
    </Card>
  );
};

// Scheduled post item component
const ScheduledPostItem = ({ 
  post, 
  onReschedule 
}: { 
  post: ScheduledPost;
  onReschedule?: (postId: string) => void;
}) => {
  const publishDate = new Date(post.publish_at);
  
  const getDateLabel = () => {
    if (isToday(publishDate)) return 'Today';
    if (isTomorrow(publishDate)) return 'Tomorrow';
    if (isThisWeek(publishDate)) return format(publishDate, 'EEEE');
    return format(publishDate, 'MMM d');
  };

  const getStatusColor = () => {
    switch (post.status) {
      case 'QUEUED': return 'bg-blue-100 text-blue-800';
      case 'PUBLISHED': return 'bg-green-100 text-green-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">
            {post.platform.toUpperCase()}
          </Badge>
          <Badge variant="outline" className={cn("text-xs", getStatusColor())}>
            {post.status}
          </Badge>
        </div>
        
        <p className="text-sm text-gray-900 line-clamp-2 mb-1">
          {post.content_tasks?.ai_output?.substring(0, 100)}...
        </p>
        
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{getDateLabel()}</span>
          <span>{format(publishDate, 'h:mm a')}</span>
          <span>{formatDistanceToNow(publishDate, { addSuffix: true })}</span>
        </div>
      </div>
      
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onReschedule?.(post.id)}
        className="text-xs"
      >
        <Clock className="w-3 h-3 mr-1" />
        Reschedule
      </Button>
    </div>
  );
};

// Recent activity item
const ActivityItem = ({ activity }: { activity: RecentActivity }) => {
  const getActivityIcon = () => {
    switch (activity.type) {
      case 'published': return <Send className="w-4 h-4 text-green-600" />;
      case 'scheduled': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getActivityMessage = () => {
    switch (activity.type) {
      case 'published': return `Published to ${activity.platform}`;
      case 'scheduled': return `Scheduled for ${activity.platform}`;
      case 'failed': return `Failed to publish to ${activity.platform}`;
    }
  };

  return (
    <div className="flex items-start gap-3 p-3">
      <div className="flex-shrink-0 mt-1">
        {getActivityIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 mb-1">
          {getActivityMessage()}
        </p>
        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
          {activity.content.substring(0, 120)}...
        </p>
        
        {activity.engagement && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {activity.engagement.likes}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {activity.engagement.comments}
            </span>
            <span className="flex items-center gap-1">
              <Share className="w-3 h-3" />
              {activity.engagement.shares}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {activity.engagement.reach}
            </span>
          </div>
        )}
        
        <p className="text-xs text-gray-400 mt-1">
          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
};

export const ModernPublishDashboard = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<PublishMetrics | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load scheduled posts
      const { data: scheduled, error: scheduledError } = await supabase
        .from('scheduled_posts')
        .select(`
          *,
          content_tasks (
            ai_output,
            attachments
          )
        `)
        .eq('user_id', user?.id)
        .order('publish_at', { ascending: true })
        .limit(10);

      if (!scheduledError && scheduled) {
        setScheduledPosts(scheduled as any);
      }

      // Load published posts for metrics
      const { data: published, error: publishedError } = await supabase
        .from('social_posts')
        .select('*')
        .eq('user_id', user?.id)
        .order('published_at', { ascending: false })
        .limit(50);

      if (!publishedError && published) {
        // Calculate metrics
        const totalPublished = published.length;
        const publishedToday = published.filter(p => 
          isToday(new Date(p.published_at))
        ).length;
        
        const scheduledCount = scheduled?.length || 0;
        const scheduledThisWeek = scheduled?.filter(s => 
          isThisWeek(new Date(s.publish_at))
        ).length || 0;

        // Mock engagement data (replace with real analytics when available)
        const mockMetrics: PublishMetrics = {
          totalPublished,
          totalScheduled: scheduledCount,
          successRate: Math.min(95, 80 + Math.random() * 15), // 80-95%
          avgEngagement: Math.floor(120 + Math.random() * 80), // 120-200
          topPerformingPlatform: 'Instagram',
          publishedToday,
          scheduledThisWeek
        };

        setMetrics(mockMetrics);

        // Create recent activity from published posts
        const activity: RecentActivity[] = published.slice(0, 10).map(post => ({
          id: post.id,
          type: 'published' as const,
          platform: post.platform,
          content: post.content || '',
          timestamp: post.published_at,
          engagement: {
            likes: Math.floor(20 + Math.random() * 100),
            comments: Math.floor(5 + Math.random() * 25),
            shares: Math.floor(2 + Math.random() * 15),
            reach: Math.floor(200 + Math.random() * 500)
          }
        }));

        setRecentActivity(activity);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = (postId: string) => {
    console.log('Reschedule post:', postId);
    // Implement reschedule logic
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Published Today"
          value={metrics?.publishedToday || 0}
          change="+12%"
          trend="up"
          icon={Send}
          description="Posts published in the last 24 hours"
        />
        
        <MetricCard
          title="Scheduled This Week"
          value={metrics?.scheduledThisWeek || 0}
          icon={Calendar}
          description="Posts scheduled for this week"
        />
        
        <MetricCard
          title="Success Rate"
          value={`${Math.round(metrics?.successRate || 0)}%`}
          change="+2.3%"
          trend="up"
          icon={CheckCircle}
          description="Publishing success rate"
        />
        
        <MetricCard
          title="Avg. Engagement"
          value={metrics?.avgEngagement || 0}
          change="+15%"
          trend="up"
          icon={TrendingUp}
          description="Average engagement per post"
        />
      </div>

      {/* Dashboard Tabs */}
      <Tabs defaultValue="scheduled" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Upcoming Posts</h3>
              <p className="text-sm text-gray-600">
                {scheduledPosts.length} posts scheduled
              </p>
            </div>
            
            <ScrollArea className="h-96">
              <div className="p-4 space-y-3">
                {scheduledPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No scheduled posts</p>
                    <p className="text-sm">Schedule posts to see them here</p>
                  </div>
                ) : (
                  scheduledPosts.map(post => (
                    <ScheduledPostItem
                      key={post.id}
                      post={post}
                      onReschedule={handleReschedule}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              <p className="text-sm text-gray-600">
                Latest publishing activity and engagement
              </p>
            </div>
            
            <ScrollArea className="h-96">
              <div className="divide-y">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No recent activity</p>
                    <p className="text-sm">Publish content to see activity here</p>
                  </div>
                ) : (
                  recentActivity.map(activity => (
                    <ActivityItem
                      key={activity.id}
                      activity={activity}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card className="p-6 text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="font-semibold text-gray-900 mb-2">Analytics Coming Soon</h3>
            <p className="text-gray-600 text-sm mb-4">
              Detailed analytics and insights will be available here
            </p>
            <Button variant="outline">
              <Target className="w-4 h-4 mr-2" />
              Enable Analytics
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};