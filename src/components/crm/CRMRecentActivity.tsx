import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  UserPlus, 
  Mail, 
  ShoppingCart, 
  MessageSquare, 
  TrendingUp, 
  ExternalLink,
  Clock
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface ActivityItem {
  id: string;
  type: 'customer_added' | 'campaign_sent' | 'purchase' | 'engagement' | 'segment_update';
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    customerName?: string;
    campaignName?: string;
    amount?: number;
    segmentName?: string;
  };
}

export const CRMRecentActivity = () => {
  // Mock recent activity data (in real app, this would come from API)
  const activities: ActivityItem[] = [
    {
      id: '1',
      type: 'customer_added',
      title: 'New customer joined',
      description: 'Sarah Johnson signed up via website',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
      metadata: { customerName: 'Sarah Johnson' }
    },
    {
      id: '2',
      type: 'campaign_sent',
      title: 'Email campaign sent',
      description: 'Holiday Sale newsletter sent to 2,450 customers',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
      metadata: { campaignName: 'Holiday Sale' }
    },
    {
      id: '3',
      type: 'purchase',
      title: 'High-value purchase',
      description: 'Michael Chen completed purchase',
      timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(), // 32 mins ago
      metadata: { customerName: 'Michael Chen', amount: 750 }
    },
    {
      id: '4',
      type: 'engagement',
      title: 'Campaign engagement',
      description: '25 customers clicked on Black Friday campaign',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago
      metadata: { campaignName: 'Black Friday' }
    },
    {
      id: '5',
      type: 'segment_update',
      title: 'Segment updated',
      description: '12 customers moved to High-Value segment',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      metadata: { segmentName: 'High-Value' }
    },
    {
      id: '6',
      type: 'customer_added',
      title: 'Bulk import completed',
      description: '147 customers imported from CSV',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'customer_added':
        return <UserPlus className="w-4 h-4 text-green-600" />;
      case 'campaign_sent':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'purchase':
        return <ShoppingCart className="w-4 h-4 text-purple-600" />;
      case 'engagement':
        return <MessageSquare className="w-4 h-4 text-orange-600" />;
      case 'segment_update':
        return <TrendingUp className="w-4 h-4 text-indigo-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'customer_added':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">New Customer</Badge>;
      case 'campaign_sent':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Campaign</Badge>;
      case 'purchase':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Purchase</Badge>;
      case 'engagement':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Engagement</Badge>;
      case 'segment_update':
        return <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">Segment</Badge>;
      default:
        return <Badge variant="secondary">Activity</Badge>;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Activity
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <NavLink to="/crm/analytics">
            <ExternalLink className="w-4 h-4 mr-2" />
            View Analytics
          </NavLink>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
            <div className="flex-shrink-0 mt-0.5">
              {getActivityIcon(activity.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">{activity.title}</h4>
                {getActivityBadge(activity.type)}
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {activity.description}
                {activity.metadata?.amount && (
                  <span className="font-medium text-primary ml-1">
                    ({formatCurrency(activity.metadata.amount)})
                  </span>
                )}
              </p>
              
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(activity.timestamp)}
              </div>
            </div>
          </div>
        ))}
        
        {activities.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No recent activity</p>
            <p className="text-sm">Activity will appear here as customers interact with your campaigns</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};