import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, Target } from 'lucide-react';

interface TimeSeriesDataPoint {
  date: string;
  revenue: number;
  conversions: number;
  customers: number;
}

interface CRMTimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  loading?: boolean;
}

export const CRMTimeSeriesChart = ({ data, loading }: CRMTimeSeriesChartProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Performance Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format data for display
  const chartData = data.map(point => ({
    ...point,
    date: new Date(point.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Performance Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                yAxisId="revenue"
                orientation="left"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
              />
              <YAxis 
                yAxisId="conversions"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                  if (name === 'conversions') return [value.toLocaleString(), 'Conversions'];
                  return [value.toLocaleString(), name];
                }}
              />
              <Legend />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                name="Revenue"
              />
              <Line
                yAxisId="conversions"
                type="monotone"
                dataKey="conversions"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--chart-2))', strokeWidth: 2 }}
                name="Conversions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};