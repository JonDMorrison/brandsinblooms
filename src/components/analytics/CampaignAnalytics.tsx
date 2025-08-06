import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Copy, ExternalLink, QrCode, BarChart3 } from 'lucide-react';
import { useROIAnalytics } from '@/hooks/useROIAnalytics';
import { useToast } from '@/hooks/use-toast';

interface CampaignAnalyticsProps {
  campaignId: string;
  campaignName: string;
}

export const CampaignAnalytics = ({ campaignId, campaignName }: CampaignAnalyticsProps) => {
  const { metrics, loading, fetchCampaignMetrics } = useROIAnalytics();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  useEffect(() => {
    fetchCampaignMetrics(campaignId, selectedPeriod);
    fetchCoupons();
  }, [campaignId, selectedPeriod]);

  const fetchCoupons = async () => {
    // Implementation would fetch coupons for this campaign
    // Simplified for now
    setCoupons([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const getPerformanceColor = (value: number, threshold: number, higher_is_better: boolean = true) => {
    if (higher_is_better) {
      return value >= threshold ? 'text-green-600' : value >= threshold * 0.7 ? 'text-yellow-600' : 'text-red-600';
    } else {
      return value <= threshold ? 'text-green-600' : value <= threshold * 1.3 ? 'text-yellow-600' : 'text-red-600';
    }
  };

  if (loading) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{campaignName} Analytics</h2>
          <p className="text-muted-foreground">Real-time performance metrics and ROI tracking</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(days => (
            <Button
              key={days}
              variant={selectedPeriod === days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(days)}
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Messages Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSent || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Click Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(metrics?.ctr || 0, 5)}`}>
              {(metrics?.ctr || 0).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">{metrics?.totalClicks || 0} clicks</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Redemptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalRedemptions || 0}</div>
            <div className="text-xs text-muted-foreground">
              {(metrics?.redemptionRate || 0).toFixed(1)}% rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(metrics?.totalRevenue || 0).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Total generated</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue/Send</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(metrics?.revenuePerSend || 0, 1)}`}>
              ${(metrics?.revenuePerSend || 0).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Per message</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(metrics?.roi_percentage || 0, 100)}`}>
              {(metrics?.roi_percentage || 0).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">Return on investment</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Engagement Funnel</CardTitle>
                <CardDescription>Message delivery to purchase conversion</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Messages Sent</span>
                    <span>{metrics?.totalSent || 0}</span>
                  </div>
                  <Progress value={100} className="mt-1" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Clicked</span>
                    <span>{metrics?.totalClicks || 0}</span>
                  </div>
                  <Progress 
                    value={metrics?.totalSent ? (metrics.totalClicks / metrics.totalSent) * 100 : 0} 
                    className="mt-1" 
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Redeemed</span>
                    <span>{metrics?.totalRedemptions || 0}</span>
                  </div>
                  <Progress 
                    value={metrics?.totalSent ? (metrics.totalRedemptions / metrics.totalSent) * 100 : 0} 
                    className="mt-1" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Cost analysis and profit margins</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Revenue</span>
                  <span className="font-bold">${(metrics?.totalRevenue || 0).toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>SMS Costs</span>
                  <span>-${((metrics?.totalSent || 0) * 0.02).toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Net Profit</span>
                  <span className="font-bold text-green-600">
                    ${((metrics?.totalRevenue || 0) - ((metrics?.totalSent || 0) * 0.02)).toFixed(2)}
                  </span>
                </div>

                <div className="text-sm text-muted-foreground">
                  Profit Margin: {metrics?.totalRevenue ? 
                    (((metrics.totalRevenue - (metrics.totalSent * 0.02)) / metrics.totalRevenue) * 100).toFixed(1) 
                    : 0}%
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="coupons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coupon Performance</CardTitle>
              <CardDescription>Track individual coupon usage and redemption</CardDescription>
            </CardHeader>
            <CardContent>
              {coupons.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No coupons generated for this campaign yet
                </div>
              ) : (
                <div className="space-y-2">
                  {coupons.map((coupon: any, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                          {coupon.code}
                        </code>
                        <Badge variant={coupon.is_redeemed ? 'default' : 'secondary'}>
                          {coupon.is_redeemed ? 'Redeemed' : 'Active'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {coupon.net_sales && (
                          <span className="font-medium">${coupon.net_sales}</span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(coupon.code)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attribution Model</CardTitle>
              <CardDescription>7-day attribution window for revenue tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Attribution Rules</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Revenue attributed to last SMS click within 7 days</li>
                    <li>• Coupon redemptions automatically tracked via POS integration</li>
                    <li>• Cross-device tracking via phone number matching</li>
                    <li>• Real-time updates within 60 seconds of purchase</li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{metrics?.totalRedemptions || 0}</div>
                    <div className="text-sm text-muted-foreground">Attributed Purchases</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">
                      ${((metrics?.totalRevenue || 0) / (metrics?.totalRedemptions || 1)).toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Order Value</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};