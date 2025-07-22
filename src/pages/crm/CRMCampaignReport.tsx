import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { 
  Mail, 
  Eye, 
  MousePointer, 
  TrendingUp, 
  Users, 
  Calendar,
  DollarSign,
  AlertTriangle
} from 'lucide-react';

interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  revenue: number;
}

interface Campaign {
  id: string;
  name: string;
  subject_line: string;
  status: string;
  sent_at: string;
  metrics: any; // Using any since it comes from JSON
  send_reasoning: string;
  auto_send_enabled: boolean;
  predicted_segment_ids: string[];
}

const CRMCampaignReport: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (campaignId) {
      loadCampaignData();
    }
  }, [campaignId]);

  const loadCampaignData = async () => {
    try {
      // Get campaign data
      const { data: campaignData, error: campaignError } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError) throw campaignError;
      setCampaign(campaignData);

      // Get segment data
      const { data: segmentData, error: segmentError } = await supabase
        .from('campaign_segments')
        .select(`
          *,
          crm_segments(*)
        `)
        .eq('campaign_id', campaignId);

      if (segmentError) throw segmentError;
      setSegments(segmentData || []);

    } catch (error) {
      console.error('Failed to load campaign data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return 0;
    return (numerator / denominator) * 100;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading campaign report...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Campaign not found</h3>
            <p className="text-muted-foreground">
              The campaign you're looking for doesn't exist or you don't have access to it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const metrics = campaign.metrics || {
    sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, revenue: 0
  };

  const openRate = calculateRate(metrics.opened, metrics.delivered);
  const clickRate = calculateRate(metrics.clicked, metrics.opened);
  const deliveryRate = calculateRate(metrics.delivered, metrics.sent);
  const bounceRate = calculateRate(metrics.bounced, metrics.sent);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Campaign Report
            </h1>
            <p className="text-muted-foreground">{campaign.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={campaign.status === 'sent' ? 'secondary' : 'default'}>
              {campaign.status}
            </Badge>
            {campaign.auto_send_enabled && (
              <Badge variant="outline" className="border-primary text-primary">
                Auto-Send
              </Badge>
            )}
          </div>
        </div>

        {/* Campaign Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Subject Line</label>
                <p className="font-medium">{campaign.subject_line}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Sent Date</label>
                <p className="font-medium">
                  {campaign.sent_at ? formatDate(campaign.sent_at) : 'Not sent'}
                </p>
              </div>
            </div>
            
            {campaign.send_reasoning && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Smart Timing Reasoning</label>
                <p className="text-sm">{campaign.send_reasoning}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold">{metrics.sent.toLocaleString()}</p>
                </div>
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Open Rate</p>
                  <p className="text-2xl font-bold">{openRate.toFixed(1)}%</p>
                  <Progress value={openRate} className="mt-2 h-2" />
                </div>
                <Eye className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Click Rate</p>
                  <p className="text-2xl font-bold">{clickRate.toFixed(1)}%</p>
                  <Progress value={clickRate} className="mt-2 h-2" />
                </div>
                <MousePointer className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">${metrics.revenue.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Delivery Rate</span>
                <span className="font-medium">{deliveryRate.toFixed(1)}%</span>
              </div>
              <Progress value={deliveryRate} className="h-2" />
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Bounce Rate</span>
                <span className="font-medium text-destructive">{bounceRate.toFixed(1)}%</span>
              </div>
              <Progress value={bounceRate} className="h-2" />

              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Delivered:</span>
                  <span>{metrics.delivered.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bounced:</span>
                  <span>{metrics.bounced.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unsubscribed:</span>
                  <span>{metrics.unsubscribed.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audience Segments</CardTitle>
            </CardHeader>
            <CardContent>
              {segments.length > 0 ? (
                <div className="space-y-3">
                  {segments.map((segmentLink) => (
                    <div
                      key={segmentLink.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {segmentLink.crm_segments?.name || 'Unknown Segment'}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {segmentLink.crm_segments?.customer_count?.toLocaleString() || 0} customers
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p>No segments selected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Insights */}
        {campaign.status === 'sent' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {openRate > 25 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Great open rate! Your subject line resonated well with your audience.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Consider A/B testing different subject lines to improve open rates.</span>
                  </div>
                )}
                
                {clickRate > 5 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <MousePointer className="h-4 w-4" />
                    <span className="text-sm">Excellent click-through rate! Your content is engaging your audience.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Try adding clearer call-to-action buttons to increase engagement.</span>
                  </div>
                )}

                {bounceRate > 2 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">High bounce rate detected. Consider cleaning your email list.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CRMCampaignReport;