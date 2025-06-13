
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Eye, Heart, MessageCircle, Share } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SocialConnectionManager } from "./SocialConnectionManager";
import { RealAnalyticsData } from "./RealAnalyticsData";
import { AnalyticsSetupWizard } from "./AnalyticsSetupWizard";

interface AnalyticsDashboardProps {
  campaigns: any[];
  tasks: any[];
}

export const AnalyticsDashboard = ({ campaigns, tasks }: AnalyticsDashboardProps) => {
  const [analyticsData, setAnalyticsData] = useState({
    overview: {
      totalPosts: 0,
      totalCampaigns: 0,
      completionRate: 0,
      avgEngagement: 0
    },
    campaignPerformance: [],
    contentTypes: [],
    weeklyActivity: []
  });

  useEffect(() => {
    generateAnalyticsData();
  }, [campaigns, tasks]);

  const generateAnalyticsData = () => {
    // Calculate overview metrics
    const totalPosts = tasks.length;
    const totalCampaigns = campaigns.length;
    const completedTasks = tasks.filter(task => task.status === 'published').length;
    const completionRate = totalPosts > 0 ? Math.round((completedTasks / totalPosts) * 100) : 0;
    
    const avgEngagement = Math.floor(Math.random() * 50) + 25;

    const campaignPerformance = campaigns.map(campaign => {
      const campaignTasks = tasks.filter(task => task.campaign_id === campaign.id);
      const completed = campaignTasks.filter(task => task.status === 'published').length;
      const engagement = Math.floor(Math.random() * 100) + 50;
      const reach = Math.floor(Math.random() * 1000) + 500;
      
      return {
        name: campaign.title,
        completed,
        total: campaignTasks.length,
        engagement,
        reach
      };
    });

    const typeCount = tasks.reduce((acc, task) => {
      const type = task.post_type || 'General';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const contentTypes = Object.entries(typeCount).map(([name, value]) => ({
      name,
      value,
      color: getColorForType(name)
    }));

    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const weekNumber = getCurrentWeek() - i;
      const weekTasks = tasks.filter(task => {
        const taskDate = new Date(task.scheduled_date || task.created_at);
        const taskWeek = getWeekNumber(taskDate);
        return taskWeek === weekNumber;
      });
      
      return {
        week: `Week ${weekNumber}`,
        posts: weekTasks.length,
        completed: weekTasks.filter(task => task.status === 'published').length
      };
    }).reverse();

    setAnalyticsData({
      overview: {
        totalPosts,
        totalCampaigns,
        completionRate,
        avgEngagement
      },
      campaignPerformance,
      contentTypes,
      weeklyActivity
    });
  };

  const getColorForType = (type: string) => {
    const colors = {
      'Educational': '#10b981',
      'Promotional': '#3b82f6',
      'Seasonal': '#f59e0b',
      'Community': '#8b5cf6',
      'General': '#6b7280'
    };
    return colors[type as keyof typeof colors] || '#6b7280';
  };

  const getCurrentWeek = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  };

  const getWeekNumber = (date: Date) => {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  };

  const chartConfig = {
    posts: {
      label: "Posts",
      color: "#10b981",
    },
    completed: {
      label: "Completed",
      color: "#3b82f6",
    },
    engagement: {
      label: "Engagement Rate",
      color: "#f59e0b",
    }
  };

  return (
    <div className="space-y-6">
      {/* Social Media Connections */}
      <SocialConnectionManager />

      {/* Real Analytics Data */}
      <RealAnalyticsData />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analyticsData.overview.totalPosts}</div>
            <p className="text-xs text-muted-foreground">Across all campaigns</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{analyticsData.overview.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{analyticsData.overview.completionRate}%</div>
            <p className="text-xs text-muted-foreground">Tasks completed</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{analyticsData.overview.avgEngagement}%</div>
            <p className="text-xs text-muted-foreground">Engagement rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Settings */}
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns">Campaign Performance</TabsTrigger>
          <TabsTrigger value="content">Content Types</TabsTrigger>
          <TabsTrigger value="activity">Weekly Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>Completion rates and engagement by campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.campaignPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="completed" fill="#10b981" />
                    <Bar dataKey="total" fill="#d1d5db" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Distribution</CardTitle>
              <CardDescription>Breakdown of content types across all posts</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.contentTypes}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {analyticsData.contentTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Activity</CardTitle>
              <CardDescription>Post creation and completion trends over the last 7 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.weeklyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="posts" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <AnalyticsSetupWizard />
        </TabsContent>
      </Tabs>
    </div>
  );
};
