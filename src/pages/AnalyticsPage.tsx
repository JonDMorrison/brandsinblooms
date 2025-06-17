
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, Clock, Download, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentWeekNumber } from "@/utils/dateUtils";

const AnalyticsPage = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock stats for demonstration
  const [stats, setStats] = useState({
    totalViews: 12500,
    engagement: 87,
    conversions: 156,
    growth: 23
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: true });

      const { data: tasksData } = await supabase
        .from('content_tasks')
        .select('*')
        .order('scheduled_date', { ascending: true });

      setCampaigns(campaignsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportData = () => {
    console.log('Exporting analytics data...');
    // Implementation for data export
  };

  const handleRefresh = () => {
    fetchData();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-10 h-10 text-blue-600" />
            Analytics Dashboard
          </h1>
          <p className="text-lg text-gray-600 font-medium">
            Track your marketing performance and insights
          </p>
          
          {/* Quick stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="font-medium">{stats.totalViews.toLocaleString()}</span> total views
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="font-medium">{stats.engagement}%</span> engagement
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="font-medium">{stats.conversions}</span> conversions
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <BarChart3 className="w-4 h-4 text-orange-600" />
              <span className="font-medium">+{stats.growth}%</span> growth
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="flex items-center gap-2 hover:bg-blue-50 border-blue-200 text-blue-700"
            size="lg"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh Data
          </Button>
          
          <Button
            onClick={handleExportData}
            className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md"
            size="lg"
          >
            <Download className="w-5 h-5" />
            Export Report
          </Button>
        </div>
      </div>
      
      {/* Analytics Content */}
      <AnalyticsDashboard campaigns={campaigns} tasks={tasks} />
    </div>
  );
};

export default AnalyticsPage;
