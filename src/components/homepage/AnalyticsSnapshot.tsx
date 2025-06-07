
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, CheckCircle, Calendar } from "lucide-react";

interface AnalyticsSnapshotProps {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  activeCampaigns: number;
}

export const AnalyticsSnapshot = ({ 
  totalTasks, 
  completedTasks, 
  pendingTasks, 
  activeCampaigns 
}: AnalyticsSnapshotProps) => {
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const pendingRate = totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0;

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return "bg-green-500";
    if (rate >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return "text-green-600 bg-green-50";
    if (rate >= 60) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <Card className="border-purple-200">
      <CardHeader>
        <CardTitle className="text-lg text-purple-700 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Analytics Snapshot
        </CardTitle>
        <CardDescription>
          Your content marketing performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
                <Clock className="w-4 h-4 text-orange-500" />
                Pending Review
              </span>
              <Badge className="text-orange-600 bg-orange-50">
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
      </CardContent>
    </Card>
  );
};
