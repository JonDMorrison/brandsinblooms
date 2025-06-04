
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnalyticsDashboard } from "../analytics/AnalyticsDashboard";
import { TrendingUp, BarChart3, PieChart } from "lucide-react";

interface AnalyticsSnapshotProps {
  campaigns: any[];
  tasks: any[];
  onNavigateToAnalytics?: () => void;
}

export const AnalyticsSnapshot = ({ campaigns, tasks, onNavigateToAnalytics }: AnalyticsSnapshotProps) => {
  // Calculate quick metrics for the snapshot
  const totalPosts = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'published').length;
  const completionRate = totalPosts > 0 ? Math.round((completedTasks / totalPosts) * 100) : 0;
  
  // Calculate top performing content type
  const typeCount = tasks.reduce((acc, task) => {
    const type = task.post_type || 'General';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topContentType = Object.entries(typeCount).sort(([,a], [,b]) => b - a)[0];
  
  // Mock engagement data
  const avgEngagement = Math.floor(Math.random() * 50) + 25;

  return (
    <Card className="shadow-lg border-green-200 rounded-xl">
      <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 rounded-t-xl">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl text-black font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analytics Overview
            </CardTitle>
            <CardDescription className="font-medium">Real-time performance insights</CardDescription>
          </div>
          {onNavigateToAnalytics && (
            <Button variant="outline" size="sm" onClick={onNavigateToAnalytics}>
              View Full Analytics
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
            <div className="flex justify-center mb-2">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700 mb-2">{completionRate}%</p>
            <p className="text-sm text-gray-600 font-semibold">Completion Rate</p>
            <p className="text-xs text-gray-500 mt-1">{completedTasks} of {totalPosts} posts</p>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
            <div className="flex justify-center mb-2">
              <PieChart className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-700 mb-2">
              {topContentType ? topContentType[0] : 'N/A'}
            </p>
            <p className="text-sm text-gray-600 font-semibold">Top Content Type</p>
            <p className="text-xs text-gray-500 mt-1">
              {topContentType ? `${topContentType[1]} posts` : 'No data yet'}
            </p>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
            <div className="flex justify-center mb-2">
              <BarChart3 className="h-6 w-6 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-700 mb-2">{avgEngagement}%</p>
            <p className="text-sm text-gray-600 font-semibold">Avg Engagement</p>
            <p className="text-xs text-gray-500 mt-1">Across all platforms</p>
          </div>
        </div>

        {totalPosts === 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600">Create some content to see analytics data!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
