import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PersonaPerformanceChart } from '@/components/crm/analytics/PersonaPerformanceChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Users, DollarSign, Mail, MessageSquare, ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface PersonaMetrics {
  persona_id: string;
  persona_name: string;
  customer_count: number;
  total_revenue: number;
  avg_order_value: number;
  email_open_rate: number;
  sms_click_rate: number;
  engagement_score: number;
}

const PersonaAnalytics = () => {
  const [timeRange, setTimeRange] = useState('30d');

  const { data: personaMetrics, isLoading } = useQuery({
    queryKey: ['persona-analytics', timeRange],
    queryFn: async () => {
      // This would be replaced with actual analytics data from the database
      // For now, we'll return mock data based on personas
      const { data: personas } = await supabase
        .from('personas')
        .select('*');

      const { data: customers } = await supabase
        .from('crm_customers')
        .select('persona_id, total_spent, order_history');

      if (!personas || !customers) return [];

      // Calculate metrics for each persona
      const metrics: PersonaMetrics[] = personas.map(persona => {
        const personaCustomers = customers.filter(c => c.persona_id === persona.id);
        const totalRevenue = personaCustomers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
        const avgOrderValue = personaCustomers.length > 0 ? totalRevenue / personaCustomers.length : 0;

        return {
          persona_id: persona.id,
          persona_name: persona.name,
          customer_count: personaCustomers.length,
          total_revenue: totalRevenue,
          avg_order_value: avgOrderValue,
          email_open_rate: Math.random() * 60 + 20, // Mock data
          sms_click_rate: Math.random() * 40 + 10, // Mock data
          engagement_score: Math.random() * 80 + 20, // Mock data
        };
      });

      return metrics.sort((a, b) => b.total_revenue - a.total_revenue);
    },
  });

  const totalCustomers = personaMetrics?.reduce((sum, p) => sum + p.customer_count, 0) || 0;
  const totalRevenue = personaMetrics?.reduce((sum, p) => sum + p.total_revenue, 0) || 0;
  const avgEngagement = personaMetrics?.reduce((sum, p) => sum + p.engagement_score, 0) / (personaMetrics?.length || 1) || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Persona Analytics</h1>
          <p className="text-muted-foreground">
            Track performance and engagement across customer personas
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <ArrowUpIcon className="h-3 w-3 mr-1" />
                +12%
              </span>
              vs last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <ArrowUpIcon className="h-3 w-3 mr-1" />
                +8%
              </span>
              vs last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEngagement.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 flex items-center">
                <ArrowDownIcon className="h-3 w-3 mr-1" />
                -2%
              </span>
              vs last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Personas</CardTitle>
            <Badge className="h-4 px-2 text-xs">
              {personaMetrics?.filter(p => p.customer_count > 0).length || 0}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {personaMetrics?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total personas defined
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <PersonaPerformanceChart data={personaMetrics || []} isLoading={isLoading} />

      {/* Detailed Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Persona Metrics</CardTitle>
          <CardDescription>
            Comprehensive performance data for each customer persona
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Persona</th>
                  <th className="text-right py-3 px-2">Customers</th>
                  <th className="text-right py-3 px-2">Revenue</th>
                  <th className="text-right py-3 px-2">Avg Order</th>
                  <th className="text-right py-3 px-2">Email Rate</th>
                  <th className="text-right py-3 px-2">SMS Rate</th>
                  <th className="text-right py-3 px-2">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {personaMetrics?.map((persona, index) => (
                  <tr key={persona.persona_id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm">
                          {index + 1}
                        </div>
                        <span className="font-medium">{persona.persona_name}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">{persona.customer_count.toLocaleString()}</td>
                    <td className="text-right py-3 px-2">${persona.total_revenue.toLocaleString()}</td>
                    <td className="text-right py-3 px-2">${persona.avg_order_value.toFixed(0)}</td>
                    <td className="text-right py-3 px-2">
                      <Badge variant="outline">{persona.email_open_rate.toFixed(1)}%</Badge>
                    </td>
                    <td className="text-right py-3 px-2">
                      <Badge variant="outline">{persona.sms_click_rate.toFixed(1)}%</Badge>
                    </td>
                    <td className="text-right py-3 px-2">
                      <Badge 
                        variant={persona.engagement_score >= 70 ? "default" : 
                               persona.engagement_score >= 50 ? "secondary" : "destructive"}
                      >
                        {persona.engagement_score.toFixed(0)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!personaMetrics || personaMetrics.length === 0) && !isLoading && (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No analytics data yet</h3>
              <p className="text-muted-foreground">
                Analytics will appear once you have customers assigned to personas
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonaAnalytics;