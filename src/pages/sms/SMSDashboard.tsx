import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquareIcon, PlusIcon, SettingsIcon, TrendingUpIcon, UsersIcon, SendIcon, ClockIcon } from 'lucide-react'
import { useTwilioSetup } from '@/components/dashboard/TwilioSetupChecker'

// Placeholder data - will be replaced with actual data hooks
const SAMPLE_CAMPAIGNS = [
  {
    id: '1',
    name: 'Spring Garden Tips',
    status: 'sent',
    sent_at: '2024-01-15T10:30:00Z',
    metrics: { sent: 250, delivered: 248, clicked: 45 }
  },
  {
    id: '2', 
    name: 'Weekend Sale Alert',
    status: 'sending',
    sent_at: '2024-01-16T09:00:00Z',
    metrics: { sent: 156, delivered: 150, clicked: 28 }
  }
]

const SAMPLE_STATS = {
  totalSent: 1250,
  deliveryRate: 98.5,
  clickRate: 12.8,
  optInRate: 65.2
}

export default function SMSDashboard() {
  const navigate = useNavigate()
  const { data: twilioSetup } = useTwilioSetup()

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
            <div className="text-2xl font-bold">{SAMPLE_STATS.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              SMS messages this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{SAMPLE_STATS.deliveryRate}%</div>
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
            <div className="text-2xl font-bold">{SAMPLE_STATS.clickRate}%</div>
            <p className="text-xs text-muted-foreground">
              Average click-through rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opt-in Rate</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{SAMPLE_STATS.optInRate}%</div>
            <p className="text-xs text-muted-foreground">
              Customers opted in for SMS
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
          {SAMPLE_CAMPAIGNS.length === 0 ? (
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
              {SAMPLE_CAMPAIGNS.map((campaign) => (
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
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        {new Date(campaign.sent_at).toLocaleDateString()}
                      </span>
                      <span>{campaign.metrics.sent} sent</span>
                      <span>{campaign.metrics.delivered} delivered</span>
                      <span>{campaign.metrics.clicked} clicked</span>
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