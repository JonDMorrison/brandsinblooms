import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, MessageSquare, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';

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
      // Simulate loading time
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data for now to avoid TypeScript issues
      const mockMetrics: CRMMetrics = {
        totalCustomers: 1247,
        activeCampaigns: 5,
        totalMessages: 8943,
        engagementRate: 24.5,
        recentCampaigns: [
          { name: 'Summer Sale', sent: 1200, opened: 850, clicked: 320 },
          { name: 'Product Launch', sent: 980, opened: 720, clicked: 250 },
          { name: 'Newsletter', sent: 1500, opened: 900, clicked: 180 },
          { name: 'Black Friday', sent: 2100, opened: 1400, clicked: 680 },
          { name: 'Holiday Promo', sent: 800, opened: 520, clicked: 140 }
        ]
      };

      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Error fetching CRM metrics:', error);
      setMetrics({
        totalCustomers: 0,
        activeCampaigns: 0,
        totalMessages: 0,
        engagementRate: 0,
        recentCampaigns: []
      });
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
      color: 'text-primary'
    },
    {
      icon: Mail,
      label: 'Active Campaigns',
      value: metrics.activeCampaigns.toString(),
      color: 'text-secondary'
    },
    {
      icon: MessageSquare,
      label: 'Messages Sent',
      value: formatNumber(metrics.totalMessages),
      color: 'text-accent'
    },
    {
      icon: TrendingUp,
      label: 'Engagement Rate',
      value: `${metrics.engagementRate.toFixed(1)}%`,
      color: 'text-muted-foreground'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          CRM Analytics
          <Badge variant="outline">Demo Data</Badge>
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