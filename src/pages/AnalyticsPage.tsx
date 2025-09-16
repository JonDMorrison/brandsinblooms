
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Settings } from "lucide-react";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { AnalyticsPeriodSelector } from "@/components/analytics/AnalyticsPeriodSelector";
import { ExecutiveDashboard } from "@/components/analytics/ExecutiveDashboard";
import { ChannelPerformance } from "@/components/analytics/ChannelPerformance";
import { DataSourceManager } from "@/components/analytics/DataSourceManager";
import { ActionableInsights } from "@/components/analytics/ActionableInsights";
import { useGASettings } from "@/hooks/useGASettings";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

const AnalyticsPage = () => {
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [syncing, setSyncing] = useState(false);
  const { settings: gaSettings, isConnected: gaConnected, propertyId } = useGASettings();
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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Business Analytics</h1>
            <p className="text-muted-foreground">
              Complete overview of your marketing performance and customer insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AnalyticsPeriodSelector 
              selectedPeriod={selectedPeriod} 
              onPeriodChange={setSelectedPeriod} 
            />
            <Badge variant="secondary" className="px-3 py-1">
              Enhanced Analytics
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={handleExportData}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          
          <Button 
            variant="outline"
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Executive Summary Dashboard */}
      <ExecutiveDashboard 
        totalViews={totalViews}
        engagementRate={engagementRate}
        clicks={clicks}
        conversions={conversions}
        growth={growth}
        loading={loading}
      />

      {/* Channel Performance Breakdown */}
      <ChannelPerformance
        gaConnected={gaConnected}
        propertyId={propertyId}
        dateRange={selectedPeriod}
      />

      {/* Actionable Insights */}
      <ActionableInsights
        engagementRate={engagementRate}
        growth={growth}
        conversions={conversions}
      />

      {/* Data Source Management */}
      <DataSourceManager
        gaConnected={gaConnected}
        onSyncComplete={refetch}
        syncing={syncing}
      />
    </div>
  );
};

export default AnalyticsPage;
