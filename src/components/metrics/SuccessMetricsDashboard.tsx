import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TrendingUp, 
  Target, 
  Trophy, 
  Clock, 
  CheckCircle2, 
  Zap,
  Users,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

interface UserMetrics {
  totalContentGenerated: number;
  contentPublished: number;
  daysActive: number;
  currentStreak: number;
  lastActiveDate: string;
  onboardingCompletion: number;
  tokensUsed: number;
  avgEngagementRate: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isUnlocked: boolean;
  progress?: number;
  maxProgress?: number;
  unlockedAt?: string;
}

export const SuccessMetricsDashboard = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserMetrics = async () => {
    if (!user) return;

    try {
      // Get user's content stats
      const { data: contentTasks } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      const { data: publishedTasks } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'published')
        .is('deleted_at', null);

      // Get token usage
      const { data: tokenUsage } = await supabase
        .from('token_usage')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Get company profile for onboarding status
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Calculate metrics
      const totalContent = contentTasks?.length || 0;
      const publishedContent = publishedTasks?.length || 0;
      const totalTokensUsed = tokenUsage?.reduce((sum, usage) => sum + usage.tokens_consumed, 0) || 0;
      
      // Calculate days active (simplified - based on first content creation)
      const firstContent = contentTasks?.[0];
      const daysActive = firstContent 
        ? Math.ceil((Date.now() - new Date(firstContent.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Calculate streak (simplified - consecutive days with activity)
      const currentStreak = calculateActivityStreak(tokenUsage || []);

      // Calculate onboarding completion percentage
      const onboardingFields = [
        profile?.company_name,
        profile?.company_overview,
        profile?.target_audience,
        profile?.brand_voice,
        profile?.location_info
      ];
      const completedFields = onboardingFields.filter(field => field && field.trim()).length;
      const onboardingCompletion = Math.round((completedFields / onboardingFields.length) * 100);

      const userMetrics: UserMetrics = {
        totalContentGenerated: totalContent,
        contentPublished: publishedContent,
        daysActive,
        currentStreak,
        lastActiveDate: tokenUsage?.[0]?.created_at || new Date().toISOString(),
        onboardingCompletion,
        tokensUsed: totalTokensUsed,
        avgEngagementRate: calculateAverageEngagement() // Placeholder
      };

      setMetrics(userMetrics);
      generateAchievements(userMetrics);

    } catch (error) {
      console.error('Error fetching user metrics:', error);
      toast.error('Failed to load success metrics');
    } finally {
      setLoading(false);
    }
  };

  const calculateActivityStreak = (usage: any[]): number => {
    if (!usage.length) return 0;
    
    // Simplified streak calculation
    const uniqueDays = new Set(
      usage.map(u => new Date(u.created_at).toDateString())
    );
    
    return Math.min(uniqueDays.size, 7); // Cap at 7 for demo
  };

  const calculateAverageEngagement = (): number => {
    // This would calculate from post_performance table in real implementation
    return Math.random() * 5 + 2; // Mock 2-7% engagement rate
  };

  const generateAchievements = (metrics: UserMetrics) => {
    const achievementsList: Achievement[] = [
      {
        id: 'first_content',
        title: 'Content Creator',
        description: 'Generate your first piece of content',
        icon: <Zap className="w-5 h-5 text-yellow-600" />,
        isUnlocked: metrics.totalContentGenerated >= 1,
        progress: Math.min(metrics.totalContentGenerated, 1),
        maxProgress: 1
      },
      {
        id: 'first_publish',
        title: 'Going Public',
        description: 'Publish your first post to social media',
        icon: <Target className="w-5 h-5 text-blue-600" />,
        isUnlocked: metrics.contentPublished >= 1,
        progress: Math.min(metrics.contentPublished, 1),
        maxProgress: 1
      },
      {
        id: 'content_master',
        title: 'Content Master',
        description: 'Generate 10 pieces of content',
        icon: <Trophy className="w-5 h-5 text-purple-600" />,
        isUnlocked: metrics.totalContentGenerated >= 10,
        progress: Math.min(metrics.totalContentGenerated, 10),
        maxProgress: 10
      },
      {
        id: 'consistency_king',
        title: 'Consistency King',
        description: 'Stay active for 7 consecutive days',
        icon: <Calendar className="w-5 h-5 text-green-600" />,
        isUnlocked: metrics.currentStreak >= 7,
        progress: Math.min(metrics.currentStreak, 7),
        maxProgress: 7
      },
      {
        id: 'profile_complete',
        title: 'Profile Perfectionist',
        description: 'Complete your business profile',
        icon: <Users className="w-5 h-5 text-orange-600" />,
        isUnlocked: metrics.onboardingCompletion >= 100,
        progress: metrics.onboardingCompletion,
        maxProgress: 100
      },
      {
        id: 'publisher_pro',
        title: 'Publisher Pro',
        description: 'Publish 5 posts to social media',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
        isUnlocked: metrics.contentPublished >= 5,
        progress: Math.min(metrics.contentPublished, 5),
        maxProgress: 5
      }
    ];

    setAchievements(achievementsList);
  };

  useEffect(() => {
    fetchUserMetrics();
  }, [user]);

  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="h-32 bg-gray-100 animate-pulse rounded-lg"></div>
        <div className="h-64 bg-gray-100 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Unable to load success metrics</p>
        </CardContent>
      </Card>
    );
  }

  const successScore = Math.round(
    (metrics.totalContentGenerated * 10 + 
     metrics.contentPublished * 20 + 
     metrics.currentStreak * 5 + 
     metrics.onboardingCompletion) / 4
  );

  return (
    <div className="space-y-6">
      {/* Success Score Overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Trophy className="w-6 h-6" />
            Your Success Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold text-blue-900 mb-2">
                {successScore}/100
              </div>
              <p className="text-blue-700">
                {successScore >= 80 ? 'Excellent!' : 
                 successScore >= 60 ? 'Great progress!' : 
                 successScore >= 40 ? 'Getting there!' : 
                 'Just getting started!'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-6xl">
                {successScore >= 80 ? '🏆' : 
                 successScore >= 60 ? '🎯' : 
                 successScore >= 40 ? '📈' : '🌱'}
              </div>
            </div>
          </div>
          <Progress value={successScore} className="mt-4 h-3" />
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              Content Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalContentGenerated}</div>
            <p className="text-xs text-gray-500 mt-1">Total pieces created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Published Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.contentPublished}</div>
            <p className="text-xs text-gray-500 mt-1">Successfully published</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-600" />
              Activity Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.currentStreak}</div>
            <p className="text-xs text-gray-500 mt-1">Consecutive days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Avg. Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgEngagementRate.toFixed(1)}%</div>
            <p className="text-xs text-gray-500 mt-1">Across all posts</p>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 border rounded-lg transition-all ${
                  achievement.isUnlocked 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${
                    achievement.isUnlocked ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {achievement.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{achievement.title}</h4>
                      {achievement.isUnlocked && (
                        <Badge variant="secondary" className="text-xs">
                          ✓ Unlocked
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {achievement.description}
                    </p>
                    {achievement.maxProgress && (
                      <div>
                        <Progress 
                          value={(achievement.progress! / achievement.maxProgress) * 100} 
                          className="h-2 mb-1"
                        />
                        <p className="text-xs text-gray-500">
                          {achievement.progress} / {achievement.maxProgress}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions for Improvement */}
      <Card>
        <CardHeader>
          <CardTitle>Boost Your Success</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {metrics.onboardingCompletion < 100 && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium">Complete Your Profile</p>
                  <p className="text-sm text-gray-600">Add more details to unlock better content</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => window.location.href = '/company-profile'}
                >
                  Complete Profile
                </Button>
              </div>
            )}
            
            {metrics.contentPublished === 0 && metrics.totalContentGenerated > 0 && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium">Publish Your First Post</p>
                  <p className="text-sm text-gray-600">Share your content with the world</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => window.location.href = '/publish'}
                >
                  Publish Now
                </Button>
              </div>
            )}
            
            {metrics.totalContentGenerated === 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div>
                  <p className="font-medium">Generate Your First Content</p>
                  <p className="text-sm text-gray-600">Start creating amazing social media posts</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => window.location.href = '/'}
                >
                  Generate Content
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};