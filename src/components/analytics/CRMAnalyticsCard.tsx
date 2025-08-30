import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, MessageSquare, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CRMMetrics {
  totalCustomers: number;
  activeCampaigns: number;
  totalMessages: number;
  engagementRate: number;
  recentCampaigns: Array<{
    name: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
}

export const CRMAnalyticsCard = () => {
  const [metrics, setMetrics] = useState<CRMMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCRMMetrics();
  }, []);

  const fetchCRMMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get tenant_id for the user
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userData?.tenant_id) return;

      // Fetch data sequentially to avoid type issues
      const customersResult = await supabase
        .from('crm_customers')
        .select('id')
        .eq('tenant_id', userData.tenant_id);

      const campaignsResult = await supabase
        .from('crm_campaigns')
        .select('id')
        .eq('tenant_id', userData.tenant_id)
        .eq('status', 'active');

      const messagesResult = await supabase
        .from('sms_messages')
        .select('id')
        .eq('tenant_id', userData.tenant_id);

      const recentCampaignsResult = await supabase
        .from('crm_campaigns')
        .select('name, metrics')
        .eq('tenant_id', userData.tenant_id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Process counts
      const customerCount = customersResult.data?.length || 0;
      const activeCampaignsCount = campaignsResult.data?.length || 0;
      const messagesCount = messagesResult.data?.length || 0;

      // Process campaign data
      const campaignData = recentCampaignsResult.data?.map(campaign => {
        const metrics = campaign.metrics as any || {};
        return {
          name: campaign.name.length > 15 ? campaign.name.substring(0, 15) + '...' : campaign.name,
          sent: Number(metrics.sent) || 0,
          opened: Number(metrics.opened) || 0,
          clicked: Number(metrics.clicked) || 0
        };
      }) || [];

      // Calculate engagement rate
      const totalSent = campaignData.reduce((sum, c) => sum + c.sent, 0);
      const totalOpened = campaignData.reduce((sum, c) => sum + c.opened, 0);
      const engagementRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

      setMetrics({
        totalCustomers: customerCount,
        activeCampaigns: activeCampaignsCount,
        totalMessages: messagesCount,
        engagementRate,
        recentCampaigns: campaignData
      });
    } catch (error) {
      console.error('Error fetching CRM metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            CRM Analytics
            <Badge variant="outline">Loading...</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const crmMetrics = [
    {
      icon: Users,
      label: 'Total Customers',
      value: formatNumber(metrics.totalCustomers),
      color: 'text-blue-600'
    },
    {
      icon: Mail,
      label: 'Active Campaigns',
      value: metrics.activeCampaigns.toString(),
      color: 'text-green-600'
    },
    {
      icon: MessageSquare,
      label: 'Messages Sent',
      value: formatNumber(metrics.totalMessages),
      color: 'text-purple-600'
    },
    {
      icon: TrendingUp,
      label: 'Engagement Rate',
      value: `${metrics.engagementRate.toFixed(1)}%`,
      color: 'text-orange-600'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          CRM Analytics
          <Badge variant="outline">Live Data</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {crmMetrics.map((metric, index) => (
            <div key={index} className="text-center p-3 bg-muted/50 rounded-lg">
              <metric.icon className={`w-5 h-5 mx-auto mb-2 ${metric.color}`} />
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="text-xs text-muted-foreground">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Campaign Performance Chart */}
        {metrics.recentCampaigns.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Recent Campaign Performance</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics.recentCampaigns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value, name) => [formatNumber(value as number), name]}
                />
                <Bar 
                  dataKey="sent" 
                  fill="hsl(var(--primary))" 
                  name="Sent"
                />
                <Bar 
                  dataKey="opened" 
                  fill="hsl(var(--chart-2))" 
                  name="Opened"
                />
                <Bar 
                  dataKey="clicked" 
                  fill="hsl(var(--chart-3))" 
                  name="Clicked"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {metrics.recentCampaigns.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No campaign data available yet.</p>
            <p className="text-sm">Create your first campaign to see analytics here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};