import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, TrendingUp, Users, MousePointer, Gift, AlertTriangle } from 'lucide-react';
import { useROIAnalytics } from '@/hooks/useROIAnalytics';
import { supabase } from '@/integrations/supabase/client';

interface Campaign {
  id: string;
  name: string;
  status: string;
  created_at: string;
  metrics?: any;
}

export const ROIDashboard = () => {
  const { loading } = useROIAnalytics();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [topCampaigns, setTopCampaigns] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  const fetchDashboardData = async () => {
    try {
      // Fetch campaigns with analytics
      const { data: campaignsData } = await supabase
        .from('crm_sms_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (campaignsData) {
        // Get analytics for each campaign
        const campaignsWithMetrics = await Promise.all(
          campaignsData.map(async (campaign) => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - selectedPeriod);

            const { data: events } = await supabase
              .from('analytics_events')
              .select('*')
              .eq('campaign_id', campaign.id)
              .gte('created_at', startDate.toISOString());

            const { data: coupons } = await supabase
              .from('coupons')
              .select('*')
              .eq('campaign_id', campaign.id)
              .gte('created_at', startDate.toISOString());

            const metrics = calculateMetrics(events || [], coupons || []);
            return { ...campaign, metrics };
          })
        );

        setCampaigns(campaignsWithMetrics);
        
        // Sort by revenue for top campaigns
        const sorted = campaignsWithMetrics
          .filter(c => c.metrics?.totalRevenue > 0)
          .sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue)
          .slice(0, 5);
        
        setTopCampaigns(sorted);

        // Check for alerts
        checkROIAlerts(campaignsWithMetrics);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const calculateMetrics = (events: any[], coupons: any[]) => {
    const totalSent = events.filter(e => e.event_type === 'sms_sent').length;
    const totalClicks = events.filter(e => e.event_type === 'link_click').length;
    const totalRedemptions = events.filter(e => e.event_type === 'coupon_redeem').length;
    const totalRevenue = events
      .filter(e => e.event_type === 'coupon_redeem')
      .reduce((sum, e) => sum + ((e.payload as any)?.net_sales || 0), 0);

    const ctr = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;
    const revenuePerSend = totalSent > 0 ? totalRevenue / totalSent : 0;
    const costPerSend = 0.02; // $0.02 per SMS
    const roi = totalSent > 0 ? ((totalRevenue - (totalSent * costPerSend)) / (totalSent * costPerSend)) * 100 : 0;

    return {
      totalSent,
      totalClicks,
      totalRedemptions,
      totalRevenue,
      ctr,
      revenuePerSend,
      roi,
      redemptionRate: coupons.length > 0 ? (totalRedemptions / coupons.length) * 100 : 0
    };
  };

  const checkROIAlerts = (campaigns: Campaign[]) => {
    const newAlerts = [];
    
    campaigns.forEach(campaign => {
      if (campaign.metrics?.revenuePerSend > 3) {
        newAlerts.push({
          type: 'high-roi',
          campaign: campaign.name,
          value: campaign.metrics.revenuePerSend,
          message: `High-performing campaign! $${campaign.metrics.revenuePerSend.toFixed(2)} per send`
        });
      } else if (campaign.metrics?.revenuePerSend < 0.10 && campaign.metrics?.totalSent > 100) {
        newAlerts.push({
          type: 'low-roi',
          campaign: campaign.name,
          value: campaign.metrics.revenuePerSend,
          message: `Low ROI alert: Only $${campaign.metrics.revenuePerSend.toFixed(2)} per send`
        });
      }
    });

    setAlerts(newAlerts);
  };

  const overallMetrics = campaigns.reduce((acc, campaign) => {
    const m = campaign.metrics || {};
    return {
      totalSent: acc.totalSent + (m.totalSent || 0),
      totalRevenue: acc.totalRevenue + (m.totalRevenue || 0),
      totalClicks: acc.totalClicks + (m.totalClicks || 0),
      totalRedemptions: acc.totalRedemptions + (m.totalRedemptions || 0)
    };
  }, { totalSent: 0, totalRevenue: 0, totalClicks: 0, totalRedemptions: 0 });

  const overallCTR = overallMetrics.totalSent > 0 ? (overallMetrics.totalClicks / overallMetrics.totalSent) * 100 : 0;
  const overallRevenuePerSend = overallMetrics.totalSent > 0 ? overallMetrics.totalRevenue / overallMetrics.totalSent : 0;

  const chartData = topCampaigns.map(campaign => ({
    name: campaign.name.substring(0, 15) + '...',
    revenue: campaign.metrics?.totalRevenue || 0,
    sent: campaign.metrics?.totalSent || 0,
    roi: campaign.metrics?.roi || 0
  }));

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Card key={index} className={`border-l-4 ${alert.type === 'high-roi' ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${alert.type === 'high-roi' ? 'text-green-500' : 'text-red-500'}`} />
                  <span className="font-medium">{alert.campaign}</span>
                  <Badge variant={alert.type === 'high-roi' ? 'default' : 'destructive'}>
                    {alert.type === 'high-roi' ? 'High ROI' : 'Low ROI'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Period Selector */}
      <div className="flex gap-2">
        {[7, 30, 90].map(days => (
          <Button
            key={days}
            variant={selectedPeriod === days ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod(days)}
          >
            {days} days
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${overallMetrics.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ${overallRevenuePerSend.toFixed(2)} per send
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallCTR.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {overallMetrics.totalClicks} clicks / {overallMetrics.totalSent} sent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redemptions</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.totalRedemptions}</div>
            <p className="text-xs text-muted-foreground">
              Total coupon redemptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.totalSent}</div>
            <p className="text-xs text-muted-foreground">
              Last {selectedPeriod} days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Top Campaigns by Revenue</TabsTrigger>
          <TabsTrigger value="roi">ROI Analysis</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Campaigns</CardTitle>
              <CardDescription>Revenue generated by top campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? `$${value}` : value,
                      name === 'revenue' ? 'Revenue' : 'Messages Sent'
                    ]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ROI Distribution</CardTitle>
              <CardDescription>Return on investment by campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, roi }) => `${name}: ${roi.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="roi"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'ROI']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance Details</CardTitle>
              <CardDescription>Detailed metrics for each campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.slice(0, 5).map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{campaign.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {campaign.metrics?.totalSent || 0} sent • {campaign.metrics?.totalClicks || 0} clicks
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${(campaign.metrics?.totalRevenue || 0).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">
                        {(campaign.metrics?.roi || 0).toFixed(1)}% ROI
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};