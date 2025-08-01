import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftIcon, MessageSquareIcon, UsersIcon, TrendingUpIcon, ClockIcon } from 'lucide-react'

// Placeholder data - replace with actual data fetching
const SAMPLE_CAMPAIGN = {
  id: '1',
  name: 'Spring Garden Tips',
  message: 'Spring is here! 🌱 Get ready for planting season with our expert tips and 20% off all seeds. Visit us this weekend! Reply STOP to opt out.',
  status: 'sent',
  created_at: '2024-01-15T09:00:00Z',
  sent_at: '2024-01-15T10:30:00Z',
  metrics: {
    sent: 250,
    delivered: 248,
    failed: 2,
    clicked: 45,
    opt_outs: 3,
    revenue: 1250.00
  },
  segment: {
    name: 'All SMS Subscribers',
    customer_count: 250
  }
}

export default function SMSCampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  // Fetch real campaign data
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['sms-campaign', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('crm_sms_campaigns')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  if (!campaign) {
    return <div className="flex items-center justify-center p-8">Campaign not found</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default">Sent</Badge>
      case 'sending':
        return <Badge variant="secondary">Sending</Badge>
      case 'scheduled':
        return <Badge variant="outline">Scheduled</Badge>
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Type guard for metrics
  const metrics = campaign.metrics && typeof campaign.metrics === 'object' ? campaign.metrics as any : {
    sent: 0, delivered: 0, clicked: 0, opt_outs: 0, revenue: 0, failed: 0
  };

  const deliveryRate = metrics.sent > 0 
    ? ((metrics.delivered / metrics.sent) * 100).toFixed(1)
    : '0'

  const clickRate = metrics.delivered > 0
    ? ((metrics.clicked / metrics.delivered) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/sms')}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to SMS
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
            </div>
            <p className="text-muted-foreground">
              Created {new Date(campaign.created_at).toLocaleDateString()}
              {campaign.sent_at && ` • Sent ${new Date(campaign.sent_at).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            Duplicate Campaign
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.sent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              SMS Campaign
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryRate}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.delivered} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clickRate}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.clicked} clicks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(metrics.revenue || 0).toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              From this campaign
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Message Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Content</CardTitle>
              <CardDescription>The SMS message sent to customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    SMS Message ({campaign.message.length} characters)
                  </div>
                  <div className="text-sm leading-relaxed">
                    {campaign.message}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Breakdown</CardTitle>
              <CardDescription>Detailed metrics for this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span>Messages Sent</span>
                  <span className="font-medium">{metrics.sent}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span>Delivered</span>
                  <span className="font-medium">{metrics.delivered}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span>Failed</span>
                  <span className="font-medium text-destructive">{metrics.failed || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span>Clicked</span>
                  <span className="font-medium">{metrics.clicked}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span>Opt-outs</span>
                  <span className="font-medium">{metrics.opt_outs || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span>Revenue Generated</span>
                  <span className="font-medium">${(metrics.revenue || 0).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Status</div>
                {getStatusBadge(campaign.status)}
              </div>
              
              <div>
                <div className="text-sm font-medium mb-1">Target Segment</div>
                <div className="text-sm text-muted-foreground">SMS Campaign</div>
                <div className="text-xs text-muted-foreground">
                  {metrics.sent} recipients
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Created</div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  {new Date(campaign.created_at).toLocaleString()}
                </div>
              </div>

              {campaign.sent_at && (
                <div>
                  <div className="text-sm font-medium mb-1">Sent</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    {new Date(campaign.sent_at).toLocaleString()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}