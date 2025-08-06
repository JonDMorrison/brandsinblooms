import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PersonaPerformanceChart } from '@/components/crm/analytics/PersonaPerformanceChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HeadlineLarge, BodyMedium } from '@/components/ui/typography';
import { TrendingUp, Users, DollarSign, Mail, MessageSquare, ArrowUpIcon, ArrowDownIcon, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';

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
  const [isPersonasCollapsed, setIsPersonasCollapsed] = useState(false);

  const customerPersonas = [
    { name: 'Plant-Killer Pam', count: 0, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
    { name: 'Curb Appeal Ashley', count: 0, color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
    { name: 'DIY Dana', count: 0, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
    { name: 'Patio Gardener Gail', count: 0, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    { name: 'Pet-Friendly Hannah', count: 0, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    { name: 'Pollinator Paula', count: 0, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    { name: 'Sustainable Susie', count: 0, color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' },
    { name: 'Vegetable Garden Veronica', count: 0, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    { name: 'Wellness Whitney', count: 0, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  ];

  // Calculate real growth data based on customer creation dates
  const calculatePersonaGrowth = (customers: any[], personaName: string): number => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const currentMonthCustomers = customers.filter(customer => 
      customer.persona === personaName && 
      new Date(customer.created_at) >= thirtyDaysAgo
    ).length;

    const previousMonthCustomers = customers.filter(customer => 
      customer.persona === personaName && 
      new Date(customer.created_at) >= sixtyDaysAgo && 
      new Date(customer.created_at) < thirtyDaysAgo
    ).length;

    if (previousMonthCustomers === 0) {
      return currentMonthCustomers > 0 ? 100 : 0; // Show 100% for new personas with customers
    }

    return Math.round(((currentMonthCustomers - previousMonthCustomers) / previousMonthCustomers) * 100 * 10) / 10;
  };

  // Fetch customers for persona cards
  const { data: customers = [] } = useQuery({
    queryKey: ['crm-customers-for-personas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_customers')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

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

  // Calculate persona counts for the cards
  const personaCounts = customerPersonas.map(persona => ({
    ...persona,
    count: customers.filter(c => c.persona === persona.name.toLowerCase()).length
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* Customer Personas Overview */}
      <Collapsible open={!isPersonasCollapsed} onOpenChange={(open) => setIsPersonasCollapsed(!open)} className="space-y-8">
        {/* Modern Gradient Header Section */}
        <CollapsibleTrigger asChild>
          <div className="relative bg-gradient-to-br from-slate-50 via-white to-gray-50/30 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl overflow-hidden p-8 cursor-pointer hover:shadow-3xl transition-shadow duration-200">
            {/* Decorative Background Pattern */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-full blur-3xl"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5">
                <Users className="w-64 h-64 text-violet-400" />
              </div>
            </div>
            
            {/* Header Content */}
            <div className="relative z-10 flex items-start justify-between text-left">
              <div className="flex flex-col gap-3 text-left">
                <div className="inline-flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <HeadlineLarge className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent text-left">Your Customer Personas</HeadlineLarge>
                </div>
                <BodyMedium className="text-lg text-slate-600 max-w-2xl leading-relaxed text-left">
                  Track and understand your customer segments to personalize their gardening journey
                </BodyMedium>
              </div>
              
              {/* Collapsible Chevron Icon */}
              <div className="relative z-10 ml-4 p-2 rounded-full hover:bg-white/20 transition-colors duration-200">
                {isPersonasCollapsed ? (
                  <ChevronDown className="w-6 h-6 text-slate-600 transition-transform duration-200" />
                ) : (
                  <ChevronUp className="w-6 h-6 text-slate-600 transition-transform duration-200" />
                )}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-8 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {personaCounts.map((persona, index) => (
              <div 
                key={persona.name}
                className="transform transition-all duration-300 hover:scale-[1.02]"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.6s ease-out forwards'
                }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{persona.name}</p>
                        <p className="text-2xl font-bold">{persona.count}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const growth = calculatePersonaGrowth(customers, persona.name);
                          return growth > 0 ? (
                            <>
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">
                                +{growth}%
                              </span>
                            </>
                          ) : (
                            <>
                              <Minus className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">
                                {growth}%
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>


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