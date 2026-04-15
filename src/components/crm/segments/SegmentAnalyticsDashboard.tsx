import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Badge } from '@/components/ui-legacy/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Users, TrendingUp, Sparkles, BarChart3 } from 'lucide-react';
import { SYSTEM_SEGMENTS } from '@/config/segmentDefinitions';

interface SegmentAnalyticsDashboardProps {
  counts: Record<string, number>;
  loading: boolean;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const SegmentAnalyticsDashboard = ({ counts, loading }: SegmentAnalyticsDashboardProps) => {
  // Prepare data for pie chart
  const pieData = SYSTEM_SEGMENTS.map((segment, index) => ({
    name: segment.name,
    value: counts[segment.id] || 0,
    color: COLORS[index % COLORS.length],
  })).filter(d => d.value > 0);

  // Total customers (approximation - some may be in multiple segments)
  const totalInSegments = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const uniqueEstimate = Math.round(totalInSegments * 0.7); // Rough estimate accounting for overlap

  // Engagement score distribution (mock data for now)
  const engagementDistribution = [
    { tier: 'Hot', count: Math.round(uniqueEstimate * 0.15), color: '#ef4444' },
    { tier: 'Warm', count: Math.round(uniqueEstimate * 0.35), color: '#f59e0b' },
    { tier: 'Cold', count: Math.round(uniqueEstimate * 0.30), color: '#3b82f6' },
    { tier: 'Dormant', count: Math.round(uniqueEstimate * 0.20), color: '#6b7280' },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 w-32 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Segmented</p>
                <p className="text-2xl font-bold">{uniqueEstimate.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Segments</p>
                <p className="text-2xl font-bold">{pieData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Engagement</p>
                <p className="text-2xl font-bold">--</p>
                <Badge variant="outline" className="text-xs mt-1">Coming Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Value %</p>
                <p className="text-2xl font-bold">
                  {uniqueEstimate > 0 
                    ? Math.round((counts['high-value'] || 0) / uniqueEstimate * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Customer Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customer Distribution by Segment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => value.toLocaleString()}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No segment data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Engagement Tier Distribution
              <Badge variant="outline" className="ml-2 text-xs">Preview</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={engagementDistribution} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="tier" type="category" width={60} />
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {engagementDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-2">
              * Engagement data will be populated after Phase 1 implementation
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
