
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, Eye, RefreshCw, Download } from "lucide-react";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { AnalyticsPeriodSelector } from "@/components/analytics/AnalyticsPeriodSelector";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { GoogleAnalyticsCard } from "@/components/analytics/GoogleAnalyticsCard";
import { GoogleAnalyticsConnection } from "@/components/integrations/GoogleAnalyticsConnection";
import { CRMAnalyticsCard } from "@/components/analytics/CRMAnalyticsCard";
import { RealAnalyticsData } from "@/components/analytics/RealAnalyticsData";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Comprehensive analytics across all your marketing channels
            </p>
          </div>
          <Badge variant="secondary" className="px-3 py-1">
            Enhanced Analytics
          </Badge>
        </div>

        <AnalyticsPeriodSelector 
          selectedPeriod={selectedPeriod} 
          onPeriodChange={setSelectedPeriod} 
        />

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={handleSyncAnalytics}
            disabled={syncing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Analytics'}
          </Button>
          
          <Button 
            onClick={handleExportData}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {gaConnected && propertyId ? (
          <GoogleAnalyticsCard 
            propertyId={propertyId} 
            dateRange={selectedPeriod} 
          />
        ) : (
          <GoogleAnalyticsConnection />
        )}
        <CRMAnalyticsCard />
      </div>

      {/* Social Media Analytics */}
      <RealAnalyticsData />

      {/* Legacy Dashboard */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Campaign Overview</h2>
        {!loading && !error && (
          <>
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalViews?.toLocaleString() || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{engagementRate?.toFixed(1) || 0}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{clicks?.toLocaleString() || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conversions?.toLocaleString() || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Growth</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {growth && growth >= 0 ? '+' : ''}{growth?.toFixed(1) || 0}%
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading analytics data...</span>
            </div>
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-600">Error: {error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AnalyticsDashboard />
    </div>
  );
};

export default AnalyticsPage;
