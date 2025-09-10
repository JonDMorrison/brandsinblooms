
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Heart, MessageCircle, Share2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';


export const AnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkForAnalyticsData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Check multiple analytics tables to see if user has any data
        const [
          analyticsData,
          postPerformance,
          hubViews,
          analyticsEvents
        ] = await Promise.all([
          supabase.from('analytics_data').select('id').limit(1),
          supabase.from('post_performance').select('id').limit(1),
          supabase.from('hub_views').select('id').limit(1),
          supabase.from('analytics_events').select('id').limit(1)
        ]);

        const hasAnyData = (
          (analyticsData.data && analyticsData.data.length > 0) ||
          (postPerformance.data && postPerformance.data.length > 0) ||
          (hubViews.data && hubViews.data.length > 0) ||
          (analyticsEvents.data && analyticsEvents.data.length > 0)
        );

        setHasData(hasAnyData);
      } catch (error) {
        console.error('Error checking for analytics data:', error);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };

    checkForAnalyticsData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return null;
  }

  // Original dashboard content for users with data
  const mockData = [
    { name: 'Mon', likes: 24, comments: 8, shares: 3 },
    { name: 'Tue', likes: 32, comments: 12, shares: 5 },
    { name: 'Wed', likes: 18, comments: 6, shares: 2 },
    { name: 'Thu', likes: 45, comments: 15, shares: 8 },
    { name: 'Fri', likes: 38, comments: 11, shares: 6 },
    { name: 'Sat', likes: 52, comments: 18, shares: 12 },
    { name: 'Sun', likes: 41, comments: 14, shares: 9 },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <Badge variant="outline" className="bg-blue-50 text-blue-600">
          Beta Feature
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,847</div>
            <p className="text-xs text-muted-foreground">
              +12% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2%</div>
            <p className="text-xs text-muted-foreground">
              +0.8% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comments</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">84</div>
            <p className="text-xs text-muted-foreground">
              +18% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shares</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">
              +25% from last week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="likes" fill="#3b82f6" name="Likes" />
              <Bar dataKey="comments" fill="#10b981" name="Comments" />
              <Bar dataKey="shares" fill="#f59e0b" name="Shares" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Posts Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Posts Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">Spring Planting Tips #{i}</p>
                  <p className="text-sm text-gray-500">Posted 2 days ago • Facebook</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {Math.floor(Math.random() * 50) + 10}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    {Math.floor(Math.random() * 15) + 2}
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="w-4 h-4" />
                    {Math.floor(Math.random() * 8) + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
