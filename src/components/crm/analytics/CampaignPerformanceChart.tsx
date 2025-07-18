import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface Campaign {
  id: string;
  name: string;
  sent_at: string | null;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    revenue: number;
  };
}

interface CampaignPerformanceChartProps {
  campaigns: Campaign[];
}

export const CampaignPerformanceChart = ({ campaigns }: CampaignPerformanceChartProps) => {
  const chartData = React.useMemo(() => {
    return campaigns
      .filter(campaign => campaign.sent_at)
      .sort((a, b) => new Date(a.sent_at!).getTime() - new Date(b.sent_at!).getTime())
      .map(campaign => {
        const openRate = campaign.metrics.delivered > 0 
          ? (campaign.metrics.opened / campaign.metrics.delivered * 100) 
          : 0;
        const clickRate = campaign.metrics.opened > 0 
          ? (campaign.metrics.clicked / campaign.metrics.opened * 100) 
          : 0;
        
        return {
          name: campaign.name.length > 20 ? campaign.name.substring(0, 20) + '...' : campaign.name,
          fullName: campaign.name,
          date: new Date(campaign.sent_at!).toLocaleDateString(),
          openRate: Math.round(openRate * 10) / 10,
          clickRate: Math.round(clickRate * 10) / 10,
          opens: campaign.metrics.opened,
          clicks: campaign.metrics.clicked,
          sent: campaign.metrics.sent,
          revenue: campaign.metrics.revenue,
        };
      });
  }, [campaigns]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Open & Click Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📈 Open & Click Rates Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelFormatter={(label, payload) => {
                  const data = payload?.[0]?.payload;
                  return data ? `${data.fullName} (${data.date})` : label;
                }}
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === 'openRate' ? 'Open Rate' : 'Click Rate'
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="openRate" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="clickRate" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--secondary))', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue & Volume */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💰 Revenue & Email Volume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                yAxisId="revenue"
                orientation="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="volume"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{ value: 'Emails Sent', angle: 90, position: 'insideRight' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelFormatter={(label, payload) => {
                  const data = payload?.[0]?.payload;
                  return data ? `${data.fullName} (${data.date})` : label;
                }}
                formatter={(value: number, name: string) => [
                  name === 'revenue' ? `$${value.toFixed(2)}` : value.toLocaleString(),
                  name === 'revenue' ? 'Revenue' : 'Emails Sent'
                ]}
              />
              <Bar 
                yAxisId="revenue"
                dataKey="revenue" 
                fill="hsl(var(--primary))" 
                opacity={0.8}
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                yAxisId="volume"
                dataKey="sent" 
                fill="hsl(var(--muted))" 
                opacity={0.6}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};