
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, CheckCircle, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const AnalyticsSnapshot = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    activeCampaigns: 0,
    loading: true
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;

      try {
        // Fetch all content tasks
        const { data: tasks, error: tasksError } = await supabase
          .from('content_tasks')
          .select('status');

        if (tasksError) {
          console.error('Error fetching tasks:', tasksError);
          return;
        }

        // Fetch all campaigns
        const { data: campaigns, error: campaignsError } = await supabase
          .from('campaigns')
          .select('id');

        if (campaignsError) {
          console.error('Error fetching campaigns:', campaignsError);
          return;
        }

        // Calculate analytics
        const totalTasks = tasks?.length || 0;
        const completedTasks = tasks?.filter(task => task.status === 'approved' || task.status === 'scheduled').length || 0;
        const pendingTasks = tasks?.filter(task => task.status === 'draft').length || 0;
        const activeCampaigns = campaigns?.length || 0;

        setAnalytics({
          totalTasks,
          completedTasks,
          pendingTasks,
          activeCampaigns,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setAnalytics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchAnalytics();
  }, [user]);

  const { totalTasks, completedTasks, pendingTasks, activeCampaigns, loading } = analytics;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return "bg-green-500";
    if (rate >= 60) return "bg-gray-500";
    return "bg-red-500";
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return "text-green-600 bg-green-50";
    if (rate >= 60) return "text-gray-600 bg-gray-50";
    return "text-red-600 bg-red-50";
  };

  if (loading) {
    return (
      <Card className="border-gray-200 bg-white">
        <CardHeader className="bg-white">
          <CardTitle className="text-lg text-black flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Analytics Snapshot
          </CardTitle>
          <CardDescription>
            Loading your performance data...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 bg-white">
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 bg-white">
      <CardHeader className="bg-white">
        <CardTitle className="text-lg text-black flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Analytics Snapshot
        </CardTitle>
        <CardDescription>
          Your content marketing performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 bg-white">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{totalTasks}</div>
            <p className="text-sm text-gray-600">Total Content</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{activeCampaigns}</div>
            <p className="text-sm text-gray-600">Active Campaigns</p>
          </div>
        </div>

        {/* Completion Progress */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Completed Content
            </span>
            <Badge className={getStatusColor(completionRate)}>
              {completionRate}%
            </Badge>
          </div>
          <Progress 
            value={completionRate} 
            className="h-2"
          />
          <p className="text-xs text-gray-500">
            {completedTasks} of {totalTasks} content pieces completed
          </p>
        </div>

        {/* Pending Review */}
        {pendingTasks > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Pending Review
              </span>
              <Badge className="text-gray-600 bg-gray-50 border-gray-200">
                {pendingTasks} items
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              Content ready for your approval
            </p>
          </div>
        )}

        {/* Weekly Goal Indicator */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              This Week's Goal
            </span>
            <span className="text-sm text-gray-600">
              {Math.min(totalTasks, 7)}/7 posts
            </span>
          </div>
        </div>

        {/* Empty State */}
        {totalTasks === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              No content yet. Create your first campaign to get started!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
