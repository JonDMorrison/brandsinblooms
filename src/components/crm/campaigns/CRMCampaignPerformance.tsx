import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, Share2, ExternalLink } from 'lucide-react';
import { NavLink } from '@/components/ui/link';

interface CampaignPerformance {
  id: string;
  name: string;
  channel: 'email' | 'sms' | 'social';
  status: 'active' | 'completed' | 'paused';
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  conversions: number;
  revenue: number;
  createdAt: string;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

interface CRMCampaignPerformanceProps {
  campaigns: CampaignPerformance[];
  loading?: boolean;
}

export const CRMCampaignPerformance = ({ 
  campaigns, 
  loading 
}: CRMCampaignPerformanceProps) => {
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4" />;
      case 'social':
        return <Share2 className="w-4 h-4" />;
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 bg-muted animate-pulse rounded w-48"></div>
                <div className="h-4 bg-muted animate-pulse rounded w-20"></div>
                <div className="h-4 bg-muted animate-pulse rounded w-16"></div>
                <div className="h-4 bg-muted animate-pulse rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Campaign Performance</CardTitle>
          <Button asChild variant="outline" size="sm">
            <NavLink to="/crm/campaigns">
              Create Campaign
            </NavLink>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No campaigns found</p>
            <p className="text-sm">Create your first campaign to see performance metrics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Campaign Performance</CardTitle>
        <Button asChild variant="outline" size="sm">
          <NavLink to="/crm/campaigns">
            <ExternalLink className="w-4 h-4 mr-2" />
            View All
          </NavLink>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Open Rate</TableHead>
                <TableHead className="text-right">Click Rate</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.slice(0, 10).map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getChannelIcon(campaign.channel)}
                      <div>
                        <div className="font-medium text-sm">{campaign.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {campaign.channel}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={getStatusColor(campaign.status)}
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.sent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {formatPercentage(campaign.openRate)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {campaign.opened.toLocaleString()} opened
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {formatPercentage(campaign.clickRate)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {campaign.clicked.toLocaleString()} clicked
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {campaign.conversions.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatPercentage(campaign.conversionRate)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(campaign.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};