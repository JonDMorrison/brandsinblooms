import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SettingsIcon, PlusIcon, RefreshCw, Smartphone, Zap, CheckCircle } from 'lucide-react';
import { useTwilioSetup } from '@/components/dashboard/TwilioSetupChecker';
import { useSMSStats } from '@/hooks/useSMSStats';
import { SMSStatCards } from '@/components/sms/SMSStatCards';
import { SMSCampaignsTable } from '@/components/sms/SMSCampaignsTable';
import { SMSRecentMessages } from '@/components/sms/SMSRecentMessages';
import { SMSQueueStatus } from '@/components/sms/SMSQueueStatus';
import { SMSQuickSend } from '@/components/sms/SMSQuickSend';
import { SMSSetupWizard } from '@/components/sms/SMSSetupWizard';

export default function SMSDashboard() {
  const navigate = useNavigate();
  const { data: twilioSetup } = useTwilioSetup();
  const { data: stats, isLoading, refetch } = useSMSStats();

  const handleCreateCampaign = () => {
    if (!twilioSetup?.isSetup) {
      navigate('/dashboard/integrations');
      return;
    }
    navigate('/sms/new');
  };

  const handleCardClick = (cardType: string) => {
    const element = document.getElementById(cardType === 'queue' ? 'queue' : 
                                          cardType === 'subscribers' ? 'campaigns' : 
                                          cardType === 'clicks' ? 'messages' : cardType);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  // Show loading skeletons if needed, but don't block the entire UI

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SMS Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage your SMS marketing campaigns
          </p>
        </div>
        <div className="flex items-center gap-3">
          {twilioSetup?.isSetup ? (
            <Badge variant="outline" className="text-green-600 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              SMS Ready
            </Badge>
          ) : (
            <SMSSetupWizard
              trigger={
                <Button variant="outline" size="sm">
                  <Zap className="h-4 w-4 mr-2" />
                  Setup Wizard
                </Button>
              }
              onComplete={() => window.location.reload()}
            />
          )}
          <Button
            variant="outline"
            onClick={() => navigate('/sms/automations')}
          >
            <SettingsIcon className="h-4 w-4 mr-2" />
            Automations
          </Button>
          <Button onClick={handleCreateCampaign} size="lg">
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Twilio Status */}
      {!twilioSetup?.isSetup && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-orange-900">
              <Smartphone className="h-5 w-5" />
              <span>SMS Setup Required</span>
            </CardTitle>
            <CardDescription className="text-orange-700">
              Complete SMS setup to start creating campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <SMSSetupWizard
              trigger={
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Zap className="h-4 w-4 mr-2" />
                  Start Setup Wizard
                </Button>
              }
              onComplete={() => window.location.reload()}
            />
            <Button 
              variant="outline"
              onClick={() => navigate('/dashboard/integrations')}
            >
              Manual Setup
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats - Minimal */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <SMSStatCards stats={stats || {
          subscribers: 0,
          credits: 2847,
          deliverability: 95,
          clicks: 0,
          queuedMessages: 0,
          recentCampaigns: [],
          recentMessages: []
        }} onCardClick={handleCardClick} />
      )}

      {/* Main Content Grid - Campaign Focused */}
      <div className="grid gap-8 lg:grid-cols-4">
        {/* Left Column - Primary Content */}
        <div className="lg:col-span-3 space-y-8">
          {isLoading ? (
            <div className="space-y-8">
              <Card className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-32 bg-muted rounded"></div>
                </CardContent>
              </Card>
              <Card className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-48 bg-muted rounded"></div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <SMSCampaignsTable 
                campaigns={stats?.recentCampaigns || []} 
                onCreateCampaign={handleCreateCampaign}
              />
              <SMSRecentMessages messages={stats?.recentMessages || []} />
            </>
          )}
        </div>

        {/* Right Column - Tools & Queue */}
        <div className="space-y-6">
          <SMSQuickSend onSent={() => refetch()} />
          {isLoading ? (
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ) : (
            <SMSQueueStatus 
              queuedMessages={stats?.queuedMessages || 0}
              onRefresh={() => refetch()}
            />
          )}
        </div>
      </div>
    </div>
  );
}