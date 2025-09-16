import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Lightbulb, 
  Target,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

interface Insight {
  id: string;
  type: 'alert' | 'opportunity' | 'achievement' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  metric?: string;
  change?: number;
}

interface ActionableInsightsProps {
  engagementRate?: number;
  growth?: number;
  conversions?: number;
}

export const ActionableInsights = ({
  engagementRate = 0,
  growth = 0,
  conversions = 0
}: ActionableInsightsProps) => {
  const insights: Insight[] = [
    {
      id: 'engagement-trend',
      type: 'opportunity',
      title: 'Customer Engagement is Growing',
      description: `Your interaction rate increased by 12.5% this month. Consider scaling your most successful content formats.`,
      impact: 'high',
      actionable: true,
      metric: 'Engagement Rate',
      change: 12.5
    },
    {
      id: 'conversion-optimization',
      type: 'recommendation',
      title: 'Optimize Landing Pages',
      description: 'Your traffic is up 15% but conversions are flat. Focus on improving your call-to-action buttons and page load speed.',
      impact: 'high',
      actionable: true,
      metric: 'Conversion Rate'
    },
    {
      id: 'social-performance',
      type: 'achievement',
      title: 'Social Media Milestone',
      description: 'You reached 1,000 social media interactions this week - a 25% increase from last week.',
      impact: 'medium',
      actionable: false,
      metric: 'Social Engagement',
      change: 25
    },
    {
      id: 'email-open-rate',
      type: 'alert',
      title: 'Email Performance Declining',
      description: 'Your email open rates dropped by 8% this week. Consider testing new subject lines or send times.',
      impact: 'medium',
      actionable: true,
      metric: 'Email Open Rate',
      change: -8
    }
  ];

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'alert': return AlertTriangle;
      case 'opportunity': return TrendingUp;
      case 'achievement': return CheckCircle;
      case 'recommendation': return Lightbulb;
      default: return Target;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'alert': return 'border-l-red-500 bg-red-50';
      case 'opportunity': return 'border-l-green-500 bg-green-50';
      case 'achievement': return 'border-l-blue-500 bg-blue-50';
      case 'recommendation': return 'border-l-yellow-500 bg-yellow-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800">High Impact</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium Impact</Badge>;
      default:
        return <Badge variant="outline">Low Impact</Badge>;
    }
  };

  const getChangeIcon = (change?: number) => {
    if (!change) return null;
    return change > 0 ? TrendingUp : TrendingDown;
  };

  const getChangeColor = (change?: number) => {
    if (!change) return '';
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Actionable Insights</h2>
          <p className="text-muted-foreground">AI-powered recommendations for your business</p>
        </div>
        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
          <Lightbulb className="h-3 w-3 mr-1" />
          Smart Analytics
        </Badge>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => {
          const Icon = getInsightIcon(insight.type);
          const ChangeIcon = getChangeIcon(insight.change);
          
          return (
            <Card 
              key={insight.id}
              className={`border-l-4 transition-all hover:shadow-md ${getInsightColor(insight.type)}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-white p-2 shadow-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{insight.title}</CardTitle>
                      {insight.metric && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">{insight.metric}</span>
                          {insight.change && ChangeIcon && (
                            <div className={`flex items-center gap-1 ${getChangeColor(insight.change)}`}>
                              <ChangeIcon className="h-3 w-3" />
                              <span className="text-sm font-medium">
                                {insight.change > 0 ? '+' : ''}{insight.change}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {getImpactBadge(insight.impact)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-muted-foreground mb-4">{insight.description}</p>
                
                {insight.actionable && (
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" className="gap-2">
                      Take Action
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      Learn More
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Goals */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600" />
            Performance Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Monthly Lead Generation</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-white rounded h-2">
                  <div className="bg-indigo-500 h-2 rounded" style={{ width: '75%' }}></div>
                </div>
                <span className="text-sm font-medium">75%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Customer Engagement Target</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-white rounded h-2">
                  <div className="bg-green-500 h-2 rounded" style={{ width: '90%' }}></div>
                </div>
                <span className="text-sm font-medium">90%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};