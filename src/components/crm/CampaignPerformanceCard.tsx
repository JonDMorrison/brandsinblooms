import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Mail, 
  Eye, 
  MousePointer, 
  TrendingUp, 
  Calendar,
  BarChart3,
  Users
} from 'lucide-react';

interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  revenue?: number;
}

interface CampaignPerformanceCardProps {
  campaignName: string;
  sentDate: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'completed';
  metrics?: CampaignMetrics;
  onViewDetails?: () => void;
}

export const CampaignPerformanceCard: React.FC<CampaignPerformanceCardProps> = ({
  campaignName,
  sentDate,
  status,
  metrics,
  onViewDetails
}) => {
  const calculateRate = (numerator: number, denominator: number): number => {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100);
  };

  const openRate = metrics ? calculateRate(metrics.opened, metrics.delivered || metrics.sent) : 0;
  const clickRate = metrics ? calculateRate(metrics.clicked, metrics.delivered || metrics.sent) : 0;
  const deliveryRate = metrics ? calculateRate(metrics.delivered, metrics.sent) : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'sending': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">
              {campaignName}
            </CardTitle>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatDate(sentDate)}
              </div>
              <Badge className={getStatusColor(status)}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            </div>
          </div>
          {onViewDetails && (
            <Button variant="outline" size="sm" onClick={onViewDetails} className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Details
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {metrics && status !== 'draft' && status !== 'scheduled' ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                  <Mail className="h-4 w-4" />
                  Sent
                </div>
                <div className="text-xl font-bold">{metrics.sent.toLocaleString()}</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                  <Eye className="h-4 w-4" />
                  Opens
                </div>
                <div className="text-xl font-bold">{metrics.opened.toLocaleString()}</div>
                <div className="text-sm text-green-600 font-medium">{openRate}%</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                  <MousePointer className="h-4 w-4" />
                  Clicks
                </div>
                <div className="text-xl font-bold">{metrics.clicked.toLocaleString()}</div>
                <div className="text-sm text-blue-600 font-medium">{clickRate}%</div>
              </div>
              
              {metrics.revenue && metrics.revenue > 0 && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    Revenue
                  </div>
                  <div className="text-xl font-bold">${metrics.revenue.toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* Performance Bars */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Open Rate</span>
                  <span className="font-medium">{openRate}%</span>
                </div>
                <Progress value={openRate} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Click Rate</span>
                  <span className="font-medium">{clickRate}%</span>
                </div>
                <Progress value={clickRate} className="h-2" />
              </div>
              
              {deliveryRate < 95 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Delivery Rate</span>
                    <span className="font-medium">{deliveryRate}%</span>
                  </div>
                  <Progress value={deliveryRate} className="h-2" />
                </div>
              )}
            </div>

            {/* Additional Metrics */}
            {(metrics.bounced > 0 || metrics.unsubscribed > 0) && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                {metrics.bounced > 0 && (
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-1">Bounced</div>
                    <div className="text-lg font-semibold text-orange-600">
                      {metrics.bounced.toLocaleString()}
                    </div>
                  </div>
                )}
                {metrics.unsubscribed > 0 && (
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-1">Unsubscribed</div>
                    <div className="text-lg font-semibold text-red-600">
                      {metrics.unsubscribed.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {status === 'draft' ? 'Campaign not sent yet' : 
               status === 'scheduled' ? 'Scheduled to send' :
               'Analytics will appear once the campaign is sent'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};