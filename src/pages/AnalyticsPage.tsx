
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { AnalyticsPeriodSelector } from "@/components/analytics/AnalyticsPeriodSelector";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, Clock, Download, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { toast } from "sonner";

const AnalyticsPage = () => {
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [syncing, setSyncing] = useState(false);
  const { totalViews, engagementRate, clicks, conversions, growth, loading, error, refetch } = useAnalyticsOverview(selectedPeriod);

  // Check if user has any meaningful data
  const hasData = totalViews > 0 || clicks > 0 || conversions > 0;

  const handleSyncAnalytics = async () => {
    try {
      setSyncing(true);
      toast.info("Syncing analytics data...");
      
      const { error } = await supabase.functions.invoke('sync-analytics');
      
      if (error) {
        throw error;
      }
      
      // Refresh the analytics data after sync
      await refetch();
      toast.success("Analytics data synced successfully");
    } catch (error) {
      console.error('Error syncing analytics:', error);
      toast.error("Failed to sync analytics data");
    } finally {
      setSyncing(false);
    }
  };

  const handleExportData = () => {
    toast.info("Export feature coming soon");
  };

  return (
    <div className="space-y-6 py-6">
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
          
          {/* Period Selector - only show for users with data */}
          {hasData && !loading && !error && (
            <div className="mt-4">
              <AnalyticsPeriodSelector 
                selectedPeriod={selectedPeriod} 
                onPeriodChange={setSelectedPeriod} 
              />
            </div>
          )}
          
          {/* Quick stats */}
          {loading ? (
            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading analytics...
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <BarChart3 className="w-4 h-4" />
                Error loading analytics data
              </div>
            </div>
          ) : hasData ? (
            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="font-medium">{totalViews.toLocaleString()}</span> total views
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{engagementRate}%</span> engagement
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="font-medium">{clicks}</span> clicks
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <BarChart3 className="w-4 h-4 text-orange-600" />
                <span className="font-medium">{conversions}</span> conversions
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="font-medium">{growth >= 0 ? '+' : ''}{growth}%</span> growth
              </div>
            </div>
          ) : null}
        </div>
        
        {/* Action buttons - only show for users with data */}
        {hasData && !loading && !error && (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSyncAnalytics}
              variant="outline"
              disabled={syncing}
              className="flex items-center gap-2 hover:bg-blue-50 border-blue-200 text-blue-700"
              size="lg"
            >
              {syncing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              Sync Analytics
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
        )}
      </div>
      
      {/* Analytics Content */}
      <AnalyticsDashboard />
    </div>
  );
};

export default AnalyticsPage;
