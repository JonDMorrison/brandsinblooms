import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SettingsIcon, PlusIcon, RefreshCw, Smartphone } from 'lucide-react';
import { useTwilioSetup } from '@/components/dashboard/TwilioSetupChecker';
import { useSMSStats } from '@/hooks/useSMSStats';
import { SMSStatCards } from '@/components/sms/SMSStatCards';
import { SMSCampaignsTable } from '@/components/sms/SMSCampaignsTable';
import { SMSRecentMessages } from '@/components/sms/SMSRecentMessages';
import { SMSQueueStatus } from '@/components/sms/SMSQueueStatus';
import { SMSQuickSend } from '@/components/sms/SMSQuickSend';

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

  if (!stats) {
    return (
      <div className="space-y-8">
        {/* Loading state */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SMS Command Center</h1>
            <p className="text-muted-foreground">Loading your SMS analytics...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SMS Command Center</h1>
          <p className="text-muted-foreground">
            Real-time SMS marketing dashboard and controls
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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

      {/* Twilio Status */}
      {!twilioSetup?.isSetup && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-orange-900">
              <Smartphone className="h-5 w-5" />
              <span>SMS Setup Required</span>
            </CardTitle>
            <CardDescription className="text-orange-700">
              Configure Twilio credentials to enable SMS functionality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/dashboard/integrations')}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Complete Setup
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <SMSStatCards stats={stats} onCardClick={handleCardClick} />

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Campaigns and Messages */}
        <div className="lg:col-span-2 space-y-8">
          <SMSCampaignsTable 
            campaigns={stats.recentCampaigns} 
            onCreateCampaign={handleCreateCampaign}
          />
          <SMSRecentMessages messages={stats.recentMessages} />
        </div>

        {/* Right Column - Queue and Quick Send */}
        <div className="space-y-8">
          <SMSQueueStatus 
            queuedMessages={stats.queuedMessages}
            onRefresh={() => refetch()}
          />
          <SMSQuickSend onSent={() => refetch()} />
        </div>
      </div>
    </div>
  );
}