import React, { useState, useEffect } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Mail, Target, TrendingUp, MessageSquare, AlertCircle, BarChart3, Eye, MousePointerClick, UserMinus, Smartphone, CheckCircle, AlertTriangle, Sparkles, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { Link } from 'react-router-dom';
import { HeroMetricsSection } from '@/components/crm/HeroMetricsSection';
import { QuickStartStepper } from '@/components/crm/QuickStartStepper';
import { EmptyStateSection } from '@/components/crm/EmptyStateSection';
import { FeatureHighlightsCard } from '@/components/crm/FeatureHighlightsCard';

const CRMDashboard = () => {
  const { subscription } = useSubscription();
  const [customerStats, setCustomerStats] = useState({
    total: 0,
    smsOptedIn: 0,
    smsOptInRate: 0
  });

  const [campaignStats, setCampaignStats] = useState({
    email: {
      totalSent: 0,
      campaignCount: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      totalUnsubscribes: 0
    },
    sms: {
      totalSent: 0,
      campaignCount: 0,
      deliveryRate: 0,
      clickRate: 0,
      totalOptOuts: 0
    }
  });

  const [segmentCount, setSegmentCount] = useState(0);

  useEffect(() => {
    fetchCustomerStats();
    fetchCampaignStats();
    fetchSegmentCount();
  }, []);

  const fetchCustomerStats = async () => {
    try {
      const { data: customers, error } = await supabase
        .from('crm_customers')
        .select('sms_opt_in');

      if (error) throw error;

      const total = customers?.length || 0;
      const smsOptedIn = customers?.filter(c => c.sms_opt_in).length || 0;
      const smsOptInRate = total > 0 ? (smsOptedIn / total) * 100 : 0;

      setCustomerStats({
        total,
        smsOptedIn,
        smsOptInRate
      });
    } catch (error) {
      console.error('Error fetching customer stats:', error);
    }
  };

  const fetchCampaignStats = async () => {
    try {
      // Get 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoString = thirtyDaysAgo.toISOString();

      // Fetch email campaigns
      const { data: emailCampaigns, error: emailError } = await supabase
        .from('crm_campaigns')
        .select('metrics')
        .not('sent_at', 'is', null)
        .gte('sent_at', thirtyDaysAgoString);

      if (emailError) throw emailError;

      // Fetch SMS campaigns
      const { data: smsCampaigns, error: smsError } = await supabase
        .from('crm_sms_campaigns')
        .select('metrics')
        .not('sent_at', 'is', null)
        .gte('sent_at', thirtyDaysAgoString);

      if (smsError) throw smsError;

      // Calculate email stats
      let emailTotalSent = 0;
      let emailTotalOpens = 0;
      let emailTotalClicks = 0;
      let emailTotalUnsubscribes = 0;

      emailCampaigns?.forEach(campaign => {
        if (campaign.metrics && typeof campaign.metrics === 'object') {
          const metrics = campaign.metrics as any;
          emailTotalSent += metrics.sent || 0;
          emailTotalOpens += metrics.opens || 0;
          emailTotalClicks += metrics.clicks || 0;
          emailTotalUnsubscribes += metrics.unsubscribes || 0;
        }
      });

      const emailAvgOpenRate = emailTotalSent > 0 ? (emailTotalOpens / emailTotalSent) * 100 : 0;
      const emailAvgClickRate = emailTotalSent > 0 ? (emailTotalClicks / emailTotalSent) * 100 : 0;

      // Calculate SMS stats
      let smsTotalSent = 0;
      let smsTotalDelivered = 0;
      let smsTotalClicks = 0;
      let smsTotalOptOuts = 0;

      smsCampaigns?.forEach(campaign => {
        if (campaign.metrics && typeof campaign.metrics === 'object') {
          const metrics = campaign.metrics as any;
          smsTotalSent += metrics.messages_sent || 0;
          smsTotalDelivered += metrics.delivered || 0;
          smsTotalClicks += metrics.clicks || 0;
          smsTotalOptOuts += metrics.opt_outs || 0;
        }
      });

      const smsDeliveryRate = smsTotalSent > 0 ? (smsTotalDelivered / smsTotalSent) * 100 : 0;
      const smsClickRate = smsTotalSent > 0 ? (smsTotalClicks / smsTotalSent) * 100 : 0;

      setCampaignStats({
        email: {
          totalSent: emailTotalSent,
          campaignCount: emailCampaigns?.length || 0,
          avgOpenRate: emailAvgOpenRate,
          avgClickRate: emailAvgClickRate,
          totalUnsubscribes: emailTotalUnsubscribes
        },
        sms: {
          totalSent: smsTotalSent,
          campaignCount: smsCampaigns?.length || 0,
          deliveryRate: smsDeliveryRate,
          clickRate: smsClickRate,
          totalOptOuts: smsTotalOptOuts
        }
      });
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
    }
  };

  const fetchSegmentCount = async () => {
    try {
      const { count, error } = await supabase
        .from('crm_segments')
        .select('*', { count: 'exact' });

      if (error) throw error;
      setSegmentCount(count || 0);
    } catch (error) {
      console.error('Error fetching segment count:', error);
    }
  };

  const showSMSNudge = customerStats.total > 0 && customerStats.smsOptInRate < 25;
  const totalCampaigns = campaignStats.email.campaignCount + campaignStats.sms.campaignCount;

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="CRM Dashboard"
    >
      <div className="min-h-screen bg-gradient-to-br from-green-50/30 to-emerald-50/30">
        <div className="container mx-auto p-6 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  BloomSuite CRM
                </h1>
                <p className="text-lg text-muted-foreground">
                  Growing relationships, one customer at a time 🌱
                </p>
              </div>
            </div>
          </div>

          {/* Hero Metrics */}
          <HeroMetricsSection 
            customerStats={customerStats}
            campaignStats={campaignStats}
            segmentCount={segmentCount}
          />

          {/* Quick Start Guide */}
          <QuickStartStepper 
            customerCount={customerStats.total}
            segmentCount={segmentCount}
            campaignCount={totalCampaigns}
            onStepComplete={() => {
              // Refresh data when a step is completed
              fetchCustomerStats();
              fetchSegmentCount();
              fetchCampaignStats();
            }}
          />

          {/* Empty State or Welcome */}
          <EmptyStateSection 
            customerCount={customerStats.total}
            campaignCount={totalCampaigns}
          />

          {/* Feature Highlights */}
          <FeatureHighlightsCard />

          {/* SMS Opt-in Nudge */}
          {showSMSNudge && (
            <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-orange-900">
                      🧑‍🌾 {Math.round(100 - customerStats.smsOptInRate)}% of your customers aren't opted in for SMS
                    </h3>
                    <p className="text-orange-700 mt-1">
                      Send a signup message or add opt-in prompts to your forms to grow your SMS list.
                    </p>
                    <div className="mt-3 flex items-center space-x-3">
                      <Button asChild size="sm">
                        <Link to="/crm/sms-campaigns/new?template=invite">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Create SMS Invite Campaign
                        </Link>
                      </Button>
                      <span className="text-sm text-orange-600">
                        {customerStats.smsOptedIn} of {customerStats.total} customers opted in
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}


          {/* Usage Tracking with Garden-Themed Design */}
          {(subscription?.crm_enabled || subscription?.sms_enabled) && (
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center text-blue-800">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  🌿 Monthly Growth Tracker
                </CardTitle>
                <p className="text-blue-700">
                  Watch your community connections bloom this month
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {subscription?.crm_enabled && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Mail className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-blue-900">📩 Emails Sent</span>
                        </div>
                        <span className="text-sm font-bold text-blue-800">
                          {subscription.email_usage || 0} / {subscription.email_quota || 1000}
                        </span>
                      </div>
                      <Progress 
                        value={((subscription.email_usage || 0) / (subscription.email_quota || 1000)) * 100} 
                        className="h-4 bg-blue-100"
                        indicatorClassName={
                          ((subscription.email_usage || 0) / (subscription.email_quota || 1000)) * 100 >= 90
                            ? "bg-gradient-to-r from-red-500 to-red-600" 
                            : ((subscription.email_usage || 0) / (subscription.email_quota || 1000)) * 100 >= 70
                            ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                            : "bg-gradient-to-r from-green-500 to-emerald-600"
                        }
                      />
                      {((subscription.email_usage || 0) / (subscription.email_quota || 1000)) * 100 >= 90 && (
                        <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 p-4 rounded-xl">
                          <div className="flex items-center space-x-2 text-red-700 mb-3">
                            <AlertTriangle className="h-5 w-5" />
                            <span className="font-medium">
                              {(subscription.email_usage || 0) >= (subscription.email_quota || 1000) 
                                ? "🌱 You've reached your monthly email limit" 
                                : "🌱 You're blooming! Close to your email limit"}
                            </span>
                          </div>
                          <p className="text-red-600 text-sm mb-3">
                            {(subscription.email_usage || 0) >= (subscription.email_quota || 1000)
                              ? "Your garden is thriving! Upgrade to continue connecting with more customers."
                              : `You've connected with ${subscription.email_usage || 0}+ gardeners this month! 🌿 Upgrade for more reach.`}
                          </p>
                          <div className="flex space-x-3">
                            <Button size="sm" asChild className="bg-gradient-to-r from-green-600 to-emerald-600">
                              <Link to="/settings/billing">Upgrade Plan</Link>
                            </Button>
                            <Button variant="outline" size="sm">Contact Support</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {subscription?.sms_enabled && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <MessageSquare className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="font-medium text-green-900">💬 SMS Sent</span>
                        </div>
                        <span className="text-sm font-bold text-green-800">
                          {subscription.sms_usage || 0} / {subscription.sms_quota || 250}
                        </span>
                      </div>
                      <Progress 
                        value={((subscription.sms_usage || 0) / (subscription.sms_quota || 250)) * 100} 
                        className="h-4 bg-green-100"
                        indicatorClassName={
                          ((subscription.sms_usage || 0) / (subscription.sms_quota || 250)) * 100 >= 90
                            ? "bg-gradient-to-r from-red-500 to-red-600" 
                            : ((subscription.sms_usage || 0) / (subscription.sms_quota || 250)) * 100 >= 70
                            ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                            : "bg-gradient-to-r from-green-500 to-emerald-600"
                        }
                      />
                      {((subscription.sms_usage || 0) / (subscription.sms_quota || 250)) * 100 >= 90 && (
                        <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 p-4 rounded-xl">
                          <div className="flex items-center space-x-2 text-red-700 mb-3">
                            <AlertTriangle className="h-5 w-5" />
                            <span className="font-medium">
                              {(subscription.sms_usage || 0) >= (subscription.sms_quota || 250) 
                                ? "🌱 You've reached your monthly SMS limit" 
                                : "🌱 You're nearing your SMS limit"}
                            </span>
                          </div>
                          <p className="text-red-600 text-sm mb-3">
                            {(subscription.sms_usage || 0) >= (subscription.sms_quota || 250)
                              ? "Amazing reach! Upgrade to continue sending SMS messages to your garden community."
                              : `You've reached out to ${subscription.sms_usage || 0} customers this month! 🌿 Upgrade for unlimited growth.`}
                          </p>
                          <div className="flex space-x-3">
                            <Button size="sm" asChild className="bg-gradient-to-r from-green-600 to-emerald-600">
                              <Link to="/settings/billing">Upgrade Plan</Link>
                            </Button>
                            <Button variant="outline" size="sm">Contact Support</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sticky CTA for Mobile */}
          <div className="fixed bottom-4 right-4 z-50 md:hidden">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg rounded-full"
              asChild
            >
              <Link to="/crm/campaigns/new">
                <Mail className="h-5 w-5 mr-2" />
                Create Campaign
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </SubscriptionGate>
  );
};

export default CRMDashboard;