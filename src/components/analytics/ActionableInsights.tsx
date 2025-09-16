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
  // Generate real insights based on actual data
  const insights: Insight[] = [];

  // Growth-based insights
  if (growth > 20) {
    insights.push({
      id: 'high-growth',
      type: 'achievement',
      title: 'Exceptional Growth Performance',
      description: `Outstanding! Your metrics grew by ${growth.toFixed(1)}% this period. This momentum suggests your current strategies are highly effective.`,
      impact: 'high',
      actionable: false,
      metric: 'Overall Growth',
      change: growth
    });
  } else if (growth > 10) {
    insights.push({
      id: 'good-growth',
      type: 'opportunity',
      title: 'Strong Growth Momentum',
      description: `Your performance improved by ${growth.toFixed(1)}% this period. Consider doubling down on your most successful campaigns.`,
      impact: 'high',
      actionable: true,
      metric: 'Growth Rate',
      change: growth
    });
  } else if (growth > 0) {
    insights.push({
      id: 'moderate-growth',
      type: 'recommendation',
      title: 'Steady Progress',
      description: `You're growing at ${growth.toFixed(1)}% this period. Look for opportunities to accelerate by optimizing underperforming channels.`,
      impact: 'medium',
      actionable: true,
      metric: 'Growth Rate',
      change: growth
    });
  } else if (growth < -10) {
    insights.push({
      id: 'declining-performance',
      type: 'alert',
      title: 'Performance Decline Needs Attention',
      description: `Your metrics dropped by ${Math.abs(growth).toFixed(1)}% this period. Immediate action needed to identify and address the root causes.`,
      impact: 'high',
      actionable: true,
      metric: 'Performance Decline',
      change: growth
    });
  } else if (growth < 0) {
    insights.push({
      id: 'slight-decline',
      type: 'alert',
      title: 'Small Performance Dip',
      description: `Your performance decreased by ${Math.abs(growth).toFixed(1)}% this period. Monitor closely and consider adjusting your strategy.`,
      impact: 'medium',
      actionable: true,
      metric: 'Performance Change',
      change: growth
    });
  }

  // Engagement-based insights
  if (engagementRate > 15) {
    insights.push({
      id: 'high-engagement',
      type: 'achievement',
      title: 'Excellent Customer Engagement',
      description: `Your ${engagementRate.toFixed(1)}% engagement rate is exceptional. Your audience is highly engaged with your content.`,
      impact: 'high',
      actionable: false,
      metric: 'Engagement Rate',
      change: engagementRate
    });
  } else if (engagementRate > 8) {
    insights.push({
      id: 'good-engagement',
      type: 'opportunity',
      title: 'Strong Customer Interaction',
      description: `With a ${engagementRate.toFixed(1)}% engagement rate, you're doing well. Test different content formats to push even higher.`,
      impact: 'medium',
      actionable: true,
      metric: 'Engagement Rate'
    });
  } else if (engagementRate > 3) {
    insights.push({
      id: 'moderate-engagement',
      type: 'recommendation',
      title: 'Room for Engagement Growth',
      description: `Your ${engagementRate.toFixed(1)}% engagement rate has potential. Focus on creating more interactive and valuable content.`,
      impact: 'medium',
      actionable: true,
      metric: 'Engagement Rate'
    });
  } else if (engagementRate > 0) {
    insights.push({
      id: 'low-engagement',
      type: 'alert',
      title: 'Low Customer Engagement',
      description: `Your ${engagementRate.toFixed(1)}% engagement rate needs improvement. Review your content strategy and posting times.`,
      impact: 'high',
      actionable: true,
      metric: 'Engagement Rate'
    });
  }

  // Conversion-based insights
  if (conversions > 100) {
    insights.push({
      id: 'high-conversions',
      type: 'achievement',
      title: 'Strong Conversion Performance',
      description: `You achieved ${conversions} conversions this period. Your funnel is working effectively.`,
      impact: 'high',
      actionable: false,
      metric: 'Conversions'
    });
  } else if (conversions > 20) {
    insights.push({
      id: 'good-conversions',
      type: 'opportunity',
      title: 'Solid Conversion Results',
      description: `With ${conversions} conversions, you're on the right track. Consider A/B testing your landing pages for even better results.`,
      impact: 'medium',
      actionable: true,
      metric: 'Conversions'
    });
  } else if (conversions > 5) {
    insights.push({
      id: 'moderate-conversions',
      type: 'recommendation',
      title: 'Conversion Optimization Opportunity',
      description: `You have ${conversions} conversions this period. Focus on improving your call-to-action and user experience.`,
      impact: 'medium',
      actionable: true,
      metric: 'Conversions'
    });
  } else if (conversions > 0) {
    insights.push({
      id: 'low-conversions',
      type: 'alert',
      title: 'Low Conversion Rate',
      description: `Only ${conversions} conversions this period. Review your funnel and identify where prospects are dropping off.`,
      impact: 'high',
      actionable: true,
      metric: 'Conversions'
    });
  }

  // Default insights if no data
  if (insights.length === 0) {
    insights.push({
      id: 'getting-started',
      type: 'recommendation',
      title: 'Start Tracking Your Performance',
      description: 'Connect your data sources to get personalized insights about your business performance.',
      impact: 'medium',
      actionable: true,
      metric: 'Setup Required'
    });
  }

  // Limit to top 3 most important insights
  const topInsights = insights.slice(0, 3);

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
        {topInsights.map((insight) => {
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