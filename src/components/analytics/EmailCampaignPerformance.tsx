import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';
import { Badge } from '@/components/ui-legacy/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui-legacy/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui-legacy/collapsible';
import { Mail, Send, Eye, MousePointerClick, TrendingUp, ArrowRight, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui-legacy/skeleton';
import { useCampaignDeliveryMetrics } from '@/hooks/analytics/useCampaignDeliveryMetrics';
import { CampaignDeliveryBreakdown } from './CampaignDeliveryBreakdown';

interface EmailCampaignPerformanceProps {
  dateRange: number;
}

export const EmailCampaignPerformance: React.FC<EmailCampaignPerformanceProps> = ({ dateRange }) => {
  const navigate = useNavigate();
  const { campaigns, loading, summary, recomputeAll, recomputeCampaign, refresh } = useCampaignDeliveryMetrics(dateRange);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [recomputingAll, setRecomputingAll] = useState(false);
  const [recomputingCampaign, setRecomputingCampaign] = useState<string | null>(null);

  const toggleExpanded = (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
    } else {
      newExpanded.add(campaignId);
    }
    setExpandedCampaigns(newExpanded);
  };

  const handleRecomputeAll = async () => {
    setRecomputingAll(true);
    await recomputeAll();
    setRecomputingAll(false);
  };

  const handleRecomputeCampaign = async (campaignId: string) => {
    setRecomputingCampaign(campaignId);
    await recomputeCampaign(campaignId);
    setRecomputingCampaign(null);
  };

  const getRateBadge = (rate: number, type: 'open' | 'click') => {
    const threshold = type === 'open' ? 20 : 3;
    const variant = rate >= threshold ? 'default' : rate >= threshold * 0.5 ? 'secondary' : 'outline';
    return (
      <Badge variant={variant} className="font-mono">
        {rate.toFixed(1)}%
      </Badge>
    );
  };

  const staleCampaignsCount = campaigns.filter(c => c.isStale).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Campaign Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Campaign Performance
          </CardTitle>
          <div className="flex items-center gap-2">
            {staleCampaignsCount > 0 && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {staleCampaignsCount} stale
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRecomputeAll}
              disabled={recomputingAll}
              className="gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${recomputingAll ? 'animate-spin' : ''}`} />
              Recompute All
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/crm/campaigns')}>
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Send className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{summary.totalCampaigns}</p>
            <p className="text-xs text-muted-foreground">Campaigns Sent</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold">{summary.totalDelivered.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Emails Delivered</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Ban className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{summary.totalSkipped.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Eye className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{summary.avgOpenRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Avg Open Rate</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <MousePointerClick className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{summary.avgClickRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Avg Click Rate</p>
          </div>
        </div>

        {/* Recent Campaigns Table */}
        {campaigns.length > 0 ? (
          <div className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                  <TableHead className="text-right">Click Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <React.Fragment key={campaign.campaignId}>
                    <TableRow className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(campaign.campaignId);
                          }}
                        >
                          {expandedCampaigns.has(campaign.campaignId) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell 
                        className="font-medium"
                        onClick={() => navigate(`/crm/campaigns/${campaign.campaignId}`)}
                      >
                        <div className="flex items-center gap-2">
                          {campaign.campaignName}
                          {campaign.isStale && (
                            <AlertTriangle className="h-3 w-3 text-yellow-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => navigate(`/crm/campaigns/${campaign.campaignId}`)}>
                        {campaign.sentAt ? format(new Date(campaign.sentAt), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right" onClick={() => navigate(`/crm/campaigns/${campaign.campaignId}`)}>
                        {campaign.computedDelivered.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right" onClick={() => navigate(`/crm/campaigns/${campaign.campaignId}`)}>
                        {campaign.skipsTotal > 0 ? (
                          <Badge variant="outline" className="font-mono">
                            {campaign.skipsTotal.toLocaleString()}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right" onClick={() => navigate(`/crm/campaigns/${campaign.campaignId}`)}>
                        {getRateBadge(campaign.openRate, 'open')}
                      </TableCell>
                      <TableCell className="text-right" onClick={() => navigate(`/crm/campaigns/${campaign.campaignId}`)}>
                        {getRateBadge(campaign.clickRate, 'click')}
                      </TableCell>
                    </TableRow>
                    {expandedCampaigns.has(campaign.campaignId) && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <CampaignDeliveryBreakdown
                            campaign={campaign}
                            onRecompute={handleRecomputeCampaign}
                            recomputing={recomputingCampaign === campaign.campaignId}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No email campaigns sent in this period</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/crm/campaigns/new')}>
              Create Campaign
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
