import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Gift, 
  Star,
  Calendar,
  Zap,
  Target
} from 'lucide-react';
// Removed sonner import - using global toast replacement

interface EngagementTip {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionUrl?: string;
  icon: React.ReactNode;
  category: 'content' | 'timing' | 'engagement' | 'growth';
}

interface UserActivity {
  lastLoginDate: string;
  contentGeneratedThisWeek: number;
  postsPublishedThisWeek: number;
  streakDays: number;
  totalSessions: number;
}

export const EngagementBooster = () => {
  const { user } = useAuth();
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [tips, setTips] = useState<EngagementTip[]>([]);
  const [showReward, setShowReward] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserActivity = async () => {
    if (!user) return;

    try {
      // Get recent content activity
      const { data: recentContent } = await supabase
        .from('content_tasks')
        .select('created_at, status')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .is('deleted_at', null);

      const { data: recentPublished } = await supabase
        .from('content_tasks')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('status', 'published')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .is('deleted_at', null);

      // Get token usage for activity tracking
      const { data: tokenUsage } = await supabase
        .from('token_usage')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      const userActivity: UserActivity = {
        lastLoginDate: new Date().toISOString(), // Simplified
        contentGeneratedThisWeek: recentContent?.length || 0,
        postsPublishedThisWeek: recentPublished?.length || 0,
        streakDays: calculateStreak(tokenUsage || []),
        totalSessions: Math.min(tokenUsage?.length || 0, 50) // Simplified
      };

      setActivity(userActivity);
      generatePersonalizedTips(userActivity);

      // Check for milestone rewards
      checkForRewards(userActivity);

    } catch (error) {
      console.error('Error fetching user activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStreak = (usage: any[]): number => {
    if (!usage.length) return 0;
    
    const uniqueDays = new Set(
      usage.map(u => new Date(u.created_at).toDateString())
    );
    
    return Math.min(uniqueDays.size, 7);
  };

  const generatePersonalizedTips = (activity: UserActivity) => {
    const allTips: EngagementTip[] = [
      {
        id: 'create_content',
        title: 'Generate Fresh Content',
        description: 'Create new social media posts to keep your audience engaged',
        actionLabel: 'Generate Now',
        actionUrl: '/',
        icon: <Sparkles className="w-5 h-5 text-yellow-600" />,
        category: 'content'
      },
      {
        id: 'optimal_posting',
        title: 'Post at Peak Times',
        description: 'Schedule your content for maximum reach and engagement',
        actionLabel: 'Schedule Posts',
        actionUrl: '/publish',
        icon: <Clock className="w-5 h-5 text-blue-600" />,
        category: 'timing'
      },
      {
        id: 'analyze_performance',
        title: 'Check Your Analytics',
        description: 'Review how your content is performing and optimize',
        actionLabel: 'View Analytics',
        actionUrl: '/analytics',
        icon: <TrendingUp className="w-5 h-5 text-green-600" />,
        category: 'engagement'
      },
      {
        id: 'complete_profile',
        title: 'Enhance Your Profile',
        description: 'Add more details to generate better-targeted content',
        actionLabel: 'Update Profile',
        actionUrl: '/company-profile',
        icon: <Target className="w-5 h-5 text-purple-600" />,
        category: 'growth'
      },
      {
        id: 'batch_content',
        title: 'Batch Create Content',
        description: 'Generate multiple posts at once to stay ahead',
        actionLabel: 'Bulk Generate',
        actionUrl: '/',
        icon: <Zap className="w-5 h-5 text-orange-600" />,
        category: 'content'
      },
      {
        id: 'schedule_consistency',
        title: 'Maintain Consistency',
        description: 'Set up a regular posting schedule for better results',
        actionLabel: 'Plan Schedule',
        actionUrl: '/calendar',
        icon: <Calendar className="w-5 h-5 text-indigo-600" />,
        category: 'timing'
      }
    ];

    // Filter tips based on user activity
    let relevantTips = allTips;

    // If user hasn't generated content this week, prioritize content creation
    if (activity.contentGeneratedThisWeek === 0) {
      relevantTips = allTips.filter(tip => 
        tip.category === 'content' || tip.id === 'complete_profile'
      );
    }
    // If user has content but hasn't published, focus on publishing
    else if (activity.postsPublishedThisWeek === 0) {
      relevantTips = allTips.filter(tip => 
        tip.category === 'timing' || tip.category === 'engagement'
      );
    }
    // If user is active, show growth and optimization tips
    else {
      relevantTips = allTips.filter(tip => 
        tip.category === 'engagement' || tip.category === 'growth'
      );
    }

    setTips(relevantTips.slice(0, 3));
  };

  const checkForRewards = (activity: UserActivity) => {
    // Show reward for milestones
    if (activity.streakDays === 3 || activity.streakDays === 7 || 
        activity.contentGeneratedThisWeek === 5 || 
        activity.postsPublishedThisWeek === 3) {
      setShowReward(true);
    }
  };

  const handleTipAction = (tip: EngagementTip) => {
    if (tip.actionUrl) {
      window.location.href = tip.actionUrl;
    }
    
    // Track engagement with tips
    toast.success(`Great choice! ${tip.title} will boost your success.`);
  };

  const dismissReward = () => {
    setShowReward(false);
    toast.success('🎉 Congratulations on your progress!');
  };

  useEffect(() => {
    fetchUserActivity();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 animate-pulse rounded-lg"></div>
        <div className="h-48 bg-gray-100 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  if (!activity) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Milestone Reward Modal */}
      {showReward && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-6 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-yellow-900 mb-2">
              Milestone Achieved!
            </h3>
            <p className="text-yellow-800 mb-4">
              You're making amazing progress. Keep up the great work!
            </p>
            <Button onClick={dismissReward} className="bg-yellow-600 hover:bg-yellow-700">
              <Gift className="w-4 h-4 mr-2" />
              Claim Reward
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-600" />
            This Week's Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {activity.contentGeneratedThisWeek}
              </div>
              <p className="text-sm text-gray-600">Content Created</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {activity.postsPublishedThisWeek}
              </div>
              <p className="text-sm text-gray-600">Posts Published</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {activity.streakDays}
              </div>
              <p className="text-sm text-gray-600">Day Streak</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {activity.totalSessions}
              </div>
              <p className="text-sm text-gray-600">Total Sessions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personalized Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Recommended Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tips.map((tip) => (
              <div
                key={tip.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    {tip.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{tip.title}</h4>
                      <Badge variant="outline" className="text-xs capitalize">
                        {tip.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {tip.description}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleTipAction(tip)}
                  size="sm"
                  className="ml-4"
                >
                  {tip.actionLabel}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Motivation Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {activity.streakDays >= 7 ? 'You\'re on fire! 🔥' :
             activity.contentGeneratedThisWeek >= 3 ? 'Great momentum! 🚀' :
             activity.postsPublishedThisWeek >= 1 ? 'Nice work! 👏' :
             'Let\'s get started! 💪'}
          </h3>
          <p className="text-gray-600 mb-4">
            {activity.streakDays >= 7 ? 'Your consistency is paying off. Keep going!' :
             activity.contentGeneratedThisWeek >= 3 ? 'You\'re creating great content regularly.' :
             activity.postsPublishedThisWeek >= 1 ? 'Publishing content is key to growth.' :
             'Small steps lead to big results. Start today!'}
          </p>
          <Button
            onClick={() => window.location.href = '/'}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Take Action Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};