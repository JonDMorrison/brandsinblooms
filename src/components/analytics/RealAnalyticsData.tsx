
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, Eye, Heart, Phone, MapPin, Link, RefreshCw } from "lucide-react";
import { ConnectSocialCTA } from "@/components/social/ConnectSocialCTA";
import { useConnectedAccounts } from "@/components/dashboard/ConnectedAccountChecker";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsMetric {
  platform: string;
  metric_type: string;
  metric_value: number;
  date_collected: string;
  platform_account_name: string;
}

interface SocialConnectionsJoin {
  platform: string;
  platform_account_name: string;
}

interface AnalyticsDataWithConnection {
  id: string;
  connection_id: string;
  metric_type: string;
  metric_value: number;
  date_collected: string;
  metadata: any;
  created_at: string;
  social_connections: SocialConnectionsJoin;
}

export const RealAnalyticsData = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { data: connections, refetch: refetchConnections } = useConnectedAccounts();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user]);

  const fetchAnalyticsData = async () => {
    try {
      const { data, error } = await supabase
        .from('analytics_data')
        .select(`
          *,
          social_connections!inner(platform, platform_account_name)
        `)
        .order('date_collected', { ascending: false });

      if (error) throw error;

      // Transform the data to flatten the social_connections relation
      const transformedData = (data as AnalyticsDataWithConnection[])?.map(item => ({
        ...item,
        platform: item.social_connections.platform,
        platform_account_name: item.social_connections.platform_account_name,
      })) || [];

      setMetrics(transformedData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAnalytics = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-analytics');
      if (error) throw error;
      
      await fetchAnalyticsData();
      toast({
        title: "Success",
        description: "Analytics data synced successfully!"
      });
    } catch (error) {
      console.error('Error syncing analytics:', error);
      toast({
        title: "Error",
        description: "Failed to sync analytics data",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const getMetricIcon = (metricType: string) => {
    switch (metricType) {
      case 'reach':
      case 'impressions':
      case 'views':
        return Eye;
      case 'engagement':
        return Heart;
      case 'calls':
        return Phone;
      case 'search_queries':
        return MapPin;
      default:
        return TrendingUp;
    }
  };

  const getMetricsByPlatform = () => {
    const platforms = ['facebook', 'instagram', 'google_business_profile'];
    const result: Record<string, AnalyticsMetric[]> = {};

    platforms.forEach(platform => {
      const platformMetrics = metrics.filter(m => m.platform === platform || 
        (platform === 'google_business_profile' && m.platform === 'google_my_business'));
      if (platformMetrics.length > 0) {
        result[platform] = platformMetrics;
      }
    });

    return result;
  };

  const formatMetricName = (metricType: string) => {
    return metricType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social Media</CardTitle>
          <CardDescription>Loading your social media performance...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const platformData = getMetricsByPlatform();
  const hasConnections = connections && connections.length > 0;

  if (Object.keys(platformData).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Social Media
            {hasConnections && (
              <Button 
                onClick={handleSyncAnalytics} 
                disabled={syncing}
                size="sm"
                variant="outline"
              >
                {syncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync Data
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            {hasConnections 
              ? "Sync your social media accounts to see performance data"
              : "Connect your social media accounts to track performance"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasConnections ? (
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50 text-gray-400" />
              <p className="mb-4 text-gray-600">Connect your social media accounts to start tracking performance</p>
              <ConnectSocialCTA variant="button" />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No analytics data available yet</p>
              <p className="text-sm">Click "Sync Data" to fetch your latest social media metrics</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Social Media
            <Button 
              onClick={handleSyncAnalytics} 
              disabled={syncing}
              size="sm"
              variant="outline"
            >
              {syncing ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync Data
            </Button>
          </CardTitle>
          <CardDescription>Latest performance metrics from your connected social accounts</CardDescription>
        </CardHeader>
      </Card>

      {Object.entries(platformData).map(([platform, platformMetrics]) => {
        const platformName = platform === 'google_business_profile' || platform === 'google_my_business' ? 'Google Business Profile' : 
                           platform.charAt(0).toUpperCase() + platform.slice(1);
        
        // Group metrics by type and get the latest value
        const latestMetrics: Record<string, AnalyticsMetric> = {};
        platformMetrics.forEach(metric => {
          if (!latestMetrics[metric.metric_type] || 
              new Date(metric.date_collected) > new Date(latestMetrics[metric.metric_type].date_collected)) {
            latestMetrics[metric.metric_type] = metric;
          }
        });

        return (
          <Card key={platform}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {platformName} Analytics
                <span className="text-sm font-normal text-gray-500">
                  ({Object.values(latestMetrics)[0]?.platform_account_name})
                </span>
              </CardTitle>
              <CardDescription>
                Latest performance metrics from your {platformName} account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(latestMetrics).map((metric) => {
                  const Icon = getMetricIcon(metric.metric_type);
                  
                  // Calculate trend by comparing with previous metrics of same type
                  const currentValue = metric.metric_value;
                  const previousMetrics = platformMetrics.filter(m => 
                    m.metric_type === metric.metric_type && 
                    new Date(m.date_collected) < new Date(metric.date_collected)
                  ).sort((a, b) => new Date(b.date_collected).getTime() - new Date(a.date_collected).getTime());
                  
                  const previousValue = previousMetrics[0]?.metric_value || currentValue;
                  const trend = previousValue > 0 ? 
                    Math.round(((currentValue - previousValue) / previousValue) * 100) : 0;

                  return (
                    <div key={metric.metric_type} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Icon className="w-5 h-5 text-gray-600" />
                        {trend !== 0 && (
                          <div className={`flex items-center gap-1 text-xs ${
                            trend > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(trend)}%
                          </div>
                        )}
                      </div>
                      
                      <div className="mb-1">
                        <span className="text-2xl font-bold">
                          {metric.metric_value.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        {formatMetricName(metric.metric_type)}
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(metric.date_collected).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
