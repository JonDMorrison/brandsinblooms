import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquareIcon, PlusIcon, SettingsIcon, TrendingUpIcon, UsersIcon, SendIcon, ClockIcon } from 'lucide-react'
import { useTwilioSetup } from '@/components/dashboard/TwilioSetupChecker'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/hooks/useTenant'

export default function SMSDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tenant } = useTenant()
  const { data: twilioSetup } = useTwilioSetup()

  // Fetch real SMS campaign data
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['sms-campaigns', user?.id],
    queryFn: async () => {
      if (!user || !tenant) return [];
      
      const { data, error } = await supabase
        .from('crm_sms_campaigns')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!tenant
  });

  // Calculate stats from real data
  const stats = useMemo(() => {
    const getMetrics = (campaign: any) => campaign.metrics && typeof campaign.metrics === 'object' ? campaign.metrics as any : {};
    
    const totalSent = campaigns.reduce((sum, campaign) => sum + (getMetrics(campaign).sent || 0), 0);
    const totalDelivered = campaigns.reduce((sum, campaign) => sum + (getMetrics(campaign).delivered || 0), 0);
    const totalClicked = campaigns.reduce((sum, campaign) => sum + (getMetrics(campaign).clicked || 0), 0);
    const totalOptOuts = campaigns.reduce((sum, campaign) => sum + (getMetrics(campaign).opt_outs || 0), 0);

    return {
      totalSent,
      deliveryRate: totalSent > 0 ? ((totalDelivered / totalSent) * 100) : 0,
      clickRate: totalDelivered > 0 ? ((totalClicked / totalDelivered) * 100) : 0,
      optOutRate: totalSent > 0 ? ((totalOptOuts / totalSent) * 100) : 0,
      recentCampaigns: campaigns.slice(0, 5).map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        sent: getMetrics(campaign).sent || 0,
        delivered: getMetrics(campaign).delivered || 0,
        status: campaign.status
      }))
    };
  }, [campaigns]);

  const handleCreateCampaign = () => {
    if (!twilioSetup?.isSetup) {
      // Show Twilio setup modal/redirect
      navigate('/dashboard/integrations')
      return
    }
    navigate('/sms/new')
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
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading SMS dashboard...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SMS Marketing</h1>
          <p className="text-muted-foreground">
            Send targeted SMS campaigns to your customers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/sms/automations')}
          >
            <SettingsIcon className="h-4 w-4 mr-2" />
            Automations
          </Button>
          <Button onClick={handleCreateCampaign}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Setup Check */}
      {!twilioSetup?.isSetup && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900">SMS Setup Required</CardTitle>
            <CardDescription className="text-orange-700">
              Configure Twilio to start sending SMS campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/dashboard/integrations')}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Setup SMS
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <SendIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              SMS messages sent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveryRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Messages delivered successfully
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clickRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Average click-through rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opt-out Rate</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.optOutRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Customer opt-out rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
          <CardDescription>
            Your latest SMS marketing campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquareIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No SMS campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first SMS campaign to get started
              </p>
              <Button onClick={handleCreateCampaign}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/sms/${campaign.id}`)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{campaign.name}</h4>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{campaign.sent} sent</span>
                      <span>{campaign.delivered} delivered</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}